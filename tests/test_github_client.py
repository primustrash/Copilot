"""Tests for copilot_agent.github_client module."""

import json
from unittest.mock import MagicMock, patch

import pytest

from copilot_agent.github_client import GitHubClient


class TestGitHubClientInit:
    def test_requires_token(self):
        with pytest.raises(ValueError, match="GitHub token is required"):
            GitHubClient("")

    def test_none_token_raises(self):
        with pytest.raises(ValueError, match="GitHub token is required"):
            GitHubClient(None)

    def test_valid_token(self):
        client = GitHubClient("ghp_test123")
        assert client.token == "ghp_test123"


class TestNormalizeModel:
    def test_normalize_with_all_fields(self):
        client = GitHubClient("ghp_test")
        raw = {
            "id": "gpt-4o",
            "name": "GPT-4o",
            "version": "2024-01",
            "description": "A model",
            "capabilities": ["chat"],
            "source": "copilot",
        }
        result = client._normalize_model(raw)
        assert result["id"] == "gpt-4o"
        assert result["name"] == "GPT-4o"
        assert result["version"] == "2024-01"

    def test_normalize_with_missing_fields(self):
        client = GitHubClient("ghp_test")
        raw = {"name": "test-model"}
        result = client._normalize_model(raw)
        assert result["id"] == "test-model"
        assert result["name"] == "test-model"
        assert result["version"] == "latest"


class TestGetWellKnownModels:
    def test_returns_models(self):
        client = GitHubClient("ghp_test")
        models = client._get_well_known_models()
        assert isinstance(models, list)
        assert len(models) > 0

    def test_models_have_required_fields(self):
        client = GitHubClient("ghp_test")
        for m in client._get_well_known_models():
            assert "id" in m
            assert "name" in m
            assert "capabilities" in m


class TestGetCopilotModels:
    @patch("copilot_agent.github_client.requests.Session")
    def test_falls_back_to_well_known(self, mock_session_cls):
        """When API calls fail, well-known models are returned."""
        mock_session = MagicMock()
        mock_resp = MagicMock()
        mock_resp.status_code = 401
        mock_session.get.return_value = mock_resp
        mock_session_cls.return_value = mock_session

        client = GitHubClient.__new__(GitHubClient)
        client.token = "ghp_test"
        client.session = mock_session

        models = client.get_copilot_models()
        assert isinstance(models, list)
        assert len(models) > 0
        # Should be well-known models
        ids = {m["id"] for m in models}
        assert "gpt-4o" in ids
