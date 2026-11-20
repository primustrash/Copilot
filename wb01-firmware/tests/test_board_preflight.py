"""WB01 build must reject unspecified, generic and incomplete board evidence."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

SOURCE = Path(__file__).resolve().parents[1] / "scripts/validate_board_profile.py"
spec = importlib.util.spec_from_file_location("wb01_preflight", SOURCE)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

PROFILE = {
    "board_id": "board-observed-example",
    "soc": "mt7688-observed-example",
    "hardware_revision": "board-rev-example",
    "ram_mib": 128,
    "flash_mib": 16,
    "openwrt_target": "ramips",
    "openwrt_subtarget": "mt76x8",
    "openwrt_profile": "device-specific-profile-not-verified",
    "original_firmware_sha256": "a" * 64,
    "bootloader": "u-boot-observed",
    "recovery_procedure": "UART/TFTP recovery must be validated independently",
}

class BoardPreflightTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name) / "board.json"

    def validate(self, profile):
        self.path.write_text(json.dumps(profile), encoding="utf-8")
        return module.validate(self.path)

    def test_complete_candidate_parses_but_not_certifies_hardware(self):
        self.assertEqual(self.validate(PROFILE)["openwrt_target"], "ramips")

    def test_generic_profile_denied(self):
        with self.assertRaisesRegex(ValueError, "Generic"):
            self.validate({**PROFILE, "openwrt_profile": "generic"})

    def test_wrong_target_denied(self):
        with self.assertRaisesRegex(ValueError, "Incompatible"):
            self.validate({**PROFILE, "openwrt_target": "ath79"})

    def test_missing_board_id_denied(self):
        invalid = dict(PROFILE)
        del invalid["board_id"]
        with self.assertRaisesRegex(ValueError, "incomplete"):
            self.validate(invalid)

    def test_empty_checksum_denied(self):
        with self.assertRaisesRegex(ValueError, "SHA-256"):
            self.validate({**PROFILE, "original_firmware_sha256": ""})

    def test_build_script_is_fail_closed_without_profile(self):
        script = SOURCE.parent / "build_wb01.sh"
        text = script.read_text()
        self.assertLess(text.index("PROFILE_LINE"), text.index("git clone"))
        self.assertNotIn('PROFILE="generic"', text)
        self.assertIn("if [[ $# -ne 1 ]]", text)

if __name__ == "__main__":
    unittest.main()
