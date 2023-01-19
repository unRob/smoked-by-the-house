#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
# Copyright © 2021 Roberto Hidalgo <sbth@un.rob.mx>

repo=$(dirname "${MILPA_COMMAND_REPO}")
audio_dir="$repo/.clock-audio"
mkdir -p "$audio_dir"

items=(
  thirdstroke seconds precisely and oclock stroke 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 30 40 50
)

# create silences to pad beeps
ffmpeg -f lavfi -i anullsrc -t 0.1 "$audio_dir/silence.aac" || @milpa.fail "Could not create silence track"

# download all items
for item in "${items[@]}"; do
  dest="$audio_dir/$item.aac"
  if [[ ! -f "$dest" ]] || [[ "$MILPA_OPT_FORCE" ]]; then
    @milpa.log info "downloading and transcoding $item"
    ffmpeg -hide_banner -loglevel error -i "https://1194online.com/audio/m4a/$item.aif.m4a" "$dest" || @milpa.fail "Could not download $item"
  fi
done

mkdir -p "$audio_dir/cache"

# find out durations and dump to json
exec milpa show clock duration-map ${MILPA_OPT_FORCE:+--force}
