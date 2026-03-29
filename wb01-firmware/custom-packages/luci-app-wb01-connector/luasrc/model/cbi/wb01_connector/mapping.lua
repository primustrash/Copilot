m = Map("wb01-connector", translate("IP Mapping (Cloud ↔ LAN)"),
	translate("Statische Zuordnungen zwischen lokalen und Cloud-seitigen IPs in beide Richtungen."))

s = m:section(TypedSection, "ipmap", translate("Bidirektionales Mapping"))
s.template = "cbi/tblsection"
s.anonymous = true
s.addremove = true

name = s:option(Value, "name", translate("Name"))
name.placeholder = "cam01-map"

dir = s:option(ListValue, "direction", translate("Richtung"))
dir:value("lan_to_cloud", "LAN -> Cloud")
dir:value("cloud_to_lan", "Cloud -> LAN")
dir:value("bidirectional", "Bidirektional")
dir.default = "bidirectional"

local_ip = s:option(Value, "local_ip", translate("Lokale IP"))
local_ip.datatype = "ip4addr"

cloud_ip = s:option(Value, "cloud_ip", translate("Cloud-IP"))
cloud_ip.datatype = "ip4addr"

local_port = s:option(Value, "local_port", translate("Lokaler Port"))
local_port.datatype = "port"

cloud_port = s:option(Value, "cloud_port", translate("Cloud-Port"))
cloud_port.datatype = "port"

en = s:option(Flag, "enabled", translate("Aktiv"))
en.default = "1"

return m
