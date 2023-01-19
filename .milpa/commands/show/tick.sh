#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
# Copyright © 2021 Roberto Hidalgo <sbth@un.rob.mx>

@milpa.load_util counters
starting=$(date --date "today $MILPA_OPT_START_AT" "+%s")
ending=$(date --date "today $MILPA_OPT_STOP_AT" "+%s")
currently=$(date "+%s")

# ping bastion with current machine's IP
curl --silent --fail --show-error https://ipinfo.io/ip 2>&1 | ssh -i /var/lib/sbth/id_ed25519 tetecon@bastion 'cat - > last_known_ip'


if [[ "$currently" -ge "$starting" ]] && [[ "$currently" -le "$ending" ]]; then
  @milpa.log info "show is open"

  counter_dir="$(@counters.dir)"
  if [[ ! -d  "$counter_dir" ]]; then
    @milpa.log info "Creating counter directory for today"
    chown -R roberto:roberto "$counter_dir"
  fi
  services=(autossh speaker clock yeedi roomba)

  for service in "${services[@]}"; do
    status=$(systemctl is-active "$service")
    exitCode="$?"
    case "$status" in
      active)
        @milpa.log info "$service is active"
        continue
        ;;
      failed)
        @milpa.log warn "service $service failed to start"
        continue
        ;;
      inactive)
        @milpa.log warn "starting $service"
        systemctl start "$service" || @milpa.log warn "Could not start $service"
        ;;
      *)
        @milpa.fail "Unknown status: $status ($exitCode)"
    esac
  done
else
  @milpa.log info "show is closed"

  services=(speaker clock yeedi roomba)
  for service in "${services[@]}"; do
    status=$(systemctl is-active "$service")
    exitCode="$?"

    case "$status" in
      active)
        @milpa.log info "shutting down $service"
        systemctl stop "$service" || @milpa.fail "Could not stop $service"
        ;;
      failed)
        @milpa.log warn "service $service failed to start, shutting down"
        systemctl stop "$service" || @milpa.fail "Could not stop $service"
        ;;
      inactive)
        @milpa.log warn "service $service is already stopped"
        ;;
      *)
        @milpa.fail "Unknown status: $status ($exitCode)"
    esac
  done

  milpa show sync-counters || @milpa.fail "Could not sync counters"
fi
