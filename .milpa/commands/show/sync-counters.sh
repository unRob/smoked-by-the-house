#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
# Copyright © 2021 Roberto Hidalgo <sbth@un.rob.mx>

@milpa.load_util counters
@milpa.log info "syncing counters"

rsync \
  -e "ssh -i /var/lib/sbth/id_ed25519" \
  -a \
  -r \
  --compress \
  --times \
  "$(@counters.base)" \
  tetecon@bastion:/home/tetecon/counters
