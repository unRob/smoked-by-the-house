#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
# Copyright © 2021 Roberto Hidalgo <sbth@un.rob.mx>

# get next steps from bastion in case of an emergency
# runs periodically
ssh -i /var/lib/sbth/id_ed25519 tetecon@bastion cat 'emergency.sh' | bash -
