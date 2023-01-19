#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
# Copyright © 2021 Roberto Hidalgo <sbth@un.rob.mx>

@milpa.load_util counters

@milpa.log info "Starting clock"
KEEP_GOING=true

function shutdown() {
  @milpa.log warn "Shutting down, waiting for audio to finish"
  KEEP_GOING=false
}
trap 'shutdown' INT

while [[ "$KEEP_GOING" == "true" ]]; do
  if milpa show clock speak; then
    [[ "$MILPA_OPT_ENABLE_COUNTERS" ]] && echo "" >>"$(@counters.dir)/clock"
  else
    [[ "$KEEP_GOING" == "true" ]] && @milpa.fail "could not speak time"
  fi
done

@milpa.log complete "Clock completed run"
