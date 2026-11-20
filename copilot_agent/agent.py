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
    if any(part in (".git", ".ssh", ".mcp", ".env") or
           part.endswith((".pem", ".key", ".token")) for part in parts):
        raise PermissionError("Sensitive path is excluded")
    return target


def _isolated(argv, cwd=None, timeout=30):
    """Fail closed without user-namespace isolation. No shell interpolation."""
    bwrap = shutil.which("bwrap")
    prlimit = shutil.which("prlimit")
    if not bwrap or not prlimit:
        raise RuntimeError("bubblewrap and prlimit required for command execution")
    root = _workspace() if cwd is None else _path(cwd)
    args = ["--unshare-all", "--die-with-parent", "--new-session",
            "--clearenv", "--setenv", "PATH", "/usr/bin:/bin",
            "--setenv", "HOME", "/tmp", "--tmpfs", "/tmp",
            "--proc", "/proc", "--dev", "/dev", "--dir", "/etc"]
    for lib in ("/usr", "/bin", "/lib", "/lib64"):
        if os.path.exists(lib):
            args.extend(("--ro-bind", lib, lib))
    prefix = ""
    for part in root.parts[1:-1]:
        prefix += "/" + part
        args.extend(("--dir", prefix))
    args.extend(("--bind", str(root), str(root), "--chdir", str(root), "--",
                 prlimit, "--as=1073741824", "--cpu=30", "--fsize=1048576",
                 "--nofile=128", "--nproc=32", "--core=0", "--", *argv))
    result = subprocess.run([bwrap, *args], cwd=root, capture_output=True,
                            text=True, timeout=timeout, check=False,
                            env={"PATH": "/usr/bin:/bin", "HOME": "/tmp", "LANG": "C"})
    if len(result.stdout) + len(result.stderr) > 65536:
        raise RuntimeError("Tool output exceeds 64 KiB")
    if result.returncode:
        return "[error] Isolated command exited " + str(result.returncode)
    return (result.stdout + result.stderr).strip()


def _exec_shell(command, working_dir=None):
    argv = shlex.split(command)
    if not argv or argv[0] not in ("git", "ls", "cat", "pytest", "python3", "ruff"):
        raise PermissionError("Executable is not on the fixed allowlist")
    if any(a in (";", "&&", "||", "|", ">", ">>", "<", "&") for a in argv):
        raise PermissionError("Shell operators are forbidden")
    return _isolated(argv, working_dir)


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
    return _isolated([sys.executable, "-I", "-c", code])


def _exec_git(operation, args=None):
    if operation not in ("status", "diff", "log", "branch", "checkout", "commit"):
        raise PermissionError("Git operation not permitted")
    argv = ["git", "-c", "core.hooksPath=/dev/null", operation]
    if args:
        argv += shlex.split(args)
    return _isolated(argv)


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
    if name != 'file_read' and authorized is not True:
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
                    if name == "file_read" and name in self.tool_names:
                        approved = True
                    elif name in self.tool_names and sys.stdin.isatty():
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
                    result = execute_tool(name, args, authorized=approved)
                    if not approved:
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
