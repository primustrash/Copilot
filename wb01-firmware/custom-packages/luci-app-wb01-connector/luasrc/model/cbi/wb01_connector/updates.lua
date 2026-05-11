m = Map("wb01-connector", translate("Firmware / Software Updates"),
	translate("Optionen für GUI-basierte Paket- und Firmware-Updates."))

s = m:section(TypedSection, "updates", translate("Update-Steuerung"))
s.anonymous = true

auto = s:option(Flag, "auto_updates", translate("Automatische Paket-Updates"))
auto.default = "0"

window = s:option(Value, "maintenance_window", translate("Maintenance Window (UTC)"))
window.placeholder = "Sun 02:30"

fw = s:option(Flag, "allow_firmware_upgrade", translate("Firmware-Upgrade via GUI erlauben"))
fw.default = "1"

channel = s:option(ListValue, "channel", translate("Update-Kanal"))
channel:value("stable", "Stable")
channel:value("candidate", "Release Candidate")
channel.default = "stable"

script = s:option(Value, "update_script", translate("Update-Skript"))
script.placeholder = "/usr/libexec/wb01/run-update.sh"

return m
