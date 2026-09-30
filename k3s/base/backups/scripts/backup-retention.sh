#!/bin/sh
# backup-retention.sh — decides which backups to delete. It does not delete anything.
#
# stdin : backup timestamps, one per line, format YYYYMMDDTHHMMSSZ (UTC), e.g. 20260105T033000Z
# stdout: the timestamps that should be DELETED, sorted ascending, one per line
#
# Policy (each rule is evaluated independently; a backup is kept if any rule keeps it):
#   daily   : keep every backup younger than KEEP_DAYS days (default 7), measured from NOW.
#             Timestamps in the future are kept as well.
#   weekly  : keep the newest backup of each ISO week (ISO 8601 week-year + week number),
#             for the KEEP_WEEKLY (default 4) most recent weeks that contain a backup.
#   monthly : keep the newest backup of each calendar month (UTC),
#             for the KEEP_MONTHLY (default 6) most recent months that contain a backup.
# Weekly/monthly count buckets that contain backups (like restic --keep-weekly), not calendar
# weeks: if backups stop for a while, the newest ones are still kept and nothing gets wiped.
#
# Env:
#   NOW           reference time, same format as the input (default: current UTC time)
#   KEEP_DAYS     default 7
#   KEEP_WEEKLY   default 4
#   KEEP_MONTHLY  default 6
#
# Lines that are not a valid timestamp are never deleted; they are reported on stderr.
# Pure POSIX sh + awk (all date math in awk), so it runs the same in busybox (alpine) and GNU
# (mysql:9 / Oracle Linux) images and is deterministic for tests.
set -eu

NOW="${NOW:-$(date -u +%Y%m%dT%H%M%SZ)}"
KEEP_DAYS="${KEEP_DAYS:-7}"
KEEP_WEEKLY="${KEEP_WEEKLY:-4}"
KEEP_MONTHLY="${KEEP_MONTHLY:-6}"

for value in "$KEEP_DAYS" "$KEEP_WEEKLY" "$KEEP_MONTHLY"; do
	case "$value" in
	'' | *[!0-9]*)
		echo "backup-retention: KEEP_* values must be non-negative integers" >&2
		exit 2
		;;
	esac
done

awk -v now="$NOW" -v keepDays="$KEEP_DAYS" -v keepWeekly="$KEEP_WEEKLY" -v keepMonthly="$KEEP_MONTHLY" '
function isTimestamp(ts) {
  return ts ~ /^[0-9][0-9][0-9][0-9][01][0-9][0-3][0-9]T[0-2][0-9][0-5][0-9][0-5][0-9]Z$/
}
# Days since 1970-01-01 for a proleptic Gregorian date (Howard Hinnant, days_from_civil).
function daysFromCivil(y, m, d,    era, yoe, doy, doe) {
  if (m <= 2) y -= 1
  era = int((y >= 0 ? y : y - 399) / 400)
  yoe = y - era * 400
  doy = int((153 * (m > 2 ? m - 3 : m + 9) + 2) / 5) + d - 1
  doe = yoe * 365 + int(yoe / 4) - int(yoe / 100) + doy
  return era * 146097 + doe - 719468
}
function epochSeconds(ts) {
  return daysFromCivil(substr(ts, 1, 4) + 0, substr(ts, 5, 2) + 0, substr(ts, 7, 2) + 0) * 86400 \
    + substr(ts, 10, 2) * 3600 + substr(ts, 12, 2) * 60 + substr(ts, 14, 2)
}
# ISO 8601 week key "YYYY-Www": the week belongs to the year of its Thursday.
function isoWeekKey(ts,    days, weekday, thursday, isoYear, week) {
  days = daysFromCivil(substr(ts, 1, 4) + 0, substr(ts, 5, 2) + 0, substr(ts, 7, 2) + 0)
  weekday = (days + 3) % 7            # 0 = Monday (1970-01-01 was a Thursday)
  if (weekday < 0) weekday += 7
  thursday = days - weekday + 3
  isoYear = substr(ts, 1, 4) + 0
  if (thursday < daysFromCivil(isoYear, 1, 1)) isoYear -= 1
  else if (thursday >= daysFromCivil(isoYear + 1, 1, 1)) isoYear += 1
  week = int((thursday - daysFromCivil(isoYear, 1, 1)) / 7) + 1
  return sprintf("%04d-W%02d", isoYear, week)
}
BEGIN {
  if (!isTimestamp(now)) { print "backup-retention: invalid NOW: " now > "/dev/stderr"; invalidNow = 1; exit 2 }
  nowSeconds = epochSeconds(now)
  count = 0
}
{
  line = $0
  sub(/\r$/, "", line)
  if (line == "") next
  if (!isTimestamp(line)) { print "backup-retention: ignoring invalid timestamp: " line > "/dev/stderr"; next }
  if (line in seen) next
  seen[line] = 1
  items[++count] = line
}
END {
  if (invalidNow) exit 2   # exit in BEGIN still runs END
  if (count == 0) exit 0
  # insertion sort, newest first (lists are small: a few dozen entries per target)
  for (i = 2; i <= count; i++) {
    value = items[i]
    for (j = i - 1; j >= 1 && items[j] < value; j--) items[j + 1] = items[j]
    items[j + 1] = value
  }
  # The newest backup is always kept, even when every KEEP_* is 0.
  keep[items[1]] = 1
  weeksKept = 0
  monthsKept = 0
  for (i = 1; i <= count; i++) {
    ts = items[i]
    age = nowSeconds - epochSeconds(ts)
    if (age < keepDays * 86400) keep[ts] = 1
    week = isoWeekKey(ts)
    if (!(week in weekSeen)) {
      weekSeen[week] = 1
      if (weeksKept < keepWeekly) { keep[ts] = 1; weeksKept++ }
    }
    month = substr(ts, 1, 6)
    if (!(month in monthSeen)) {
      monthSeen[month] = 1
      if (monthsKept < keepMonthly) { keep[ts] = 1; monthsKept++ }
    }
  }
  for (i = count; i >= 1; i--) if (!(items[i] in keep)) print items[i]
}
'
