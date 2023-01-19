#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
# Copyright © 2021 Roberto Hidalgo <sbth@un.rob.mx>

function is_connected() {
  echo "info $MILPA_ARG_ADDRESS" | bluetoothctl | grep -c "Connected: yes" >/dev/null
}

until is_connected; do
  @milpa.log warn "Not connected yet to $MILPA_ARG_ADDRESS, retrying in a second"
  sleep 1
done

@milpa.log success "Connected to $MILPA_ARG_ADDRESS!"
