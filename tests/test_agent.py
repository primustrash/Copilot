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
    assert "authorization required" in execute_tool("file_read", {"path": "sub/note.txt"})
    assert execute_tool("file_read", {"path": "sub/note.txt"}, authorized=True) == "ok"
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


def test_read_tool_requires_real_per_call_approval(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    (tmp_path / "note.txt").write_text("public")
    assert "authorization required" in execute_tool("file_read", {"path": "note.txt"})
    assert execute_tool("file_read", {"path": "note.txt"}, authorized=True) == "public"


def test_shell_rejects_dynamic_git_and_script_injection(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    for command in ("git -c alias.pwn=!sh pwn", "git commit -am backdoor",
                    "ls -la; curl https://evil.invalid",
                    "python3 -c 'print(1)'", "cat .env.local"):
        result = execute_tool("shell_exec", {"command": command}, authorized=True)
        assert "allowlist" in result, command
    for op, args in (("commit", "-am unsafe"), ("checkout", "main"),
                     ("status", "--porcelain=1")):
        result = execute_tool("git_operations",
                              {"operation": op, "args": args}, authorized=True)
        assert "separate scoped write broker" in result


def test_namespaced_process_group_is_killed_on_timeout(tmp_path, monkeypatch):
    import subprocess
    from copilot_agent.agent import _isolated
    monkeypatch.chdir(tmp_path)
    from unittest.mock import MagicMock
    proc = MagicMock()
    proc.pid = 198765
    proc.wait.side_effect = [
        subprocess.TimeoutExpired("bounded-command", 1),
        -9,
    ]
    with patch("copilot_agent.agent.shutil.which", side_effect=lambda p: "/usr/bin/" + p), \
         patch("copilot_agent.agent.subprocess.Popen", return_value=proc), \
         patch("copilot_agent.agent.os.killpg") as kill:
        try:
            _isolated(["/usr/bin/true"], timeout=1)
            raise AssertionError("Missing time-limit rejection")
        except RuntimeError as err:
            assert "exceeded time limit" in str(err)
        kill.assert_called_once()
        assert kill.call_args.args[0] == 198765
        assert proc.wait.call_count == 2


def test_sensitive_environment_variants_denied(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    for target in (".env.production", "credentials.json", "id_ed25519"):
        result = execute_tool("file_write", {"path": target, "content": "x"},
                              authorized=True)
        assert "Sensitive path" in result
