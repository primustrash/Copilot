"""Tests for copilot_agent.models module."""

from copilot_agent.models import (
    filter_models,
    format_model_info,
    select_model_by_index,
)


SAMPLE_MODELS = [
    {
        "id": "gpt-4o",
        "name": "GPT-4o",
        "version": "latest",
        "description": "OpenAI GPT-4o",
        "capabilities": ["chat", "function_calling", "vision"],
        "source": "github-copilot",
    },
    {
        "id": "claude-sonnet-4",
        "name": "Claude Sonnet 4",
        "version": "latest",
        "description": "Anthropic Claude",
        "capabilities": ["chat", "function_calling"],
        "source": "github-copilot",
    },
    {
        "id": "gemini-2.0-flash",
        "name": "Gemini 2.0 Flash",
        "version": "latest",
        "description": "Google Gemini",
        "capabilities": ["chat", "vision"],
        "source": "github-models",
    },
]


class TestFilterModels:
    def test_no_filter_returns_all(self):
        result = filter_models(SAMPLE_MODELS)
        assert len(result) == 3

    def test_filter_by_capability(self):
        result = filter_models(SAMPLE_MODELS, capability="vision")
        assert len(result) == 2
        ids = {m["id"] for m in result}
        assert "gpt-4o" in ids
        assert "gemini-2.0-flash" in ids

    def test_filter_by_source(self):
        result = filter_models(SAMPLE_MODELS, source="github-models")
        assert len(result) == 1
        assert result[0]["id"] == "gemini-2.0-flash"

    def test_filter_by_both(self):
        result = filter_models(SAMPLE_MODELS, capability="function_calling", source="github-copilot")
        assert len(result) == 2

    def test_filter_no_match(self):
        result = filter_models(SAMPLE_MODELS, capability="nonexistent")
        assert len(result) == 0


class TestFormatModelInfo:
    def test_format_contains_name(self):
        info = format_model_info(SAMPLE_MODELS[0])
        assert "GPT-4o" in info

    def test_format_contains_capabilities(self):
        info = format_model_info(SAMPLE_MODELS[0])
        assert "chat" in info
        assert "function_calling" in info


class TestSelectModelByIndex:
    def test_valid_index(self):
        model = select_model_by_index(SAMPLE_MODELS, 0)
        assert model["id"] == "gpt-4o"

    def test_last_index(self):
        model = select_model_by_index(SAMPLE_MODELS, 2)
        assert model["id"] == "gemini-2.0-flash"

    def test_negative_index(self):
        assert select_model_by_index(SAMPLE_MODELS, -1) is None

    def test_out_of_range(self):
        assert select_model_by_index(SAMPLE_MODELS, 99) is None
