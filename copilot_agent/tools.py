"""Tool definitions and management for agents.

Each tool is defined as a dict compatible with the OpenAI function-calling
schema so it can be sent directly to models that support tool use.
"""

# ---------------------------------------------------------------------------
# Built-in tool catalogue
# ---------------------------------------------------------------------------

BUILTIN_TOOLS = [
    {
        "name": "shell_exec",
        "display_name": "Shell Command Execution",
        "description": (
            "Execute shell commands on the local machine. "
            "Useful for running builds, tests, linters, git operations, "
            "and any CLI-based workflow."
        ),
        "category": "system",
        "requires_download": False,
        "usage_hint": (
            "Use this to automate repetitive CLI tasks like "
            "'npm test', 'git status', or 'docker build'."
        ),
        "schema": {
            "type": "function",
            "function": {
                "name": "shell_exec",
                "description": "Run a shell command and return its output.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "command": {
                            "type": "string",
                            "description": "The shell command to execute.",
                        },
                        "working_dir": {
                            "type": "string",
                            "description": "Working directory (optional).",
                        },
                    },
                    "required": ["command"],
                },
            },
        },
    },
    {
        "name": "file_read",
        "display_name": "File Reader",
        "description": (
            "Read the contents of a file from disk. "
            "Supports text files of any type."
        ),
        "category": "filesystem",
        "requires_download": False,
        "usage_hint": (
            "Great for letting the agent inspect source code, configs, "
            "logs, or any text file before making decisions."
        ),
        "schema": {
            "type": "function",
            "function": {
                "name": "file_read",
                "description": "Read file contents and return them as text.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "path": {
                            "type": "string",
                            "description": "Absolute or relative path to the file.",
                        },
                    },
                    "required": ["path"],
                },
            },
        },
    },
    {
        "name": "file_write",
        "display_name": "File Writer",
        "description": (
            "Write or overwrite a file on disk. "
            "Creates parent directories if needed."
        ),
        "category": "filesystem",
        "requires_download": False,
        "usage_hint": (
            "Use when the agent needs to create new files or update "
            "existing ones, e.g. generating code or config files."
        ),
        "schema": {
            "type": "function",
            "function": {
                "name": "file_write",
                "description": "Write content to a file.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "path": {
                            "type": "string",
                            "description": "Path to the file to write.",
                        },
                        "content": {
                            "type": "string",
                            "description": "Content to write into the file.",
                        },
                    },
                    "required": ["path", "content"],
                },
            },
        },
    },
    {
        "name": "web_search",
        "display_name": "Web Search",
        "description": (
            "Search the web for up-to-date information. "
            "Requires an internet connection."
        ),
        "category": "web",
        "requires_download": False,
        "usage_hint": (
            "Useful for researching APIs, finding documentation, "
            "or looking up error messages the agent encounters."
        ),
        "schema": {
            "type": "function",
            "function": {
                "name": "web_search",
                "description": "Search the web and return results.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "The search query.",
                        },
                    },
                    "required": ["query"],
                },
            },
        },
    },
    {
        "name": "code_analysis",
        "display_name": "Code Analyzer",
        "description": (
            "Analyze source code for patterns, dependencies, complexity, "
            "and potential issues using static analysis."
        ),
        "category": "development",
        "requires_download": False,
        "usage_hint": (
            "Run before making changes to understand codebase structure. "
            "Combines grep, AST parsing, and pattern matching."
        ),
        "schema": {
            "type": "function",
            "function": {
                "name": "code_analysis",
                "description": "Analyze code in a directory or file.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "path": {
                            "type": "string",
                            "description": "Path to analyze.",
                        },
                        "analysis_type": {
                            "type": "string",
                            "enum": [
                                "dependencies",
                                "complexity",
                                "patterns",
                                "security",
                            ],
                            "description": "Type of analysis to perform.",
                        },
                    },
                    "required": ["path"],
                },
            },
        },
    },
    {
        "name": "git_operations",
        "display_name": "Git Operations",
        "description": (
            "Perform Git operations: status, diff, log, commit, branch, "
            "checkout, and more."
        ),
        "category": "version_control",
        "requires_download": False,
        "usage_hint": (
            "Let the agent manage version control autonomously - "
            "create branches, commit changes, view history."
        ),
        "schema": {
            "type": "function",
            "function": {
                "name": "git_operations",
                "description": "Perform a Git operation.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "operation": {
                            "type": "string",
                            "enum": [
                                "status",
                                "diff",
                                "log",
                                "commit",
                                "branch",
                                "checkout",
                            ],
                            "description": "Git operation to perform.",
                        },
                        "args": {
                            "type": "string",
                            "description": "Additional arguments.",
                        },
                    },
                    "required": ["operation"],
                },
            },
        },
    },
    {
        "name": "python_exec",
        "display_name": "Python Executor",
        "description": (
            "Execute Python code snippets in a sandboxed subprocess. "
            "Useful for data processing, calculations, or quick scripts."
        ),
        "category": "development",
        "requires_download": False,
        "usage_hint": (
            "The agent can write and run Python code on the fly for "
            "data analysis, API calls, or prototyping solutions."
        ),
        "schema": {
            "type": "function",
            "function": {
                "name": "python_exec",
                "description": "Execute Python code and return output.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "code": {
                            "type": "string",
                            "description": "Python code to execute.",
                        },
                    },
                    "required": ["code"],
                },
            },
        },
    },
    {
        "name": "docker_manage",
        "display_name": "Docker Manager",
        "description": (
            "Manage Docker containers and images. Build, run, stop, "
            "and inspect containers."
        ),
        "category": "infrastructure",
        "requires_download": True,
        "usage_hint": (
            "Requires Docker to be installed. Use 'docker_manage' to "
            "spin up isolated environments for testing or deployment."
        ),
        "schema": {
            "type": "function",
            "function": {
                "name": "docker_manage",
                "description": "Manage Docker resources.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "action": {
                            "type": "string",
                            "enum": [
                                "build",
                                "run",
                                "stop",
                                "ps",
                                "images",
                                "logs",
                            ],
                            "description": "Docker action to perform.",
                        },
                        "args": {
                            "type": "string",
                            "description": "Additional Docker arguments.",
                        },
                    },
                    "required": ["action"],
                },
            },
        },
    },
]


def get_all_tools():
    """Return all built-in tools.

    Returns:
        List of tool definition dicts.
    """
    return list(BUILTIN_TOOLS)


def get_tools_by_category(category):
    """Return tools filtered by category.

    Args:
        category: Category string (e.g. 'system', 'filesystem', 'web').

    Returns:
        Filtered list of tool dicts.
    """
    return [t for t in BUILTIN_TOOLS if t.get("category") == category]


def get_tool_categories():
    """Return sorted list of unique tool categories.

    Returns:
        List of category strings.
    """
    return sorted({t.get("category", "other") for t in BUILTIN_TOOLS})


def get_tool_by_name(name):
    """Look up a single tool by its name.

    Args:
        name: Tool name string.

    Returns:
        Tool dict or None.
    """
    for t in BUILTIN_TOOLS:
        if t["name"] == name:
            return t
    return None


def get_tool_schemas(tool_names):
    """Return OpenAI-compatible tool schemas for the given tool names.

    Args:
        tool_names: List of tool name strings.

    Returns:
        List of schema dicts ready for the API ``tools`` parameter.
    """
    schemas = []
    for name in tool_names:
        tool = get_tool_by_name(name)
        if tool:
            schemas.append(tool["schema"])
    return schemas


def format_tool_info(tool):
    """Format a tool dict into a human-readable string.

    Args:
        tool: Tool definition dict.

    Returns:
        Formatted string.
    """
    download = "Yes (install required)" if tool.get("requires_download") else "No"
    return (
        f"{tool['display_name']} [{tool['name']}]\n"
        f"  Category:  {tool.get('category', 'N/A')}\n"
        f"  Download:  {download}\n"
        f"  Hint:      {tool.get('usage_hint', '')}\n"
        f"  Description: {tool.get('description', '')}"
    )
