#!/bin/sh
# Stop the stack while there is still room for Postgres to checkpoint.
# A full disk turns a shutdown into a crash.

set -u

THRESHOLD_BYTES="${THRESHOLD_BYTES:-1073741824}"
DATA_PATH="${DATA_PATH:-/data}"
INTERVAL_SECONDS="${INTERVAL_SECONDS:-15}"

log() {
  printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1"
}

free_bytes() {
  kb=$(df -P -k "$DATA_PATH" 2>/dev/null | awk 'NR==2 { print $4 }')
  case "$kb" in
    ''|*[!0-9]*) return 1 ;;
  esac
  echo $((kb * 1024))
}

project_name() {
  docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' "$(hostname)"
}

stop_role() {
  role=$1
  grace=$2
  project=$3
  ids=$(docker ps -q \
    --filter "label=com.docker.compose.project=$project" \
    --filter "label=musterlog.role=$role")
  if [ -z "$ids" ]; then
    return 0
  fi
  # shellcheck disable=SC2086
  docker stop -t "$grace" $ids
}

stopped=0

while true; do
  if ! avail=$(free_bytes); then
    log "Could not read free space on $DATA_PATH"
    sleep "$INTERVAL_SECONDS"
    continue
  fi

  if [ "$avail" -ge "$THRESHOLD_BYTES" ]; then
    if [ "$stopped" -eq 1 ]; then
      log "Disk has room again. The stack stays stopped until: docker compose up -d"
      stopped=0
    fi
    sleep "$INTERVAL_SECONDS"
    continue
  fi

  if ! project=$(project_name); then
    log "Could not find this stack. Retrying."
    sleep "$INTERVAL_SECONDS"
    continue
  fi

  if [ "$stopped" -eq 0 ]; then
    log "Free disk is ${avail} bytes, under ${THRESHOLD_BYTES}. Stopping the stack."
  fi

  stop_role web 20 "$project" || log "Web container did not stop cleanly."
  if stop_role postgres 90 "$project"; then
    stopped=1
  else
    log "Postgres did not stop. Retrying while space remains."
  fi

  sleep "$INTERVAL_SECONDS"
done
