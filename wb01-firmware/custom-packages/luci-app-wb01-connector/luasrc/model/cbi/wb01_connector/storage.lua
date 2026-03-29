m = Map("wb01-connector", translate("USB Storage / Cloud-LAN Share"),
	translate("USB-Speicher einbinden, gemeinsam bereitstellen und automatische Backups konfigurieren."))

s = m:section(TypedSection, "storage", translate("Storage Connector"))
s.anonymous = true

enabled = s:option(Flag, "enabled", translate("Storage Connector aktiv"))
enabled.default = "1"

mountpoint = s:option(Value, "mountpoint", translate("Mountpoint"))
mountpoint.placeholder = "/mnt/usbshare"

fstype = s:option(ListValue, "fstype", translate("Dateisystem"))
fstype:value("ext4", "ext4")
fstype:value("vfat", "vfat")
fstype:value("ntfs", "ntfs (optional)")
fstype.default = "ext4"

share = s:option(Flag, "samba_share", translate("Samba-Freigabe aktiv"))
share.default = "1"

cloud_sync = s:option(Flag, "cloud_sync", translate("Cloud-Sync aktiv"))
cloud_sync.default = "1"

backup = m:section(TypedSection, "backup", translate("Automatische Backups"))
backup.anonymous = true

backup_enabled = backup:option(Flag, "enabled", translate("Backup aktiv"))
backup_enabled.default = "1"

schedule = backup:option(ListValue, "schedule", translate("Backup-Intervall"))
schedule:value("hourly", "Stündlich")
schedule:value("daily", "Täglich")
schedule:value("weekly", "Wöchentlich")
schedule.default = "daily"

target = backup:option(Value, "target", translate("Backup-Ziel"))
target.placeholder = "/mnt/usbshare/backups"

retain = backup:option(Value, "retain", translate("Anzahl Backups aufbewahren"))
retain.datatype = "uinteger"
retain.placeholder = "14"

return m
