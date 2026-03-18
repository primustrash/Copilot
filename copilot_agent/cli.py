"""Interactive CLI for the Copilot Agent Launcher.

Provides an interactive menu to:
  1. Authenticate with GitHub
  2. List and select available models
  3. Browse and select tools
  4. Configure agent settings
  5. Launch an agent (CLI / local / cloud)
"""

import sys

from copilot_agent.agent import AgentRunner
from copilot_agent.config import get_default_config, get_github_token, load_config, save_config
from copilot_agent.github_client import GitHubClient
from copilot_agent.models import filter_models, format_model_info, list_models, select_model_by_index
from copilot_agent.tools import (
    format_tool_info,
    get_all_tools,
    get_tool_by_name,
    get_tool_categories,
    get_tools_by_category,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _print_header(text):
    width = max(len(text) + 4, 50)
    print("\n" + "=" * width)
    print(f"  {text}")
    print("=" * width)


def _print_separator():
    print("-" * 50)


def _prompt_choice(prompt_text, valid_range=None, allow_empty=False):
    """Prompt the user for input and return the stripped string.

    Args:
        prompt_text: Text shown to the user.
        valid_range: Optional range of valid integer choices.
        allow_empty: If True, empty input is accepted.

    Returns:
        User input string or None on interrupt.
    """
    while True:
        try:
            choice = input(prompt_text).strip()
        except (EOFError, KeyboardInterrupt):
            return None
        if not choice and allow_empty:
            return ""
        if not choice:
            continue
        if valid_range is not None:
            try:
                val = int(choice)
                if val in valid_range:
                    return choice
                print(f"  Please enter a number between {valid_range.start} and {valid_range.stop - 1}.")
            except ValueError:
                if choice.lower() in ("q", "quit", "back"):
                    return choice
                print("  Invalid input. Enter a number or 'q' to go back.")
        else:
            return choice


def _prompt_multi_select(items, prompt_text="Select items (comma-separated numbers): "):
    """Let the user select multiple items by number.

    Args:
        items: List of items to select from.
        prompt_text: Prompt text.

    Returns:
        List of selected indices (0-based).
    """
    raw = _prompt_choice(prompt_text, allow_empty=True)
    if raw is None or raw.lower() in ("q", "quit", "back"):
        return []
    if not raw:
        return []
    selected = []
    for part in raw.split(","):
        part = part.strip()
        # Support ranges like "1-3"
        if "-" in part:
            try:
                start, end = part.split("-", 1)
                for i in range(int(start), int(end) + 1):
                    idx = i - 1
                    if 0 <= idx < len(items):
                        selected.append(idx)
            except ValueError:
                pass
        else:
            try:
                idx = int(part) - 1
                if 0 <= idx < len(items):
                    selected.append(idx)
            except ValueError:
                pass
    return sorted(set(selected))


# ---------------------------------------------------------------------------
# Menu actions
# ---------------------------------------------------------------------------


def _show_architecture():
    """Print an overview of the system architecture."""
    _print_header("Architecture Overview")
    print("""
┌─────────────────────────────────────────────────────────────┐
│                 Copilot Agent Launcher                       │
├──────────┬──────────────┬──────────────┬────────────────────┤
│  GitHub  │    Models    │    Tools     │  Agent Runner      │
│  Client  │   Manager    │   Catalog    │  (CLI/Cloud)       │
├──────────┴──────────────┴──────────────┴────────────────────┤
│                     Configuration                            │
│               (YAML / Environment / CLI)                     │
└─────────────────────────────────────────────────────────────┘

Components:
-----------
1. GitHub Client   — Authenticates with your GitHub token and queries
                     the API for available Copilot and Marketplace models.

2. Models Manager  — Lists, filters, and lets you pick a model.
                     Supports filtering by capability (chat, vision,
                     function_calling) and source (copilot, marketplace).

3. Tools Catalog   — Curated set of tools the agent can call:
                     shell commands, file I/O, code analysis, git,
                     Python execution, Docker, web search, and more.
                     Each tool follows the OpenAI function-calling schema.

4. Agent Runner    — Sends your prompt + selected tools to the model,
                     receives tool-call requests, executes them locally,
                     and feeds results back. Runs in a CLI loop.

5. Configuration   — YAML config file + environment variables.
                     Stores defaults for model, tools, temperature, etc.

How it works:
-------------
  a) Set GITHUB_TOKEN in your environment.
  b) Run: python -m copilot_agent
  c) The launcher queries GitHub for models you can access.
  d) Pick a model and tools from the interactive menu.
  e) Start the agent — it opens a chat loop where you type prompts.
  f) The model can call any enabled tool; results are executed locally
     and sent back to the model automatically.

Tool download:
--------------
  Most tools (shell, file I/O, git, Python) need NO download — they use
  programs already on your machine. Tools marked 'requires_download'
  (e.g. Docker) need their respective software installed first.
""")


def _authenticate(config):
    """Authenticate and return a GitHubClient or None."""
    token = get_github_token(config)
    if not token:
        print("\n⚠  No GITHUB_TOKEN found in environment.")
        print("   Set it with:  export GITHUB_TOKEN=ghp_your_token")
        raw = _prompt_choice("   Or paste your token now (leave empty to skip): ", allow_empty=True)
        if raw:
            token = raw
        else:
            return None

    client = GitHubClient(token)
    user = client.validate_token()
    if user:
        print(f"\n✅ Authenticated as: {user.get('login', 'unknown')}")
        return client
    else:
        print("\n❌ Token validation failed. Check your token and try again.")
        return None


def _browse_models(client):
    """List models and let the user pick one. Returns selected model or None."""
    _print_header("Available Models")
    models = list_models(client)

    if not models:
        print("  No models found.")
        return None

    for i, m in enumerate(models, 1):
        caps = ", ".join(m.get("capabilities", []))
        print(f"  [{i}] {m['name']}  ({m['id']})")
        print(f"      {m.get('description', '')}")
        print(f"      Capabilities: {caps}")
        print()

    _print_separator()
    print("  Filter options:")
    print("    'all'   — show all (default)")
    print("    'chat'  — only chat-capable")
    print("    'tools' — only function-calling capable")
    print("    'vision'— only vision-capable")

    filt = _prompt_choice("  Filter or select number [all]: ", allow_empty=True)
    if filt and filt.lower() in ("chat", "tools", "vision"):
        cap = "function_calling" if filt == "tools" else filt
        models = filter_models(models, capability=cap)
        print()
        for i, m in enumerate(models, 1):
            print(f"  [{i}] {m['name']}  ({m['id']})")
        print()

    choice = _prompt_choice(
        f"  Select model [1-{len(models)}] or 'q' to go back: ",
        valid_range=range(1, len(models) + 1),
    )
    if choice is None or choice.lower() in ("q", "quit", "back"):
        return None

    selected = select_model_by_index(models, int(choice) - 1)
    if selected:
        print(f"\n  ✅ Selected: {selected['name']}")
        print(f"  {format_model_info(selected)}")
    return selected


def _browse_tools():
    """Let the user browse and select tools. Returns list of tool names."""
    _print_header("Available Tools")

    tools = get_all_tools()
    categories = get_tool_categories()

    print("  Categories:", ", ".join(categories))
    print()

    for i, t in enumerate(tools, 1):
        dl = " ⬇ " if t.get("requires_download") else "   "
        print(f"  [{i}]{dl}{t['display_name']}  [{t['name']}]  ({t['category']})")
        print(f"       {t.get('usage_hint', '')}")
        print()

    _print_separator()
    print("  Select tools by number (comma-separated, e.g. '1,2,5')")
    print("  Use ranges: '1-4' or 'all' for everything.")
    print("  Press Enter for default set (shell, file_read, file_write, git).")

    raw = _prompt_choice("  Your selection: ", allow_empty=True)

    if raw is None or raw.lower() in ("q", "quit", "back"):
        return []

    if not raw or raw.lower() == "default":
        defaults = ["shell_exec", "file_read", "file_write", "git_operations"]
        print(f"  Using defaults: {', '.join(defaults)}")
        return defaults

    if raw.lower() == "all":
        names = [t["name"] for t in tools]
        print(f"  Selected all {len(names)} tools.")
        return names

    indices = _prompt_multi_select(tools, prompt_text="")
    if not indices:
        # Try parsing raw directly
        indices = []
        for part in raw.split(","):
            part = part.strip()
            if "-" in part:
                try:
                    s, e = part.split("-", 1)
                    for x in range(int(s), int(e) + 1):
                        idx = x - 1
                        if 0 <= idx < len(tools):
                            indices.append(idx)
                except ValueError:
                    pass
            else:
                try:
                    idx = int(part) - 1
                    if 0 <= idx < len(tools):
                        indices.append(idx)
                except ValueError:
                    pass

    selected = [tools[i]["name"] for i in sorted(set(indices))]
    if selected:
        print(f"  ✅ Selected tools: {', '.join(selected)}")
    else:
        print("  No valid tools selected.")
    return selected


def _configure_agent(config):
    """Let the user tweak agent settings. Returns updated agent config dict."""
    _print_header("Agent Configuration")

    agent_cfg = dict(config.get("agent", {}))
    defaults = get_default_config()["agent"]

    print(f"  1. Mode:           {agent_cfg.get('mode', defaults['mode'])}")
    print(f"  2. Temperature:    {agent_cfg.get('temperature', defaults['temperature'])}")
    print(f"  3. Max iterations: {agent_cfg.get('max_iterations', defaults['max_iterations'])}")
    print(f"  4. System prompt:  {agent_cfg.get('system_prompt', defaults['system_prompt'])[:60]}...")
    print()
    print("  Enter setting number to change, or press Enter to keep defaults.")

    while True:
        choice = _prompt_choice("  Setting to change (1-4) or Enter to continue: ", allow_empty=True)
        if choice is None or not choice:
            break

        if choice == "1":
            mode = _prompt_choice("    Mode [cli/cloud]: ", allow_empty=True)
            if mode in ("cli", "cloud"):
                agent_cfg["mode"] = mode
        elif choice == "2":
            temp = _prompt_choice("    Temperature (0.0-2.0): ", allow_empty=True)
            if temp:
                try:
                    agent_cfg["temperature"] = max(0.0, min(2.0, float(temp)))
                except ValueError:
                    print("    Invalid number.")
        elif choice == "3":
            iters = _prompt_choice("    Max iterations (1-50): ", allow_empty=True)
            if iters:
                try:
                    agent_cfg["max_iterations"] = max(1, min(50, int(iters)))
                except ValueError:
                    print("    Invalid number.")
        elif choice == "4":
            prompt = _prompt_choice("    System prompt: ", allow_empty=True)
            if prompt:
                agent_cfg["system_prompt"] = prompt
        else:
            break

    print("\n  Current agent configuration:")
    for k, v in agent_cfg.items():
        val = str(v) if len(str(v)) < 60 else str(v)[:60] + "..."
        print(f"    {k}: {val}")

    return agent_cfg


def _launch_agent(model, tool_names, agent_cfg, token):
    """Launch the agent with the given configuration."""
    if not model:
        print("\n⚠  No model selected. Go back and select a model first.")
        return
    if not token:
        print("\n⚠  No GitHub token available. Authenticate first.")
        return

    _print_header("Launching Agent")
    print(f"  Model:  {model['name']} ({model['id']})")
    print(f"  Tools:  {', '.join(tool_names) or 'none'}")
    print(f"  Mode:   {agent_cfg.get('mode', 'cli')}")
    _print_separator()

    runner = AgentRunner(
        model_id=model["id"],
        tool_names=tool_names,
        config=agent_cfg,
        github_token=token,
    )
    runner.start()


# ---------------------------------------------------------------------------
# Main menu
# ---------------------------------------------------------------------------


def main():
    """Entry point — display the main interactive menu."""
    config = load_config()
    client = None
    selected_model = None
    selected_tools = []
    agent_cfg = config.get("agent", get_default_config()["agent"])

    _print_header("Copilot Agent Launcher")
    print("  A tool to discover GitHub models, configure tools,")
    print("  and run AI agents locally or in the cloud.\n")

    while True:
        _print_separator()
        status_model = selected_model["name"] if selected_model else "none"
        status_tools = len(selected_tools)
        status_auth = "✅" if client else "❌"

        print(f"  Auth: {status_auth}  |  Model: {status_model}  |  Tools: {status_tools}")
        print()
        print("  [1] 📖  Architecture overview")
        print("  [2] 🔑  Authenticate with GitHub")
        print("  [3] 🤖  Browse & select models")
        print("  [4] 🔧  Browse & select tools")
        print("  [5] ⚙️   Configure agent settings")
        print("  [6] 🚀  Launch agent")
        print("  [7] 💾  Save configuration")
        print("  [0] 🚪  Exit")
        print()

        choice = _prompt_choice("  Select [0-7]: ", valid_range=range(0, 8))
        if choice is None or choice == "0":
            print("\nGoodbye! 👋")
            sys.exit(0)

        choice = int(choice)

        if choice == 1:
            _show_architecture()

        elif choice == 2:
            client = _authenticate(config)

        elif choice == 3:
            if not client:
                print("\n⚠  Please authenticate first (option 2).")
                continue
            model = _browse_models(client)
            if model:
                selected_model = model

        elif choice == 4:
            tools = _browse_tools()
            if tools:
                selected_tools = tools

        elif choice == 5:
            agent_cfg = _configure_agent(config)
            config["agent"] = agent_cfg

        elif choice == 6:
            token = get_github_token(config) or (
                client.token if client else None
            )
            _launch_agent(selected_model, selected_tools, agent_cfg, token)

        elif choice == 7:
            if selected_model:
                config["default_model"] = selected_model["id"]
            if selected_tools:
                config["default_tools"] = selected_tools
            config["agent"] = agent_cfg
            save_config(config)
            print("\n  ✅ Configuration saved to configs/default.yaml")


if __name__ == "__main__":
    main()
