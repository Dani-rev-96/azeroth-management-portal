#!/usr/bin/env bash
# mysql-backup.sh — nightly logical dumps of the AzerothCore MySQL databases.
#
# Runs inside the mysql:9 image (CronJob k3s/base/backups/cronjob.yaml), so the mysqldump client
# matches the MySQL 9 servers. Tools used: bash, mysql, mysqldump, gzip, sha256sum, date, find,
# stat, mv, mkdir, rm, mktemp, tail, tr, sed.
#
# Layout (one file per database, never concatenated; dumps have no CREATE DATABASE/USE so they
# can be restored into any schema, e.g. a scratch schema for a restore drill):
#   $BACKUP_ROOT/<database>/<target>/<ts>.sql.gz   gzip'ed mysqldump output
#   $BACKUP_ROOT/<database>/<target>/<ts>.json     manifest (written in dump_database)
#   $BACKUP_ROOT/<database>/<target>/.last-success last successful createdAt + file
#   $BACKUP_ROOT/status.json                       summary of the last run, per target
# <ts> is the UTC start time of the dump, format YYYYMMDDTHHMMSSZ.
#
# A dump is written to <ts>.sql.gz.partial and only renamed to <ts>.sql.gz after mysqldump and
# gzip both exited 0 and `gzip -t` passed; the manifest is renamed into place just before the dump.
# If one target fails the others still run; the script exits 1 at the end if anything failed.
# Retention (backup-retention.sh) runs per target, only after that target's backup succeeded.
#
# Env:
#   TARGETS          required. Space-separated "<target>:<host>:<database>" entries, e.g.
#                    "auth:wow-acore-auth-db:acore_auth realm1:wow-acore-blizzlike-db:acore_characters".
#                    A target named realm<N> records realmId N in the manifest.
#   MYSQL_PWD        required unless DRY_RUN=1 (read by mysql/mysqldump; never passed as an argument).
#   MYSQL_USER       default acore
#   MYSQL_PORT       default 3306
#   BACKUP_ROOT      default /backups/mysql
#   BACKUP_WORLD     true|false, default false. When true, every acore_characters target also dumps
#                    WORLD_DATABASE (default acore_world) from the same host.
#   DRY_RUN          1 = no dumps, no writes, no deletions; only log what would happen.
#   RETENTION_SCRIPT default: backup-retention.sh next to this script.
#   KEEP_DAYS / KEEP_WEEKLY / KEEP_MONTHLY are passed through to the retention script.
set -uo pipefail

BACKUP_ROOT="${BACKUP_ROOT:-/backups/mysql}"
TARGETS="${TARGETS:-}"
MYSQL_USER="${MYSQL_USER:-acore}"
MYSQL_PORT="${MYSQL_PORT:-3306}"
BACKUP_WORLD="${BACKUP_WORLD:-false}"
WORLD_DATABASE="${WORLD_DATABASE:-acore_world}"
DRY_RUN="${DRY_RUN:-0}"
RETENTION_SCRIPT="${RETENTION_SCRIPT:-$(dirname "$0")/backup-retention.sh}"
STALE_PARTIAL_MINUTES=360

MYSQLDUMP_OPTIONS=(
	--single-transaction
	--routines
	--triggers
	--events
	--set-gtid-purged=OFF
	--no-tablespaces
)

log() {
	printf '%s mysql-backup: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >&2
}

# JSON string literal (quotes included) for an arbitrary value; newlines/tabs become spaces.
json_string() {
	local value="$1"
	value="${value//\\/\\\\}"
	value="${value//\"/\\\"}"
	value="$(printf '%s' "$value" | tr '\n\r\t' '   ')"
	printf '"%s"' "$value"
}

json_string_or_null() {
	if [[ -n "$1" ]]; then json_string "$1"; else printf 'null'; fi
}

# 20260105T033000Z -> 2026-01-05T03:30:00Z
iso_from_stamp() {
	local ts="$1"
	printf '%s-%s-%sT%s:%s:%sZ' "${ts:0:4}" "${ts:4:2}" "${ts:6:2}" "${ts:9:2}" "${ts:11:2}" "${ts:13:2}"
}

mysql_query() {
	local host="$1" sql="$2"
	mysql --host="$host" --port="$MYSQL_PORT" --user="$MYSQL_USER" --batch --skip-column-names --execute="$sql"
}

# Prints "table<TAB>rowEstimate" lines as a JSON object body.
tables_json() {
	local rows="$1" first=1 name estimate
	printf '{'
	while IFS=$'\t' read -r name estimate; do
		[[ -z "$name" ]] && continue
		[[ "$estimate" =~ ^[0-9]+$ ]] || estimate=0
		if ((first)); then first=0; else printf ','; fi
		printf '%s:%s' "$(json_string "$name")" "$estimate"
	done <<<"$rows"
	printf '}'
}

# Deletes the backups the retention policy selects (dump + manifest together).
apply_retention() {
	local dir="$1" extension="$2" stamps deletions ts
	stamps="$(find "$dir" -maxdepth 1 -type f -name "*${extension}" -printf '%f\n' | sed "s/${extension//./\\.}\$//")"
	if ! deletions="$(printf '%s\n' "$stamps" | sh "$RETENTION_SCRIPT")"; then
		log "retention failed for $dir"
		return 1
	fi
	for ts in $deletions; do
		if [[ "$DRY_RUN" == "1" ]]; then
			log "DRY_RUN: would delete $dir/$ts$extension and $dir/$ts.json"
		else
			log "retention: deleting $dir/$ts$extension"
			rm -f -- "$dir/$ts$extension" "$dir/$ts.json"
		fi
	done
	# Orphaned manifests (their dump was never renamed into place) older than 1 day.
	find "$dir" -maxdepth 1 -type f -name '*.json' -mmin +1440 | while IFS= read -r mf; do
		[ -e "${mf%.json}$extension" ] && continue
		if [[ "$DRY_RUN" == "1" ]]; then
			log "DRY_RUN: would delete orphaned manifest $mf"
		else
			log "retention: deleting orphaned manifest $mf"
			rm -f -- "$mf"
		fi
	done
	return 0
}

STATUS_ENTRIES=()
FAILED=0

# Appends a status.json entry for one target.
record_status() {
	local target="$1" host="$2" database="$3" realm_id="$4" run_at="$5" error="$6"
	local dir="$BACKUP_ROOT/$database/$target" last_success_at="" last_backup=""
	if [[ -f "$dir/.last-success" ]]; then
		{
			read -r last_success_at
			read -r last_backup
		} <"$dir/.last-success"
	fi
	STATUS_ENTRIES+=("{\"target\":$(json_string "$target"),\"database\":$(json_string "$database"),\"host\":$(json_string "$host"),\"realmId\":${realm_id:-null},\"lastRunAt\":$(json_string "$run_at"),\"lastSuccessAt\":$(json_string_or_null "$last_success_at"),\"lastBackup\":$(json_string_or_null "$last_backup"),\"lastError\":$(json_string_or_null "$error")}")
}

backup_target() {
	local target="$1" host="$2" database="$3"
	local dir="$BACKUP_ROOT/$database/$target" realm_id="" ts created_at error=""
	[[ "$target" =~ ^realm([0-9]+)$ ]] && realm_id="$((10#${BASH_REMATCH[1]}))"
	ts="$(date -u +%Y%m%dT%H%M%SZ)"
	created_at="$(iso_from_stamp "$ts")"

	if [[ "$DRY_RUN" == "1" ]]; then
		log "DRY_RUN: would dump $database from $host:$MYSQL_PORT to $dir/$ts.sql.gz"
		[[ -d "$dir" ]] && apply_retention "$dir" .sql.gz
		return 0
	fi

	if ! mkdir -p "$dir"; then
		error="cannot create $dir"
	else
		find "$dir" -maxdepth 1 -type f -name '*.partial' -mmin +"$STALE_PARTIAL_MINUTES" -delete 2>/dev/null
		error="$(dump_database "$target" "$host" "$database" "$realm_id" "$dir" "$ts" "$created_at")"
	fi

	if [[ -n "$error" ]]; then
		log "FAILED $database/$target: $error"
		FAILED=1
	else
		apply_retention "$dir" .sql.gz || FAILED=1
	fi
	record_status "$target" "$host" "$database" "$realm_id" "$created_at" "$error"
}

# Runs one dump. Prints an error message on stdout if it failed, nothing on success.
dump_database() {
	local target="$1" host="$2" database="$3" realm_id="$4" dir="$5" ts="$6" created_at="$7"
	local dump="$dir/$ts.sql.gz" manifest="$dir/$ts.json" stderr_file server_version table_rows
	local started finished size sha256 dump_status gzip_status client_version

	if ! [[ "$database" =~ ^[A-Za-z0-9_]+$ ]]; then
		printf 'invalid database name %s' "$database"
		return
	fi
	stderr_file="$(mktemp)"

	if ! server_version="$(mysql_query "$host" 'SELECT VERSION()' 2>"$stderr_file")"; then
		printf 'SELECT VERSION() failed: %s' "$(tail -n 5 "$stderr_file")"
		rm -f -- "$stderr_file"
		return
	fi
	# information_schema_stats_expiry=0: fresh row estimates instead of the 24h cached statistics.
	if ! table_rows="$(mysql_query "$host" "SET SESSION information_schema_stats_expiry = 0; SELECT TABLE_NAME, IFNULL(TABLE_ROWS, 0) FROM information_schema.TABLES WHERE TABLE_SCHEMA = '$database' AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME" 2>"$stderr_file")"; then
		printf 'reading table list failed: %s' "$(tail -n 5 "$stderr_file")"
		rm -f -- "$stderr_file"
		return
	fi
	client_version="$(mysqldump --version 2>/dev/null)"

	log "dumping $database from $host to $dump"
	started="$(date +%s)"
	mysqldump "${MYSQLDUMP_OPTIONS[@]}" --host="$host" --port="$MYSQL_PORT" --user="$MYSQL_USER" "$database" 2>"$stderr_file" |
		gzip -c >"$dump.partial"
	local statuses=("${PIPESTATUS[@]}")
	dump_status="${statuses[0]}"
	gzip_status="${statuses[1]}"
	finished="$(date +%s)"

	if [[ "$dump_status" != "0" || "$gzip_status" != "0" ]]; then
		printf 'mysqldump exit %s, gzip exit %s: %s' "$dump_status" "$gzip_status" "$(tail -n 5 "$stderr_file")"
		rm -f -- "$stderr_file" "$dump.partial"
		return
	fi
	if [[ -s "$stderr_file" ]]; then
		log "mysqldump warnings for $database/$target: $(tail -n 5 "$stderr_file" | tr '\n' ' ')"
	fi
	rm -f -- "$stderr_file"

	if ! gzip -t "$dump.partial" 2>/dev/null; then
		printf 'gzip -t failed for %s' "$dump.partial"
		rm -f -- "$dump.partial"
		return
	fi
	size="$(stat -c %s "$dump.partial")"
	sha256="$(sha256sum "$dump.partial" | cut -d ' ' -f 1)"

	{
		printf '{\n'
		printf '  "kind": "mysqldump",\n'
		printf '  "database": %s,\n' "$(json_string "$database")"
		printf '  "target": %s,\n' "$(json_string "$target")"
		printf '  "realmId": %s,\n' "${realm_id:-null}"
		printf '  "host": %s,\n' "$(json_string "$host")"
		printf '  "port": %s,\n' "$MYSQL_PORT"
		printf '  "serverVersion": %s,\n' "$(json_string "$server_version")"
		printf '  "clientVersion": %s,\n' "$(json_string "$client_version")"
		printf '  "createdAt": %s,\n' "$(json_string "$created_at")"
		printf '  "file": %s,\n' "$(json_string "$ts.sql.gz")"
		printf '  "compression": "gzip",\n'
		printf '  "sizeBytes": %s,\n' "$size"
		printf '  "sha256": %s,\n' "$(json_string "$sha256")"
		printf '  "durationSec": %s,\n' "$((finished - started))"
		printf '  "tables": %s\n' "$(tables_json "$table_rows")"
		printf '}\n'
	} >"$manifest.partial" || {
		printf 'writing manifest failed'
		rm -f -- "$dump.partial" "$manifest.partial"
		return
	}

	# Flush the partials before renaming so a node crash cannot leave a truncated
	# file under its final name (both GNU and busybox sync accept file arguments).
	sync -- "$dump.partial" "$manifest.partial" 2>/dev/null || true
	if ! mv -f -- "$manifest.partial" "$manifest" || ! mv -f -- "$dump.partial" "$dump"; then
		printf 'renaming %s into place failed' "$dump.partial"
		rm -f -- "$dump.partial" "$manifest.partial" "$manifest"
		return
	fi
	printf '%s\n%s\n' "$created_at" "$database/$target/$ts.sql.gz" >"$dir/.last-success"
	log "ok $database/$target: $size bytes, sha256 $sha256, $((finished - started))s"
}

write_status() {
	local started_at="$1" finished_at ok=true entries="" entry
	finished_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
	((FAILED)) && ok=false
	for entry in "${STATUS_ENTRIES[@]}"; do
		[[ -n "$entries" ]] && entries+=$',\n'
		entries+="    $entry"
	done
	printf '{\n  "job": "mysql-backup",\n  "startedAt": "%s",\n  "finishedAt": "%s",\n  "ok": %s,\n  "targets": [\n%s\n  ]\n}\n' \
		"$started_at" "$finished_at" "$ok" "$entries" >"$BACKUP_ROOT/status.json.partial" &&
		mv -f -- "$BACKUP_ROOT/status.json.partial" "$BACKUP_ROOT/status.json"
}

main() {
	local started_at entry target host database rest
	started_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

	if [[ -z "$TARGETS" ]]; then
		log "TARGETS is empty"
		exit 2
	fi
	if [[ "$DRY_RUN" != "1" && -z "${MYSQL_PWD:-}" ]]; then
		log "MYSQL_PWD is not set"
		exit 2
	fi
	if [[ ! -f "$RETENTION_SCRIPT" ]]; then
		log "retention script not found: $RETENTION_SCRIPT"
		exit 2
	fi
	export MYSQL_PWD

	local jobs=()
	for entry in $TARGETS; do
		IFS=: read -r target host database rest <<<"$entry"
		if ! [[ "$target" =~ ^[A-Za-z0-9_-]+$ && "$host" =~ ^[A-Za-z0-9.-]+$ && "$database" =~ ^[A-Za-z0-9_]+$ && -z "$rest" ]]; then
			log "invalid TARGETS entry '$entry' (expected <target>:<host>:<database>)"
			FAILED=1
			continue
		fi
		jobs+=("$target:$host:$database")
		if [[ "$BACKUP_WORLD" == "true" && "$database" == "acore_characters" ]]; then
			jobs+=("$target:$host:$WORLD_DATABASE")
		fi
	done

	for entry in "${jobs[@]}"; do
		IFS=: read -r target host database <<<"$entry"
		backup_target "$target" "$host" "$database"
	done

	if [[ "$DRY_RUN" == "1" ]]; then
		log "DRY_RUN: done, nothing written"
	elif ! mkdir -p "$BACKUP_ROOT" || ! write_status "$started_at"; then
		log "writing $BACKUP_ROOT/status.json failed"
		FAILED=1
	fi

	if ((FAILED)); then
		log "finished with errors"
		exit 1
	fi
	log "finished successfully"
}

main "$@"
