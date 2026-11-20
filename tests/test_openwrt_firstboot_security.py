"""Static fail-closed gates for the OpenWrt first-boot SSH setup.

Hardware reboot, Dropbear live service and UART recovery require a real device.
"""
import pathlib
import unittest

SOURCE = (pathlib.Path(__file__).parents[1] / "scripts/openwrt-firstboot-hardening.sh").read_text()


class FirstBootSecurity(unittest.TestCase):
    def test_key_required_before_configuration(self):
        key = SOURCE.index("grep -Eq")
        main_configuration = SOURCE.index("CHANGED=1\nuci set")
        self.assertLess(key, main_configuration)
        self.assertIn('[ ! -L "$KEY_FILE" ]', SOURCE)

    def test_ssh_password_logins_off(self):
        self.assertIn("RootPasswordAuth=off", SOURCE)
        self.assertIn("PasswordAuth=off", SOURCE)
        self.assertIn("Interface=lan", SOURCE)

    def test_rollback_armed_before_modification(self):
        self.assertLess(SOURCE.index("trap rollback EXIT"), SOURCE.index("CHANGED=1\nuci set"))
        self.assertIn("uci import dropbear", SOURCE)
        self.assertIn("uci commit dropbear", SOURCE)

    def test_service_activation_after_configuration(self):
        self.assertLess(SOURCE.rindex("uci commit dropbear"), SOURCE.rindex("/etc/init.d/dropbear enable"))
        self.assertLess(SOURCE.rindex("/etc/init.d/dropbear enable"), SOURCE.rindex("/etc/init.d/dropbear restart"))

    def test_no_implicit_http_admin(self):
        self.assertNotIn("/etc/init.d/uhttpd restart", SOURCE)
        self.assertNotIn("passwd\n", SOURCE)


if __name__ == "__main__":
    unittest.main()
