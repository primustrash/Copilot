m = Map("wb01-connector", translate("WB01 Tunnel / Connector"),
	translate("Feingranulare Einstellungen für Tunnel-, ACL- und Connector-Modus."))

s = m:section(TypedSection, "tunnel", translate("Tunnel-Basis"))
s.anonymous = true

mode = s:option(ListValue, "mode", translate("Betriebsmodus"))
mode:value("tunnel_only", "Tunnel only")
mode:value("tunnel_storage", "Tunnel + Storage Connector")
mode:value("storage_only", "Storage only")
mode.default = "tunnel_storage"

en = s:option(Flag, "enabled", translate("Tunnel aktiv"))
en.default = "1"

proto = s:option(ListValue, "transport", translate("Transport"))
proto:value("wireguard", "WireGuard")
proto:value("openvpn", "OpenVPN (optional)")
proto.default = "wireguard"

mtu = s:option(Value, "mtu", translate("MTU"))
mtu.datatype = "uinteger"
mtu.placeholder = "1380"

keep = s:option(Value, "persistent_keepalive", translate("Persistent Keepalive"))
keep.datatype = "uinteger"
keep.placeholder = "25"

acl = m:section(TypedSection, "acl", translate("Zugriffssteuerung"))
acl.anonymous = true

acl_mode = acl:option(ListValue, "policy", translate("Policy"))
acl_mode:value("allowlist", "Allowlist only")
acl_mode:value("allowlist_log_drop", "Allowlist + Drop + Logging")
acl_mode.default = "allowlist"

trusted = acl:option(DynamicList, "trusted_servers", translate("Erlaubte Cloud-Server (Public IP)"))
trusted.datatype = "ip4addr"
trusted.placeholder = "203.0.113.10"

return m
