#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
# Copyright © 2021 Roberto Hidalgo <sbth@un.rob.mx>

# connect to relay server once as root
sudo ssh -i /var/lib/sbth/id_ed25519 -v -R 2222:localhost:22 -N tetecon@bastion

sudo apt-get update
sudo apt-get install language-pack-en pulseaudio pulseaudio-module-bluetooth autossh npm vim pulseaudio bluez-tools pulseaudio-module-bluetooth sane
sudo dpkg-reconfigure locales
sudo usermod -G bluetooth -a "$(whoami)"
sudo usermod -G scanner -a "$(whoami)"
sudo chmod -R 777 /dev/bus/usb
echo 'pcm.!default "hw:0,0"' > ~/.asoundrc

cat <<PULSEAUDIO | sudo tee /etc/pulse/default.pa
load-module module-device-restore
load-module module-stream-restore restore_device=false
load-module module-card-restore

.ifexists module-bluetooth-policy.so
load-module module-bluetooth-policy
.endif

.ifexists module-bluetooth-discover.so
load-module module-bluetooth-discover autodetect_mtu=yes
.endif
PULSEAUDIO

pulseaudio --start

npm build

while read -r svcpath; do
  svcName="$(basename "${svcpath%.service}")"
  @milpa.log info "installing $svcName"
  sudo cp "$svcpath" "/etc/systemd/system/$svcName.service" || @milpa.fail "Could not install $svcName"
done < <(find services -name '*.service')

@milpa.log info "reloading services"
sudo systemctl daemon-reload || @milpa.fail "Could not reload daemons"

while read -r svcpath; do
  svcName="$(basename "${svcpath%.service}")"

  if ! systemctl is-enabled "$svcName" >/dev/null; then
    @milpa.log info "enabling $svcName"
    sudo systemctl enable "$svcName" || @milpa.fail "Could not enable $svcName"
  fi
done < <(find services -name '*.service')


sudo restart
