#!/usr/bin/env bash
# Baseline host hardening for an Ubuntu 22.04/24.04 Liquid Web server.
# Run once as root after provisioning:  sudo ./harden-host.sh <deploy-user> <ssh-pubkey-file>
# Maps to HIPAA §164.308/312 technical safeguards, CIS Ubuntu Level 1 (subset).
set -euo pipefail
DEPLOY_USER=${1:?deploy user name}
PUBKEY_FILE=${2:?path to the deploy user's SSH public key}

echo "== packages & automatic security updates"
apt-get update -y
DEBIAN_FRONTEND=noninteractive apt-get install -y ufw fail2ban unattended-upgrades auditd chrony \
  cryptsetup age awscli docker.io docker-compose-v2 apparmor apparmor-utils
dpkg-reconfigure -f noninteractive unattended-upgrades

echo "== deploy user (key-only SSH, docker group)"
id "$DEPLOY_USER" >/dev/null 2>&1 || adduser --disabled-password --gecos "" "$DEPLOY_USER"
usermod -aG docker "$DEPLOY_USER"
install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"
install -m 600 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$PUBKEY_FILE" "/home/$DEPLOY_USER/.ssh/authorized_keys"

echo "== SSH: no root login, no passwords"
cat >/etc/ssh/sshd_config.d/99-nsa-hardening.conf <<'CONF'
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
MaxAuthTries 3
LoginGraceTime 30
X11Forwarding no
AllowAgentForwarding no
ClientAliveInterval 300
ClientAliveCountMax 2
CONF
systemctl reload ssh || systemctl reload sshd

echo "== firewall: only SSH + HTTPS (+80 for ACME redirects)"
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "== fail2ban for SSH"
cat >/etc/fail2ban/jail.d/sshd.local <<'CONF'
[sshd]
enabled = true
maxretry = 5
bantime = 1h
CONF
systemctl enable --now fail2ban

echo "== kernel/network hardening"
cat >/etc/sysctl.d/99-nsa.conf <<'CONF'
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.all.accept_redirects = 0
net.ipv6.conf.all.accept_redirects = 0
net.ipv4.conf.all.send_redirects = 0
net.ipv4.tcp_syncookies = 1
kernel.kptr_restrict = 2
kernel.dmesg_restrict = 1
fs.protected_hardlinks = 1
fs.protected_symlinks = 1
CONF
sysctl --system >/dev/null

echo "== audit logging of privileged actions (HIPAA audit controls)"
cat >/etc/audit/rules.d/nsa.rules <<'CONF'
-w /etc/passwd -p wa -k identity
-w /etc/shadow -p wa -k identity
-w /etc/sudoers -p wa -k privilege
-w /etc/ssh/sshd_config.d/ -p wa -k sshd
-w /srv/nsa/deploy/secrets/ -p rwa -k nsa-secrets
-a always,exit -F arch=b64 -S execve -F euid=0 -k root-commands
CONF
augenrules --load
systemctl enable --now auditd chrony

echo "== Docker: no inter-container traffic by default, log rotation"
cat >/etc/docker/daemon.json <<'CONF'
{ "icc": false, "no-new-privileges": true, "log-driver": "json-file", "log-opts": { "max-size": "20m", "max-file": "5" } }
CONF
systemctl restart docker

echo
echo "Done. Next: encrypted data volume (README step 3). Verify SSH key login works BEFORE closing this session."
