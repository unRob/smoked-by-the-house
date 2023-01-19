#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
# Copyright © 2021 Roberto Hidalgo <sbth@un.rob.mx>

function is_connected() {
    echo "info $MILPA_ARG_ADDRESS" | bluetoothctl | grep -c "Connected: yes" >/dev/null
}

function is_powered() {
    echo "show" | bluetoothctl | grep "Powered: yes" >/dev/null
}

while true; do
  if is_powered; then
    if ! is_connected; then
      @milpa.log info "Attempting to connect to $MILPA_ARG_ADDRESS"
      echo "connect ${MILPA_ARG_ADDRESS}" | bluetoothctl
      sleep "$MILPA_OPT_WAIT"
      is_connected || @milpa.fail "Could not connect after ${MILPA_OPT_WAIT}s"
    fi
  else
    @milpa.log warn "Bluetooth is powered down, sleeping for ${MILPA_OPT_WAIT}s"
    sleep "$MILPA_OPT_WAIT"
    continue
  fi

  @milpa.log success "Connected to $MILPA_ARG_ADDRESS, sleeping for a minute"
  sleep "$MILPA_OPT_REFRESH"
  continue
done
