"""Non-flashing firmware ZIP intake security regressions."""
import hashlib
import importlib.util
from pathlib import Path
import stat
import tempfile
import unittest
import zipfile

SOURCE = Path(__file__).resolve().parents[1] / "scripts/safe_verify_firmware_zip.py"
spec = importlib.util.spec_from_file_location("safe_firmware", SOURCE)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class FirmwareZipTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.zipfile = self.root / "official.zip"
        self.out = self.root / "extracted"

    def make_zip(self, entries):
        with zipfile.ZipFile(self.zipfile, "w") as z:
            for key, payload in entries:
                if isinstance(key, zipfile.ZipInfo):
                    z.writestr(key, payload)
                else:
                    z.writestr(key, payload)
        return hashlib.sha256(self.zipfile.read_bytes()).hexdigest()

    def test_valid_archive_digest_required(self):
        digest = self.make_zip([("firmware.bin", b"\x01\x02")])
        result = module.check_zip(self.zipfile, digest, self.out)
        self.assertFalse(result["flash_permitted"])
        self.assertFalse(result["hardware_compatibility_verified"])
        self.assertEqual((self.out / "firmware.bin").read_bytes(), b"\x01\x02")

    def test_wrong_digest_rejected_without_extraction(self):
        self.make_zip([("firmware.bin", b"bin")])
        with self.assertRaisesRegex(ValueError, "does not match"):
            module.check_zip(self.zipfile, "0" * 64, self.out)
        self.assertFalse(self.out.exists())

    def test_path_traversal_rejected_before_extraction(self):
        digest = self.make_zip([("../stolen", b"bad")])
        with self.assertRaisesRegex(ValueError, "Unsafe ZIP member"):
            module.check_zip(self.zipfile, digest, self.out)
        self.assertFalse(self.out.exists())
        self.assertFalse((self.root / "stolen").exists())

    def test_absolute_path_rejected(self):
        digest = self.make_zip([("/tmp/escape", b"bad")])
        with self.assertRaisesRegex(ValueError, "Unsafe ZIP member"):
            module.check_zip(self.zipfile, digest, self.out)
        self.assertFalse(self.out.exists())

    def test_symlink_entry_rejected(self):
        link = zipfile.ZipInfo("link")
        link.create_system = 3
        link.external_attr = (stat.S_IFLNK | 0o777) << 16
        digest = self.make_zip([(link, "/etc/passwd")])
        with self.assertRaisesRegex(ValueError, "Symlink"):
            module.check_zip(self.zipfile, digest, self.out)
        self.assertFalse(self.out.exists())

    def test_existing_destination_rejected(self):
        digest = self.make_zip([("firmware.bin", b"ok")])
        self.out.mkdir()
        with self.assertRaisesRegex(ValueError, "Destination exists"):
            module.check_zip(self.zipfile, digest, self.out)

    def test_symlinked_extraction_parent_rejected(self):
        digest = self.make_zip([("firmware.bin", b"data")])
        linked = self.root / "linked"
        linked.symlink_to(self.root, target_is_directory=True)
        with self.assertRaisesRegex(ValueError, "Symlink in extraction"):
            module.check_zip(self.zipfile, digest, linked / "new-extraction")
        self.assertFalse((self.root / "new-extraction").exists())

    def test_partial_extraction_cleans_up_after_member_collision(self):
        # ZIP is byte-valid but cannot be mapped onto a safe filesystem tree.
        digest = self.make_zip([("entry", b"regular-file"), ("entry/nested", b"not-a-directory")])
        with self.assertRaises((OSError, ValueError)):
            module.check_zip(self.zipfile, digest, self.out)
        self.assertFalse(self.out.exists())

    def test_member_size_limit_rejected_before_creation(self):
        digest = self.make_zip([("big.bin", b"a" * 200)])
        old = module.MAX_MEMBER_BYTES
        try:
            module.MAX_MEMBER_BYTES = 100
            with self.assertRaisesRegex(ValueError, "too large"):
                module.check_zip(self.zipfile, digest, self.out)
        finally:
            module.MAX_MEMBER_BYTES = old
        self.assertFalse(self.out.exists())


if __name__ == "__main__":
    unittest.main()
