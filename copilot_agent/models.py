"""Model management - listing, filtering, and selecting models."""


def list_models(github_client):
    """Fetch and return all available models.

    Args:
        github_client: An authenticated GitHubClient instance.

    Returns:
        List of model dicts.
    """
    return github_client.get_copilot_models()


def filter_models(models, capability=None, source=None):
    """Filter models by capability or source.

    Args:
        models: List of model dicts.
        capability: Optional capability string to filter by (e.g. 'chat').
        source: Optional source string to filter by (e.g. 'github-copilot').

    Returns:
        Filtered list of model dicts.
    """
    result = models
    if capability:
        result = [m for m in result if capability in m.get("capabilities", [])]
    if source:
        result = [m for m in result if m.get("source") == source]
    return result


def format_model_info(model):
    """Format a model dict into a human-readable string.

    Args:
        model: Model dict.

    Returns:
        Formatted string.
    """
    caps = ", ".join(model.get("capabilities", [])) or "N/A"
    return (
        f"{model['name']} ({model['id']})\n"
        f"  Version:      {model.get('version', 'N/A')}\n"
        f"  Source:       {model.get('source', 'N/A')}\n"
        f"  Capabilities: {caps}\n"
        f"  Description:  {model.get('description', 'N/A')}"
    )


def select_model_by_index(models, index):
    """Select a model by its list index.

    Args:
        models: List of model dicts.
        index: Zero-based index.

    Returns:
        Model dict or None if index is out of range.
    """
    if 0 <= index < len(models):
        return models[index]
    return None
