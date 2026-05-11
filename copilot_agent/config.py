"""Configuration management for Copilot Agent Launcher."""

import os
import yaml


DEFAULT_CONFIG_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "configs",
    "default.yaml",
)


def load_config(path=None):
    """Load configuration from a YAML file.

    Args:
        path: Path to config file. Uses default.yaml if not specified.

    Returns:
        dict with configuration values.
    """
    config_path = path or DEFAULT_CONFIG_PATH
    if os.path.exists(config_path):
        with open(config_path, "r") as f:
            return yaml.safe_load(f) or {}
    return get_default_config()


def get_default_config():
    """Return default configuration values."""
    return {
        "github_token_env": "GITHUB_TOKEN",
        "default_model": None,
        "default_tools": [],
        "agent": {
            "mode": "cli",
            "max_iterations": 10,
            "temperature": 0.7,
            "system_prompt": "You are a helpful coding assistant.",
        },
    }


def save_config(config, path=None):
    """Save configuration to a YAML file.

    Args:
        config: Configuration dictionary.
        path: Path to save to. Uses default.yaml if not specified.
    """
    config_path = path or DEFAULT_CONFIG_PATH
    os.makedirs(os.path.dirname(config_path), exist_ok=True)
    with open(config_path, "w") as f:
        yaml.dump(config, f, default_flow_style=False, sort_keys=False)


def get_github_token(config=None):
    """Retrieve GitHub token from environment.

    Args:
        config: Optional config dict specifying token env var name.

    Returns:
        Token string or None.
    """
    if config is None:
        config = get_default_config()
    env_var = config.get("github_token_env", "GITHUB_TOKEN")
    return os.environ.get(env_var)
