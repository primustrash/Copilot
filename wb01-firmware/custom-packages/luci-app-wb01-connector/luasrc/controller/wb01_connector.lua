module("luci.controller.wb01_connector", package.seeall)

function index()
	if not nixio.fs.access("/etc/config/wb01-connector") then
		return
	end

	entry({"admin", "services", "wb01"}, firstchild(), _("WB01 Connector"), 80).dependent = false
	entry({"admin", "services", "wb01", "tunnel"}, cbi("wb01_connector/tunnel"), _("Tunnel / Connector"), 10)
	entry({"admin", "services", "wb01", "storage"}, cbi("wb01_connector/storage"), _("Storage & Backup"), 20)
	entry({"admin", "services", "wb01", "mapping"}, cbi("wb01_connector/mapping"), _("Cloud/LAN Mapping"), 30)
	entry({"admin", "services", "wb01", "updates"}, cbi("wb01_connector/updates"), _("Updates"), 40)
end
