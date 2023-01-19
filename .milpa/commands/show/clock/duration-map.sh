#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
# Copyright © 2021 Roberto Hidalgo <sbth@un.rob.mx>

repo=$(dirname "${MILPA_COMMAND_REPO}")
audio_dir="$repo/.clock-audio"

if [[ -f "$audio_dir/durations.json" ]] && [[ "$MILPA_OPT_FORCE" == "" ]]; then
  exec cat "$audio_dir/durations.json"
fi

@milpa.log info "computing audio file durations"
while read -r aac; do
  item="$(basename "${aac%.*}")"
  duration="$(ffprobe -show_streams "$aac" -hide_banner -loglevel error -print_format json | jq -r '.streams[0].duration')"
  echo "$item $duration"
  @milpa.log success "$item: $duration"
done < <(find "$audio_dir" -type f -name '*.aac') |
   jq --slurp --raw-input 'rtrimstr("\n") | split("\n") | map(split(" ")) | map({key: .[0], value: .[1]}) | from_entries' | tee "$audio_dir/durations.json"
