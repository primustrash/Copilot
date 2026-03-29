#!/bin/sh
set -eu

. /lib/functions.sh

# Rebuild custom nft table from wb01-connector ipmap entries.
NFT_TABLE="inet wb01_map"

nft delete table ${NFT_TABLE} 2>/dev/null || true
nft add table ${NFT_TABLE}
nft 'add chain inet wb01_map prerouting { type nat hook prerouting priority dstnat; policy accept; }'
nft 'add chain inet wb01_map postrouting { type nat hook postrouting priority srcnat; policy accept; }'

config_load wb01-connector

add_map_rule() {
	local local_ip local_port cloud_ip cloud_port direction enabled
	config_get enabled "$1" enabled '0'
	[ "$enabled" = "1" ] || return 0

	config_get direction "$1" direction 'bidirectional'
	config_get local_ip "$1" local_ip
	config_get local_port "$1" local_port
	config_get cloud_ip "$1" cloud_ip
	config_get cloud_port "$1" cloud_port

	[ -n "$local_ip" ] && [ -n "$cloud_ip" ] || return 0

	if [ "$direction" = "cloud_to_lan" ] || [ "$direction" = "bidirectional" ]; then
		nft add rule inet wb01_map prerouting ip daddr "$cloud_ip" tcp dport "$cloud_port" dnat to "$local_ip":"$local_port"
	fi

	if [ "$direction" = "lan_to_cloud" ] || [ "$direction" = "bidirectional" ]; then
		nft add rule inet wb01_map postrouting ip saddr "$local_ip" tcp sport "$local_port" snat to "$cloud_ip"
	fi
}

config_foreach add_map_rule ipmap
logger -t wb01-mapping "Applied wb01 ip mappings"
