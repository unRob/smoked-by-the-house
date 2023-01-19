#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
# Copyright © 2021 Roberto Hidalgo <sbth@un.rob.mx>

function @counters.base() {
  echo "/var/lib/sbth/counters"
}

function @counters.dir() {
  local target
  target="$(@counters.base)/$(gdate --rfc-3339=date)"
  mkdir -p "$target"
  echo "$target"
}

