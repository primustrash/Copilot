"""No credential fixtures or stale checksum entries in a clean Copilot checkout."""
import hashlib
import pathlib
import subprocess
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "AGENT_FILES.md5"
SENSITIVE = {".mcp/.env.local", ".mcp/mcp-config.local.json"}

class AgentIntegrityTests(unittest.TestCase):
    def test_manifest_lists_only_tracked_files(self):
        contents = MANIFEST.read_text(encoding="utf-8")
        paths = []
        for line in contents.splitlines():
            digest, sep, path = line.partition("  ")
            self.assertEqual(len(digest), 32)
            self.assertTrue(sep)
            self.assertNotIn(path, SENSITIVE)
            self.assertNotEqual(path, "AGENT_FILES.md5")
            self.assertTrue((ROOT / path).is_file(), path)
            self.assertEqual(hashlib.md5((ROOT / path).read_bytes()).hexdigest(), digest, path)
            paths.append(path)
        self.assertEqual(len(paths), len(set(paths)))
        self.assertIn("AGENTS.md", paths)
        self.assertIn(".gitignore", paths)

    def test_local_secrets_are_ignored(self):
        for path in SENSITIVE:
            result = subprocess.run(
                ["git", "check-ignore", "-q", "--", path],
                cwd=ROOT, check=False,
            )
            self.assertEqual(result.returncode, 0, path + " is not ignored")

    def test_agent_frontmatter_is_complete(self):
        profiles = sorted((ROOT / ".github/agents").glob("*.agent.md"))
        self.assertEqual(len(profiles), 6)
        for profile in profiles:
            data = profile.read_text(encoding="utf-8")
            self.assertTrue(data.startswith("---\n"), profile.name)
            head = data.split("\n---\n", 1)[0]
            for name in ("name", "description", "target", "tools",
                         "user-invocable", "disable-model-invocation"):
                self.assertIn("\n" + name + ":", head, profile.name)

if __name__ == "__main__":
    unittest.main()
