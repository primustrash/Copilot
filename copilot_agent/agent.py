"""Agent execution engine - run configured agents locally or via API."""

import json
import os
import subprocess
import sys

import requests

from copilot_agent.tools import get_tool_schemas


# ---------------------------------------------------------------------------
# Tool execution helpers (used when the model calls a tool)
# ---------------------------------------------------------------------------


def _exec_shell(command, working_dir=None):
    """Execute a shell command and return stdout/stderr."""
    result = subprocess.run(
        command,
        shell=True,
        capture_output=True,
        text=True,
        cwd=working_dir,
        timeout=120,
    )
    output = result.stdout
    if result.stderr:
        output += "\n[stderr]\n" + result.stderr
    return output.strip()


def _exec_file_read(path):
    """Read and return file contents."""
    with open(path, "r") as f:
        return f.read()


def _exec_file_write(path, content):
    """Write content to a file, creating directories as needed."""
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w") as f:
        f.write(content)
    return f"Written {len(content)} bytes to {path}"


def _exec_python(code):
    """Execute Python code in a subprocess."""
    result = subprocess.run(
        [sys.executable, "-c", code],
        capture_output=True,
        text=True,
        timeout=60,
    )
    output = result.stdout
    if result.stderr:
        output += "\n[stderr]\n" + result.stderr
    return output.strip()


def _exec_git(operation, args=None):
    """Execute a Git operation."""
    cmd = f"git {operation}"
    if args:
        cmd += f" {args}"
    return _exec_shell(cmd)


TOOL_EXECUTORS = {
    "shell_exec": lambda **kw: _exec_shell(kw["command"], kw.get("working_dir")),
    "file_read": lambda **kw: _exec_file_read(kw["path"]),
    "file_write": lambda **kw: _exec_file_write(kw["path"], kw["content"]),
    "python_exec": lambda **kw: _exec_python(kw["code"]),
    "git_operations": lambda **kw: _exec_git(kw["operation"], kw.get("args")),
}


def execute_tool(name, arguments):
    """Execute a tool by name with the given arguments.

    Args:
        name: Tool name string.
        arguments: Dict of argument key/value pairs.

    Returns:
        Tool output string.
    """
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
                    out(f"\n🔧 Tool call: {name}({json.dumps(args, indent=2)})")
                    result = execute_tool(name, args)
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
