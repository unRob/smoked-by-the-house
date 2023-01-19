#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
# Copyright © 2021 Roberto Hidalgo <sbth@un.rob.mx>

@milpa.load_util counters

@milpa.log info "Starting scanner"
KEEP_GOING=true

function shutdown() {
  @milpa.log warn "Shutting down, waiting for scanner to finish run"
  KEEP_GOING=false
}
trap 'shutdown' INT

while [[ "$KEEP_GOING" == "true" ]]; do
  if scanimage -o - --format=pnm >/dev/null; then
    [[ "$MILPA_OPT_ENABLE_COUNTERS" ]] && echo "" >>"$(@counters.dir)/scan"
  else
    [[ "$KEEP_GOING" == "true" ]] && @milpa.fail "could not scan"
  fi
done

@milpa.log complete "Scanner completed run"
