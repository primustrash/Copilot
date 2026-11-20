"""Agent execution engine - run configured agents locally or via API."""

import json
import os
import subprocess
import sys
import pathlib
import shutil
import shlex

import requests

from copilot_agent.tools import get_tool_schemas


# ---------------------------------------------------------------------------
# Tool execution helpers (used when the model calls a tool)
# ---------------------------------------------------------------------------


def _workspace():
    root = pathlib.Path(os.environ.get("COPILOT_AGENT_WORKSPACE", os.getcwd())).resolve()
    if not root.is_dir() or root in (pathlib.Path("/"), pathlib.Path("/tmp"), pathlib.Path.home()):
        raise ValueError("Select a dedicated, existing project workspace")
    return root


def _path(raw, allow_missing=False):
    root = _workspace()
    p = pathlib.Path(raw)
    target = (p if p.is_absolute() else root / p).resolve(strict=not allow_missing)
    if target != root and root not in target.parents:
        raise PermissionError("Path outside authorized workspace")
    parts = target.relative_to(root).parts
    if any(part in (".git", ".ssh", ".mcp", "credentials.json", "secrets.json", "id_rsa", "id_ed25519") or
           part.startswith(".env") or part.endswith((".pem", ".key", ".token")) for part in parts):
        raise PermissionError("Sensitive path is excluded")
    return target


def _isolated(argv, cwd=None, timeout=30):
    """Bounded process-group execution in a network-disabled OS namespace."""
    import signal
    import tempfile

    bwrap = shutil.which("bwrap")
    prlimit = shutil.which("prlimit")
    if not bwrap or not prlimit:
        raise RuntimeError("bubblewrap and prlimit required for isolated execution")
    root = _workspace()
    execution_dir = root if cwd is None else _path(cwd)
    timeout = min(max(int(timeout), 1), 60)
    args = ["--unshare-all", "--die-with-parent", "--new-session",
            "--clearenv", "--setenv", "PATH", "/usr/bin:/bin",
            "--setenv", "HOME", "/tmp", "--tmpfs", "/tmp",
            "--proc", "/proc", "--dev", "/dev", "--dir", "/etc"]
    for directory in ("/usr", "/bin", "/lib", "/lib64"):
        if os.path.exists(directory):
            args.extend(("--ro-bind", directory, directory))
    prefix = ""
    for part in execution_dir.parts[1:-1]:
        prefix += "/" + part
        args.extend(("--dir", prefix))
    args.extend(("--bind", str(execution_dir), str(execution_dir),
                 "--chdir", str(execution_dir), "--",
                 prlimit, "--as=1073741824", "--cpu=30", "--fsize=1048576",
                 "--nofile=128", "--nproc=32", "--core=0", "--", *argv))
    with tempfile.TemporaryFile() as stdout, tempfile.TemporaryFile() as stderr:
        process = subprocess.Popen(
            [bwrap, *args], cwd=root, stdin=subprocess.DEVNULL,
            stdout=stdout, stderr=stderr, start_new_session=True,
            env={"PATH": "/usr/bin:/bin", "HOME": "/tmp", "LANG": "C"})
        try:
            code = process.wait(timeout=timeout)
        except subprocess.TimeoutExpired:
            # Kill the entire host-side process group, not just bubblewrap.
            os.killpg(process.pid, signal.SIGKILL)
            process.wait()
            raise RuntimeError("Isolated process group exceeded time limit")
        stdout.seek(0)
        stderr.seek(0)
        out = stdout.read(65537)
        err = stderr.read(65537)
        if len(out) > 65536 or len(err) > 65536:
            raise RuntimeError("Isolated output exceeds 64 KiB")
        if code:
            return "[error] Isolated command exited " + str(code)
        return (out + err).decode("utf-8", "replace").strip()


def _exec_shell(command, working_dir=None):
    """Only exact, audited read-only command forms; no dynamic shell text."""
    if not isinstance(command, str):
        raise ValueError("Invalid command type")
    allowed = {
        "git status", "git status --short",
        "git diff --stat", "git diff --name-only",
        "git log -5 --oneline", "ls -la",
    }
    if command not in allowed:
        raise PermissionError("Command not on the fixed read-only allowlist")
    return _isolated(shlex.split(command), working_dir)


def _exec_file_read(path):
    p = _path(path)
    if not p.is_file() or p.stat().st_size > 1048576:
        raise ValueError("Missing or oversized file")
    return p.read_text(encoding="utf-8")


def _exec_file_write(path, content):
    if not isinstance(content, str) or len(content.encode("utf-8")) > 1048576:
        raise ValueError("Invalid file content")
    p = _path(path, allow_missing=True)
    p.parent.mkdir(parents=True, exist_ok=True)
    _path(p.parent)
    flags = os.O_CREAT | os.O_WRONLY | os.O_TRUNC | getattr(os, "O_NOFOLLOW", 0)
    fd = os.open(p, flags, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as stream:
        stream.write(content)
    return "Wrote approved workspace file: " + str(p.relative_to(_workspace()))


def _exec_python(code):
    if not isinstance(code, str) or len(code) > 16384:
        raise ValueError("Invalid code")
    return _isolated(["/usr/bin/python3", "-I", "-c", code])


def _exec_git(operation, args=None):
    """This generic adapter is read-only; writes need a separate broker."""
    commands = {
        ("status", None): ["git", "status", "--short"],
        ("diff", None): ["git", "diff", "--stat"],
        ("log", None): ["git", "log", "-5", "--oneline"],
    }
    key = (operation, args or None)
    if key not in commands:
        raise PermissionError("Git operation requires a separate scoped write broker")
    return _isolated(commands[key])



def _audit_tool_approval(name, approved):
    """Record one authorization decision, never parameters or tool output."""
    try:
        from datetime import datetime, timezone
        base = pathlib.Path.home() / ".local" / "state" / "copilot-agent"
        base.mkdir(parents=True, exist_ok=True, mode=0o700)
        fd = os.open(base / "approvals.jsonl",
                     os.O_WRONLY | os.O_APPEND | os.O_CREAT, 0o600)
        record = {"at": datetime.now(timezone.utc).isoformat(),
                  "tool": name, "approved": bool(approved)}
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            stream.write(json.dumps(record, sort_keys=True) + "\n")
    except OSError:
        # Never grant a tool operation based on whether audit storage succeeds.
        pass


TOOL_EXECUTORS = {
    "shell_exec": lambda **kw: _exec_shell(kw["command"], kw.get("working_dir")),
    "file_read": lambda **kw: _exec_file_read(kw["path"]),
    "file_write": lambda **kw: _exec_file_write(kw["path"], kw["content"]),
    "python_exec": lambda **kw: _exec_python(kw["code"]),
    "git_operations": lambda **kw: _exec_git(kw["operation"], kw.get("args")),
}


def execute_tool(name, arguments, *, authorized=False):
    """Execute a tool by name with the given arguments.

    Args:
        name: Tool name string.
        arguments: Dict of argument key/value pairs.

    Returns:
        Tool output string.
    """
    if authorized is not True:
        return '[error] Per-call authorization required'
    executor = TOOL_EXECUTORS.get(name)
    if executor is None:
        return f"[error] Tool '{name}' has no local executor."
    try:
        return executor(**arguments)
    except Exception as e:
        return f"[error] {e}"


# ---------------------------------------------------------------------------
# Agent loop
# ---------------------------------------------------------------------------


class AgentRunner:
    """Run an interactive agent loop using a selected model and tools."""

    def __init__(self, model_id, tool_names, config, github_token):
        """
        Args:
            model_id: Model identifier string (e.g. 'gpt-4o').
            tool_names: List of tool name strings to enable.
            config: Agent configuration dict.
            github_token: GitHub token for API access.
        """
        self.model_id = model_id
        self.tool_names = tool_names
        self.config = config
        self.github_token = github_token
        self.messages = []
        self.max_iterations = config.get("max_iterations", 10)
        self.temperature = config.get("temperature", 0.7)
        self.system_prompt = config.get(
            "system_prompt", "You are a helpful coding assistant."
        )
        self._api_base = "https://models.inference.ai.azure.com"

    def _get_headers(self):
        return {
            "Authorization": f"Bearer {self.github_token}",
            "Content-Type": "application/json",
        }

    def _build_request_body(self):
        body = {
            "model": self.model_id,
            "messages": self.messages,
            "temperature": self.temperature,
        }
        schemas = get_tool_schemas(self.tool_names)
        if schemas:
            body["tools"] = schemas
        return body

    def _call_model(self):
        """Send the current messages to the model and return the response."""
        body = self._build_request_body()
        resp = requests.post(
            f"{self._api_base}/chat/completions",
            headers=self._get_headers(),
            json=body,
            timeout=120,
        )
        resp.raise_for_status()
        return resp.json()

    def start(self, print_fn=None):
        """Run the interactive agent loop.

        Args:
            print_fn: Optional callable for output (defaults to print).
        """
        out = print_fn or print
        self.messages = [{"role": "system", "content": self.system_prompt}]

        out(f"\n🤖 Agent started  |  Model: {self.model_id}")
        out(f"   Tools: {', '.join(self.tool_names) or 'none'}")
        out(f"   Max iterations per turn: {self.max_iterations}")
        out("   Type 'quit' or 'exit' to stop.\n")

        while True:
            try:
                user_input = input("You > ").strip()
            except (EOFError, KeyboardInterrupt):
                out("\nAgent stopped.")
                break

            if user_input.lower() in ("quit", "exit", "q"):
                out("Agent stopped.")
                break

            if not user_input:
                continue

            self.messages.append({"role": "user", "content": user_input})
            self._process_turn(out)

    def _process_turn(self, out):
        """Process one conversational turn, handling tool calls."""
        for _ in range(self.max_iterations):
            try:
                response = self._call_model()
            except requests.RequestException as e:
                out(f"\n[API Error] {e}")
                return

            choice = response.get("choices", [{}])[0]
            message = choice.get("message", {})
            finish = choice.get("finish_reason", "")

            # If the model wants to call tools
            tool_calls = message.get("tool_calls")
            if tool_calls:
                self.messages.append(message)
                for tc in tool_calls:
                    fn = tc["function"]
                    name = fn["name"]
                    try:
                        args = json.loads(fn.get("arguments", "{}"))
                    except json.JSONDecodeError:
                        args = {}
                    out(f"\\n🔧 Tool requested: {name} (arguments not logged)")
                    approved = False
                    if name in self.tool_names and sys.stdin.isatty():
                        try:
                            details = json.dumps(args, sort_keys=True, ensure_ascii=True)
                            if len(details) > 2400:
                                raise ValueError("Tool arguments too long for safe interactive review")
                            answer = input(
                                f"Authorize EXACT {name} action with parameters: {details}\\n"
                                "Type APPROVE (single use, anything else denies): "
                            )
                            approved = answer.strip() == "APPROVE"
                        except (KeyboardInterrupt, EOFError, ValueError):
                            approved = False
                    _audit_tool_approval(name, approved)
                    if approved:
                        result = execute_tool(name, args, authorized=True)
                    else:
                        result = "[error] Denied: no verified per-call approval"
                    out(f"   ➜ {result[:500]}")
                    self.messages.append(
                        {
                            "role": "tool",
                            "tool_call_id": tc["id"],
                            "content": str(result),
                        }
                    )
                continue  # let the model process tool results

            # Regular assistant message
            content = message.get("content", "")
            self.messages.append({"role": "assistant", "content": content})
            out(f"\nAssistant > {content}\n")
            return

        out("\n[max tool iterations reached for this turn]\n")
