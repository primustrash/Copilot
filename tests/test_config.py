"""Tests for copilot_agent.config module."""

import os
import tempfile

import pytest
import yaml

from copilot_agent.config import (
    get_default_config,
    get_github_token,
    load_config,
    save_config,
)


class TestGetDefaultConfig:
    def test_returns_dict(self):
        cfg = get_default_config()
        assert isinstance(cfg, dict)

    def test_contains_required_keys(self):
        cfg = get_default_config()
        assert "github_token_env" in cfg
        assert "default_model" in cfg
        assert "default_tools" in cfg
        assert "agent" in cfg

    def test_agent_has_required_keys(self):
        cfg = get_default_config()
        agent = cfg["agent"]
        assert "mode" in agent
        assert "max_iterations" in agent
        assert "temperature" in agent
        assert "system_prompt" in agent


class TestLoadConfig:
    def test_load_missing_file_returns_defaults(self):
        cfg = load_config("/nonexistent/path/config.yaml")
        assert cfg == get_default_config()

    def test_load_valid_yaml(self):
        data = {"github_token_env": "MY_TOKEN", "default_model": "gpt-4o"}
        with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False) as f:
            yaml.dump(data, f)
            path = f.name
        try:
            cfg = load_config(path)
            assert cfg["github_token_env"] == "MY_TOKEN"
            assert cfg["default_model"] == "gpt-4o"
        finally:
            os.unlink(path)


class TestSaveConfig:
    def test_save_and_reload(self):
        data = {"github_token_env": "TOK", "agent": {"mode": "cloud"}}
        with tempfile.TemporaryDirectory() as tmpdir:
            path = os.path.join(tmpdir, "test.yaml")
            save_config(data, path)
            loaded = load_config(path)
            assert loaded == data


class TestGetGithubToken:
    def test_returns_token_from_env(self, monkeypatch):
        monkeypatch.setenv("GITHUB_TOKEN", "ghp_test123")
        token = get_github_token()
        assert token == "ghp_test123"

    def test_returns_none_when_missing(self, monkeypatch):
        monkeypatch.delenv("GITHUB_TOKEN", raising=False)
        token = get_github_token()
        assert token is None

    def test_custom_env_var(self, monkeypatch):
        monkeypatch.setenv("MY_GH_TOKEN", "ghp_custom")
        cfg = {"github_token_env": "MY_GH_TOKEN"}
        token = get_github_token(cfg)
        assert token == "ghp_custom"
