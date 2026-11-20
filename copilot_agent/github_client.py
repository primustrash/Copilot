"""GitHub API client for discovering Copilot models and capabilities."""

import requests

GITHUB_API_BASE = "https://api.github.com"
GITHUB_MODELS_API = "https://api.github.com/marketplace_listing/models"
GITHUB_COPILOT_MODELS_API = "https://api.github.com/copilot_internal/v2/models"


class GitHubClient:
    """Client for interacting with GitHub APIs to discover models."""

    def __init__(self, token):
        """Initialize with a GitHub personal access token.

        Args:
            token: GitHub personal access token with appropriate scopes.
        """
        if not token:
            raise ValueError(
                "GitHub token is required. Set the GITHUB_TOKEN environment variable."
            )
        self.token = token
        self.session = requests.Session()
        self.session.headers.update(
            {
                "Authorization": f"token {token}",
                "Accept": "application/json",
                "X-GitHub-Api-Version": "2022-11-28",
            }
        )

    def get_copilot_models(self):
        """Fetch available Copilot models from the GitHub API.

        Tries multiple API endpoints to discover available models.

        Returns:
            List of model dicts with at least 'id' and 'name' keys.
        """
        models = []

        # Try the Copilot models endpoint
        models.extend(self._fetch_copilot_models())

        # Try the GitHub Models (marketplace) endpoint
        models.extend(self._fetch_marketplace_models())

        # Deduplicate by model id
        seen = set()
        unique = []
        for m in models:
            mid = m.get("id") or m.get("name", "")
            if mid not in seen:
                seen.add(mid)
                unique.append(m)

        # If no models found from API, return well-known defaults
        if not unique:
            unique = self._get_well_known_models()

        return unique

    def _fetch_copilot_models(self):
        """Fetch models from the Copilot internal API."""
        try:
            resp = self.session.get(
                f"{GITHUB_API_BASE}/copilot_internal/v2/models",
                timeout=10,
            )
            if resp.status_code == 200:
                data = resp.json()
                if isinstance(data, list):
                    return [self._normalize_model(m) for m in data]
                if isinstance(data, dict) and "models" in data:
                    return [self._normalize_model(m) for m in data["models"]]
        except (requests.RequestException, ValueError):
            pass
        return []

    def _fetch_marketplace_models(self):
        """Fetch models from the GitHub Models marketplace API."""
        try:
            resp = self.session.get(
                f"{GITHUB_API_BASE}/marketplace_listing/models",
                timeout=10,
            )
            if resp.status_code == 200:
                data = resp.json()
                if isinstance(data, list):
                    return [self._normalize_model(m) for m in data]
        except (requests.RequestException, ValueError):
            pass
        return []

    def _normalize_model(self, raw):
        """Normalize a raw API model response into a consistent dict.

        Args:
            raw: Raw model dict from an API response.

        Returns:
            Normalized model dict.
        """
        return {
            "id": raw.get("id") or raw.get("name", "unknown"),
            "name": raw.get("name") or raw.get("id", "unknown"),
            "version": raw.get("version", "latest"),
            "description": raw.get("description", ""),
            "capabilities": raw.get("capabilities", []),
            "source": raw.get("source", "github"),
        }

    def _get_well_known_models(self):
        """Return a curated list of well-known GitHub Copilot models.

        These are models commonly available through GitHub Copilot
        and GitHub Models marketplace.
        """
        return [
            {
                "id": "gpt-4o",
                "name": "GPT-4o",
                "version": "latest",
                "description": "OpenAI GPT-4o - fast multimodal model",
                "capabilities": ["chat", "function_calling", "vision"],
                "source": "github-copilot",
            },
            {
                "id": "gpt-4o-mini",
                "name": "GPT-4o Mini",
                "version": "latest",
                "description": "OpenAI GPT-4o Mini - efficient and affordable",
                "capabilities": ["chat", "function_calling"],
                "source": "github-copilot",
            },
            {
                "id": "gpt-4.1",
                "name": "GPT-4.1",
                "version": "latest",
                "description": "OpenAI GPT-4.1 - advanced reasoning model",
                "capabilities": ["chat", "function_calling", "vision"],
                "source": "github-copilot",
            },
            {
                "id": "claude-sonnet-4",
                "name": "Claude Sonnet 4",
                "version": "latest",
                "description": "Anthropic Claude Sonnet 4 - strong coding model",
                "capabilities": ["chat", "function_calling"],
                "source": "github-copilot",
            },
            {
                "id": "claude-haiku-3.5",
                "name": "Claude 3.5 Haiku",
                "version": "latest",
                "description": "Anthropic Claude 3.5 Haiku - fast and efficient",
                "capabilities": ["chat", "function_calling"],
                "source": "github-copilot",
            },
            {
                "id": "o3-mini",
                "name": "o3-mini",
                "version": "latest",
                "description": "OpenAI o3-mini - reasoning model",
                "capabilities": ["chat", "function_calling"],
                "source": "github-copilot",
            },
            {
                "id": "gemini-2.0-flash",
                "name": "Gemini 2.0 Flash",
                "version": "latest",
                "description": "Google Gemini 2.0 Flash - fast multimodal model",
                "capabilities": ["chat", "function_calling", "vision"],
                "source": "github-models",
            },
        ]

    def validate_token(self):
        """Validate the GitHub token by checking the authenticated user.

        Returns:
            dict with user info or None if invalid.
        """
        try:
            resp = self.session.get(f"{GITHUB_API_BASE}/user", timeout=10)
            if resp.status_code == 200:
                return resp.json()
        except requests.RequestException:
            pass
        return None

    def get_copilot_status(self):
        """Check if the authenticated user has Copilot access.

        Returns:
            dict with Copilot status or None.
        """
        try:
            resp = self.session.get(
                f"{GITHUB_API_BASE}/copilot_internal/v2/token",
                timeout=10,
            )
            if resp.status_code == 200:
                return resp.json()
        except requests.RequestException:
            pass
        return None
