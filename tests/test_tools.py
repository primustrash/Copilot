"""Tests for copilot_agent.tools module."""

from copilot_agent.tools import (
    format_tool_info,
    get_all_tools,
    get_tool_by_name,
    get_tool_categories,
    get_tool_schemas,
    get_tools_by_category,
)


class TestGetAllTools:
    def test_returns_list(self):
        tools = get_all_tools()
        assert isinstance(tools, list)
        assert len(tools) > 0

    def test_each_tool_has_required_keys(self):
        for tool in get_all_tools():
            assert "name" in tool
            assert "display_name" in tool
            assert "description" in tool
            assert "category" in tool
            assert "schema" in tool


class TestGetToolCategories:
    def test_returns_sorted_list(self):
        cats = get_tool_categories()
        assert isinstance(cats, list)
        assert cats == sorted(cats)
        assert len(cats) > 0


class TestGetToolsByCategory:
    def test_system_category(self):
        tools = get_tools_by_category("system")
        assert len(tools) >= 1
        assert all(t["category"] == "system" for t in tools)

    def test_nonexistent_category(self):
        tools = get_tools_by_category("nonexistent")
        assert tools == []


class TestGetToolByName:
    def test_existing_tool(self):
        tool = get_tool_by_name("shell_exec")
        assert tool is not None
        assert tool["name"] == "shell_exec"

    def test_missing_tool(self):
        assert get_tool_by_name("no_such_tool") is None


class TestGetToolSchemas:
    def test_returns_schemas(self):
        schemas = get_tool_schemas(["shell_exec", "file_read"])
        assert len(schemas) == 2
        assert all(s["type"] == "function" for s in schemas)

    def test_ignores_unknown_tools(self):
        schemas = get_tool_schemas(["shell_exec", "unknown_tool"])
        assert len(schemas) == 1

    def test_empty_input(self):
        schemas = get_tool_schemas([])
        assert schemas == []


class TestFormatToolInfo:
    def test_format_contains_name(self):
        tool = get_tool_by_name("shell_exec")
        info = format_tool_info(tool)
        assert "Shell Command Execution" in info
        assert "shell_exec" in info

    def test_format_download_required(self):
        tool = get_tool_by_name("docker_manage")
        info = format_tool_info(tool)
        assert "install required" in info
