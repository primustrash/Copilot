"""Tests for copilot_agent.agent module."""

from unittest.mock import MagicMock, patch

from copilot_agent.agent import execute_tool


class TestExecuteTool:
    def test_unknown_tool(self):
        result = execute_tool("no_such_tool", {})
        assert "[error]" in result

    @patch("copilot_agent.agent.subprocess.run")
    def test_shell_exec(self, mock_run):
        mock_run.return_value = MagicMock(stdout="hello", stderr="", returncode=0)
        result = execute_tool("shell_exec", {"command": "echo hello"})
        assert result == "hello"

    def test_file_read_missing(self):
        result = execute_tool("file_read", {"path": "/nonexistent/file.txt"})
        assert "[error]" in result

    @patch("copilot_agent.agent.subprocess.run")
    def test_python_exec(self, mock_run):
        mock_run.return_value = MagicMock(stdout="42", stderr="", returncode=0)
        result = execute_tool("python_exec", {"code": "print(42)"})
        assert "42" in result

    @patch("copilot_agent.agent.subprocess.run")
    def test_git_operations(self, mock_run):
        mock_run.return_value = MagicMock(
            stdout="On branch main", stderr="", returncode=0
        )
        result = execute_tool("git_operations", {"operation": "status"})
        assert "branch" in result.lower()
