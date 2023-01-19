#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
# Copyright © 2021 Roberto Hidalgo <sbth@un.rob.mx>

repo=$(dirname "${MILPA_COMMAND_REPO}")
audio_dir="$repo/.clock-audio"

function target_epoch() {
	local now msToTen;
	now="$(gdate '+%s%3N')"
	msToTen=$(( 10000 - (now % 10000) ))
	if [[ "$msToTen" -le 5000 ]]; then
		@milpa.log info "too late to start, adding 10s"
		msToTen=$(( 10000 + msToTen ))
	fi
	gdate -d "@$(( (now + msToTen) / 1000 ))" "+%s"
}

function build_sequence () {
	local target hour minutes seconds zero_seconds sequence minute_mod;
	target="$1"
	hour=$(gdate -d "@$target" "+%I")
	minutes=$(gdate -d "@$target" "+%M")
	seconds=$(gdate -d "@$target" "+%S")
	seconds=${seconds#0}
	seconds_after_tenth=$(( seconds % 10 ))
	zero_seconds="$(( seconds - seconds_after_tenth ))"

	sequence=(
		thirdstroke
		"${hour#0}"
	)

	minutes="${minutes##0}"

	if [[ "$minutes" -eq 0 ]] || [[ "$minutes" -eq 60 ]]; then
		@milpa.log debug "minutes are zero"
		sequence+=( oclock )
	elif [[ "$minutes" -gt 10 ]] && [[ $minutes -lt 20 ]]; then
		@milpa.log debug "minutes are 10 > x < 20"
		sequence+=( "$minutes" )
	else
		minute_mod="$(( minutes % 10 ))"

		if [[ $minutes -ge 10 ]]; then
			@milpa.log debug "minutes are less than 10"
			sequence+=( "$(( minutes - minute_mod ))" )
		fi

		if [[ $minute_mod != "0" ]]; then
			@milpa.log debug "minutemod is not zero"
			sequence+=( "$minute_mod" )
		fi
	fi

	if [[ "$zero_seconds" -eq 0 ]]; then
		@milpa.log debug "seconds are zero"
		sequence+=( precisely )
	else
		@milpa.log debug "seconds are not zero"
		sequence+=(
			and
			"$zero_seconds"
			seconds
		)
	fi

	# sequence=(thirdstroke 5 50 6 and 50 seconds)
	@milpa.log info "${sequence[@]}"

	sequence+=(
		silence silence
		stroke
		silence silence silence silence silence silence
		stroke
		silence silence silence silence silence silence
		stroke
		silence
	)
	echo "${sequence[@]}"
}

function playlist_file() {
  echo "#EXTM3U"
  echo "#EXT-X-PLAYLIST-TYPE:VOD"
  echo "#EXT-X-VERSION:4"
  echo "#EXT-X-TARGETDURATION:10"
  echo "#EXT-X-MEDIA-SEQUENCE:0"
	for item in "${@}"; do
    echo "#EXTINF:$(jq -r '.["'"$item"'"]' "$audio_dir/durations.json"), $item"
    echo "file://$audio_dir/$item.aac"
	done
	echo "#EXT-X-ENDLIST"
}

function playlist_duration() {
	jq '. as $data |
		( $ARGS.positional |
			map(. as $key | $data | getpath([$key]) | tonumber)
		) | add | . * 1000.0 | ceil/1000.0
	' "$audio_dir/durations.json" --args "$@"
}

target=$(target_epoch)
now="$(gdate '+%s%3N')"
@milpa.log debug "now: $(gdate -d "@$((now / 1000))")"
@milpa.log debug "dta: $(gdate -d "@$target")"

read -r -a sequence < <(build_sequence "$target")
lasts=$(playlist_duration "${sequence[@]}")
completingAt=$(gdate -d "+$lasts seconds" "+%s")

@milpa.log debug "now:    $(gdate)"
@milpa.log debug "target: $(gdate -d "@$target")"
@milpa.log debug "ETA:    $(gdate -d "@$completingAt")"
@milpa.log debug "length: $lasts"

if [[ "$completingAt" -gt "$target" ]]; then
	@milpa.log warn "Late by $(( completingAt - target ))s"
elif [[ "$completingAt" -lt "$target" ]]; then
	sleepFor="$(bc -l <<<"0.7 * ( $target - $completingAt )")"
	@milpa.log warn "Early by $(( target- completingAt))s, sleeping for $sleepFor"
	sleep "$sleepFor"
	@milpa.log info "now:    $(gdate)"
fi

ffplay -hide_banner -loglevel error -f hls -i <(playlist_file "${sequence[@]}") -nodisp -autoexit || @milpa.fail "Could not play sound"
@milpa.log complete "done: $(gdate)"
