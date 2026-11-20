"""Security regression tests: an LLM toolcall is never a host approval."""
from unittest.mock import patch
import pathlib

from copilot_agent.agent import AgentRunner, execute_tool


def test_unknown_tool_is_rejected():
    assert "[error]" in execute_tool("no_such_tool", {})


def test_no_ambient_shell_python_or_git_authorization():
    for name, payload in (
        ("shell_exec", {"command": "echo hello"}),
        ("python_exec", {"code": "print(42)"}),
        ("git_operations", {"operation": "status"}),
        ("file_write", {"path": "x", "content": "data"}),
    ):
        assert "authorization required" in execute_tool(name, payload)


def test_isolation_is_mandatory_even_after_approval(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    with patch("copilot_agent.agent.shutil.which", return_value=None):
        assert "bubblewrap" in execute_tool(
            "python_exec", {"code": "print(42)"}, authorized=True
        )
        assert "bubblewrap" in execute_tool(
            "shell_exec", {"command": "git status"}, authorized=True
        )


def test_workspace_scoped_file_write(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    result = execute_tool(
        "file_write", {"path": "sub/note.txt", "content": "ok"}, authorized=True
    )
    assert result.startswith("Wrote approved workspace file")
    assert (tmp_path / "sub/note.txt").read_text() == "ok"
    assert execute_tool("file_read", {"path": "sub/note.txt"}) == "ok"
    assert "outside authorized workspace" in execute_tool(
        "file_write", {"path": "../outside.txt", "content": "bad"},
        authorized=True,
    )


def test_sensitive_workspace_paths_are_blocked(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    assert "Sensitive path" in execute_tool(
        "file_write", {"path": ".mcp/.env.local", "content": "secret"},
        authorized=True
    )


def test_runner_denies_model_toolcalls_when_noninteractive(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    runner = AgentRunner("test-model", ["shell_exec"], {}, "not-a-real-token")
    replies = iter([
        {"choices": [{"message": {"tool_calls": [{
            "id": "call-1",
            "function": {"name": "shell_exec", "arguments": '{"command":"git status"}'}
        }]}, "finish_reason": "tool_calls"}]},
        {"choices": [{"message": {"content": "complete"}, "finish_reason": "stop"}]},
    ])
    runner._call_model = lambda: next(replies)
    messages = []
    with patch("copilot_agent.agent.sys.stdin.isatty", return_value=False):
        runner._process_turn(messages.append)
    assert any("Denied" in msg for msg in messages)
    assert any("Authorization denied" in m["content"] or "Denied" in m["content"]
               for m in runner.messages if m.get("role") == "tool")


def test_runner_approval_is_exact_and_one_time(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    runner = AgentRunner("test-model", ["python_exec"], {}, "not-a-real-token")
    replies = iter([
        {"choices": [{"message": {"tool_calls": [{
            "id": "call-2",
            "function": {"name": "python_exec", "arguments": '{"code":"print(1)"}'}
        }]}, "finish_reason": "tool_calls"}]},
        {"choices": [{"message": {"content": "done"}, "finish_reason": "stop"}]},
    ])
    runner._call_model = lambda: next(replies)
    with patch("copilot_agent.agent.sys.stdin.isatty", return_value=True), \
         patch("builtins.input", return_value="APPROVE"), \
         patch("copilot_agent.agent.execute_tool", return_value="approved") as run:
        runner._process_turn(lambda line: None)
        run.assert_called_once_with(
            "python_exec", {"code": "print(1)"}, authorized=True
        )
