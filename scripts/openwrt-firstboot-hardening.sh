#!/usr/bin/env sh
set -eu
umask 077

# Fail closed: validate a provisioned public key BEFORE activating SSH.
fail() { printf '%s\n' "ERROR: $*" >&2; exit 1; }
[ "$(id -u)" = 0 ] || fail "OpenWrt root privileges required"
command -v uci >/dev/null 2>&1 || fail "OpenWrt UCI is required"
[ -x /etc/init.d/dropbear ] || fail "Dropbear init service missing"
uci -q get 'dropbear.@dropbear[0]' >/dev/null 2>&1 || fail "Dropbear section missing"

KEY_FILE=/etc/dropbear/authorized_keys
[ -f "$KEY_FILE" ] && [ ! -L "$KEY_FILE" ] || fail "Provision an authorized_keys file before enabling SSH"
grep -Eq '^(ssh-ed25519|ecdsa-sha2-nistp(256|384|521)|ssh-rsa) [A-Za-z0-9+/=]+([[:space:]]|$)' "$KEY_FILE" ||
  fail "No valid-looking SSH public key found"
chmod 600 "$KEY_FILE" || fail "Cannot protect SSH authorized_keys"

BACKUP=$(mktemp /tmp/aion-dropbear-backup.XXXXXX) || fail "Cannot create rollback backup"
uci export dropbear > "$BACKUP" || { rm -f "$BACKUP"; fail "Cannot export Dropbear configuration"; }
WAS_ENABLED=0
if /etc/init.d/dropbear enabled >/dev/null 2>&1; then WAS_ENABLED=1; fi
CHANGED=0
rollback() {
  rc=$?
  trap - EXIT
  if [ "$rc" -ne 0 ] && [ "$CHANGED" -eq 1 ]; then
    uci import dropbear < "$BACKUP" || true
    uci commit dropbear || true
    /etc/init.d/dropbear stop || true
    if [ "$WAS_ENABLED" -eq 1 ]; then
      /etc/init.d/dropbear enable || true
      /etc/init.d/dropbear restart || true
    else
      /etc/init.d/dropbear disable || true
    fi
    printf '%s\n' "Previous Dropbear configuration restored" >&2
  fi
  rm -f "$BACKUP"
}
trap rollback EXIT

# Keep password and root-password authentication OFF; require key auth.
uci set 'dropbear.@dropbear[0].enable=1'
uci set 'dropbear.@dropbear[0].Interface=lan'
uci set 'dropbear.@dropbear[0].PasswordAuth=off'
uci set 'dropbear.@dropbear[0].RootPasswordAuth=off'
uci set 'dropbear.@dropbear[0].RootLogin=on'
CHANGED=1
uci commit dropbear

# SSH is only exposed after all key, permission, config and auth checks.
/etc/init.d/dropbear enable
/etc/init.d/dropbear restart

printf '%s\n' "SSH enabled on LAN with key-only authentication."
