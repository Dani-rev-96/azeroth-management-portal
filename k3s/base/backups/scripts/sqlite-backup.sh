#!/bin/sh
# sqlite-backup.sh — nightly copies of the portal's SQLite databases.
#
# Runs in the keinos/sqlite3 image (alpine/busybox, no bash) from the CronJob in
# k3s/base/backups/sqlite-cronjob.yaml, so this is POSIX sh. Tools used: sqlite3, gzip, sha256sum,
# date, find, stat, mv, mkdir, rm, mktemp, tail, tr, sed, cut.
#
# The source databases are in WAL mode and are read through a read-only mount with the URI
# `file:<path>?mode=ro`. SQLite (>= 3.22) supports reading a WAL database whose -shm file is
# read-only: the reader builds a private copy of the WAL index and holds WAL_READ_LOCK(0) on the
# -shm, which stops the portal from checkpointing over pages that are being read. `.backup` uses
# the online backup API, which restarts if another process writes to the source in between steps,
# so the copy is a consistent snapshot. The portal opens all three databases at startup (Nitro
# plugin open-sqlite-databases.ts), so the -wal/-shm files normally exist. If a database still has
# no -wal (clean checkpoint, e.g. the plugin failed), the script retries with `immutable=1`, which
# needs no -shm and is safe for a checkpointed file — but only in that case.
#
# Layout:
#   $BACKUP_ROOT/<name>/<ts>.db.gz     gzip'ed copy (journal_mode switched to DELETE, integrity_check ok)
#   $BACKUP_ROOT/<name>/<ts>.json      manifest
#   $BACKUP_ROOT/<name>/.last-success  last successful createdAt + file
#   $BACKUP_ROOT/status.json           summary of the last run, per database
# <name> is the file name without .db, <ts> the UTC start time (YYYYMMDDTHHMMSSZ).
#
# Env:
#   SQLITE_SOURCE_DIR  default /data/sqlite
#   SQLITE_DATABASES   default "mappings.db user-settings.db portal-config.db"
#   BACKUP_ROOT        default /backups/sqlite
#   DRY_RUN            1 = no copies, no writes, no deletions; only log what would happen.
#   RETENTION_SCRIPT   default: backup-retention.sh next to this script.
#   KEEP_DAYS / KEEP_WEEKLY / KEEP_MONTHLY are passed through to the retention script.
set -u

SQLITE_SOURCE_DIR="${SQLITE_SOURCE_DIR:-/data/sqlite}"
SQLITE_DATABASES="${SQLITE_DATABASES:-mappings.db user-settings.db portal-config.db}"
BACKUP_ROOT="${BACKUP_ROOT:-/backups/sqlite}"
DRY_RUN="${DRY_RUN:-0}"
RETENTION_SCRIPT="${RETENTION_SCRIPT:-$(dirname "$0")/backup-retention.sh}"
STALE_PARTIAL_MINUTES=360

FAILED=0
STATUS_FILE=""

log() {
	printf '%s sqlite-backup: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >&2
}

# JSON string literal (quotes included); newlines/tabs become spaces.
json_string() {
	printf '"%s"' "$(printf '%s' "$1" | tr '\n\r\t' '   ' | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g')"
}

json_string_or_null() {
	if [ -n "$1" ]; then json_string "$1"; else printf 'null'; fi
}

# 20260105T033000Z -> 2026-01-05T03:30:00Z
iso_from_stamp() {
	printf '%s\n' "$1" | sed 's/^\(....\)\(..\)\(..\)T\(..\)\(..\)\(..\)Z$/\1-\2-\3T\4:\5:\6Z/'
}

# Deletes the backups the retention policy selects (copy + manifest together).
apply_retention() {
	dir="$1"
	if ! deletions="$(find "$dir" -maxdepth 1 -type f -name '*.db.gz' | sed -e 's#^.*/##' -e 's/\.db\.gz$//' | sh "$RETENTION_SCRIPT")"; then
		log "retention failed for $dir"
		return 1
	fi
	for ts in $deletions; do
		if [ "$DRY_RUN" = "1" ]; then
			log "DRY_RUN: would delete $dir/$ts.db.gz and $dir/$ts.json"
		else
			log "retention: deleting $dir/$ts.db.gz"
			rm -f -- "$dir/$ts.db.gz" "$dir/$ts.json"
		fi
	done
	# Orphaned manifests (their dump was never renamed into place) older than 1 day.
	find "$dir" -maxdepth 1 -type f -name '*.json' -mmin +1440 | while IFS= read -r mf; do
		[ -e "${mf%.json}.db.gz" ] && continue
		if [ "$DRY_RUN" = "1" ]; then
			log "DRY_RUN: would delete orphaned manifest $mf"
		else
			log "retention: deleting orphaned manifest $mf"
			rm -f -- "$mf"
		fi
	done
	return 0
}

# Prints "table<TAB>rows" lines of a database as a JSON object.
tables_json() {
	database="$1"
	first=1
	printf '{'
	sqlite3 -batch -noheader "$database" "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name" |
		while IFS= read -r table; do
			[ -n "$table" ] || continue
			quoted="$(printf '%s' "$table" | sed 's/"/""/g')"
			rows="$(sqlite3 -batch -noheader "$database" "SELECT COUNT(*) FROM \"$quoted\"")"
			case "$rows" in '' | *[!0-9]*) rows=0 ;; esac
			if [ "$first" = 1 ]; then first=0; else printf ','; fi
			printf '%s:%s' "$(json_string "$table")" "$rows"
		done
	printf '}'
}

# Copies one database. Prints an error message on stdout if it failed, nothing on success.
copy_database() {
	source="$1" dir="$2" ts="$3" created_at="$4" name="$5"
	copy="$dir/$ts.db.partial"
	dump="$dir/$ts.db.gz"
	manifest="$dir/$ts.json"
	stderr_file="$(mktemp)"

	started="$(date +%s)"
	if ! sqlite3 "file:$source?mode=ro" ".timeout 10000" ".backup '$copy'" 2>"$stderr_file"; then
		# A clean checkpointed file (no -wal) can be opened with immutable=1, which needs no
		# -shm on a read-only mount. Only safe in exactly that case; with a live -wal the
		# normal read-only open must be used so SQLite keeps honouring the locks.
		if [ -f "$source-wal" ] || ! sqlite3 "file:$source?mode=ro&immutable=1" ".timeout 10000" ".backup '$copy'" 2>"$stderr_file"; then
			printf '.backup failed: %s' "$(tail -n 5 "$stderr_file")"
			rm -f -- "$stderr_file" "$copy" "$copy-journal"
			return
		fi
	fi
	# The copy keeps the WAL flag of the source; switch it to a plain rollback-journal file so the
	# backup is a single self-contained file. The source is not touched.
	if ! sqlite3 -batch "$copy" 'PRAGMA journal_mode = DELETE;' >/dev/null 2>"$stderr_file"; then
		printf 'journal_mode on copy failed: %s' "$(tail -n 5 "$stderr_file")"
		rm -f -- "$stderr_file" "$copy" "$copy-wal" "$copy-shm"
		return
	fi
	integrity="$(sqlite3 -batch "$copy" 'PRAGMA integrity_check;' 2>"$stderr_file")"
	if [ "$integrity" != "ok" ]; then
		printf 'integrity_check failed: %s %s' "$(printf '%s' "$integrity" | head -n 5)" "$(tail -n 5 "$stderr_file")"
		rm -f -- "$stderr_file" "$copy"
		return
	fi
	rm -f -- "$stderr_file"
	tables="$(tables_json "$copy")"
	uncompressed_size="$(stat -c %s "$copy")"

	if ! gzip -c "$copy" >"$dump.partial"; then
		printf 'gzip failed for %s' "$copy"
		rm -f -- "$copy" "$dump.partial"
		return
	fi
	rm -f -- "$copy"
	finished="$(date +%s)"
	if ! gzip -t "$dump.partial" 2>/dev/null; then
		printf 'gzip -t failed for %s' "$dump.partial"
		rm -f -- "$dump.partial"
		return
	fi
	size="$(stat -c %s "$dump.partial")"
	sha256="$(sha256sum "$dump.partial" | cut -d ' ' -f 1)"
	sqlite_version="$(sqlite3 --version | cut -d ' ' -f 1)"

	if ! {
		printf '{\n'
		printf '  "kind": "sqlite",\n'
		printf '  "database": %s,\n' "$(json_string "$name")"
		printf '  "source": %s,\n' "$(json_string "$source")"
		printf '  "sqliteVersion": %s,\n' "$(json_string "$sqlite_version")"
		printf '  "createdAt": %s,\n' "$(json_string "$created_at")"
		printf '  "file": %s,\n' "$(json_string "$ts.db.gz")"
		printf '  "compression": "gzip",\n'
		printf '  "sizeBytes": %s,\n' "$size"
		printf '  "uncompressedSizeBytes": %s,\n' "$uncompressed_size"
		printf '  "sha256": %s,\n' "$(json_string "$sha256")"
		printf '  "durationSec": %s,\n' "$((finished - started))"
		printf '  "integrityCheck": "ok",\n'
		printf '  "tables": %s\n' "$tables"
		printf '}\n'
	} >"$manifest.partial"; then
		printf 'writing manifest failed'
		rm -f -- "$dump.partial" "$manifest.partial"
		return
	fi

	# Flush the partials before renaming so a node crash cannot leave a truncated
	# file under its final name (both GNU and busybox sync accept file arguments).
	sync -- "$dump.partial" "$manifest.partial" 2>/dev/null || true
	if ! mv -f -- "$manifest.partial" "$manifest" || ! mv -f -- "$dump.partial" "$dump"; then
		printf 'renaming %s into place failed' "$dump.partial"
		rm -f -- "$dump.partial" "$manifest.partial" "$manifest"
		return
	fi
	printf '%s\n%s\n' "$created_at" "$name/$ts.db.gz" >"$dir/.last-success"
	log "ok $name: $size bytes, sha256 $sha256, $((finished - started))s"
}

record_status() {
	name="$1" run_at="$2" error="$3"
	last_success_at=""
	last_backup=""
	if [ -f "$BACKUP_ROOT/$name/.last-success" ]; then
		{
			read -r last_success_at
			read -r last_backup
		} <"$BACKUP_ROOT/$name/.last-success"
	fi
	printf '{"database":%s,"lastRunAt":%s,"lastSuccessAt":%s,"lastBackup":%s,"lastError":%s}\n' \
		"$(json_string "$name")" "$(json_string "$run_at")" "$(json_string_or_null "$last_success_at")" \
		"$(json_string_or_null "$last_backup")" "$(json_string_or_null "$error")" >>"$STATUS_FILE"
}

backup_database() {
	file="$1"
	name="${file%.db}"
	dir="$BACKUP_ROOT/$name"
	source="$SQLITE_SOURCE_DIR/$file"
	ts="$(date -u +%Y%m%dT%H%M%SZ)"
	created_at="$(iso_from_stamp "$ts")"
	error=""

	if [ "$DRY_RUN" = "1" ]; then
		log "DRY_RUN: would copy $source to $dir/$ts.db.gz"
		if [ -d "$dir" ]; then apply_retention "$dir"; fi
		return 0
	fi

	if [ ! -f "$source" ]; then
		error="source database $source not found"
	elif ! mkdir -p "$dir"; then
		error="cannot create $dir"
	else
		find "$dir" -maxdepth 1 -type f -name '*.partial' -mmin +"$STALE_PARTIAL_MINUTES" -exec rm -f {} + 2>/dev/null
		error="$(copy_database "$source" "$dir" "$ts" "$created_at" "$name")"
	fi

	if [ -n "$error" ]; then
		log "FAILED $name: $error"
		FAILED=1
	else
		apply_retention "$dir" || FAILED=1
	fi
	record_status "$name" "$created_at" "$error"
}

write_status() {
	started_at="$1"
	finished_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
	ok=true
	[ "$FAILED" = 0 ] || ok=false
	{
		printf '{\n  "job": "portal-sqlite-backup",\n  "startedAt": "%s",\n  "finishedAt": "%s",\n  "ok": %s,\n  "targets": [\n' \
			"$started_at" "$finished_at" "$ok"
		sed -e 's/^/    /' -e '$!s/$/,/' "$STATUS_FILE"
		printf '  ]\n}\n'
	} >"$BACKUP_ROOT/status.json.partial" && mv -f -- "$BACKUP_ROOT/status.json.partial" "$BACKUP_ROOT/status.json"
}

main() {
	started_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
	if [ ! -f "$RETENTION_SCRIPT" ]; then
		log "retention script not found: $RETENTION_SCRIPT"
		exit 2
	fi
	STATUS_FILE="$(mktemp)"

	for file in $SQLITE_DATABASES; do
		case "$file" in
		*.db) ;;
		*)
			log "invalid SQLITE_DATABASES entry '$file' (expected <name>.db)"
			FAILED=1
			continue
			;;
		esac
		case "$file" in
		*[!A-Za-z0-9._-]*)
			log "invalid SQLITE_DATABASES entry '$file'"
			FAILED=1
			continue
			;;
		esac
		backup_database "$file"
	done

	if [ "$DRY_RUN" = "1" ]; then
		log "DRY_RUN: done, nothing written"
	elif ! mkdir -p "$BACKUP_ROOT" || ! write_status "$started_at"; then
		log "writing $BACKUP_ROOT/status.json failed"
		FAILED=1
	fi
	rm -f -- "$STATUS_FILE"

	if [ "$FAILED" != 0 ]; then
		log "finished with errors"
		exit 1
	fi
	log "finished successfully"
}

main "$@"
