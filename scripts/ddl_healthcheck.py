#!/usr/bin/env python3
"""
Detect a silently stalled Mylar DDL queue.

The failure this exists for: on 13 Aug 2026 the DDL-QUEUE worker thread died on an
uncaught KeyError. systemd kept reporting the service as "active (running)" and the
web UI looked normal. Nobody noticed for eleven days, during which 179 items sat
Queued and nothing downloaded. From the outside, a dead queue and a finished queue
look identical - that is the whole problem.

Four independent checks, so no single blind spot hides a stall:

  1. service       - is mylar.service actually running
  2. worker death  - "Uncaught exception" logged inside the lookback window
  3. progress      - items are Queued but Completed+Failed has not moved since the
                     last run. This is the load-bearing check: it detects a stall
                     without guessing how long a queue "should" take, so a genuine
                     900-item backlog never false-positives.
  4. log freshness - service up but nothing written to mylar.log for a long time

Exit codes:  0 healthy   1 warning   2 critical

Usage:
    ddl_healthcheck.py                      # human-readable, always prints
    ddl_healthcheck.py --quiet              # print only when something is wrong (cron)
    ddl_healthcheck.py --webhook URL        # POST alerts to Discord/Slack/Gotify
    ddl_healthcheck.py --no-syslog          # skip logger(1)

Install (runs every 30 min, alerts to syslog):
    */30 * * * * /home/kerkness/mylar3/scripts/ddl_healthcheck.py --quiet

Check what it has been saying:
    journalctl -t mylar-healthcheck --since '7 days ago'
"""

import argparse
import json
import os
import shutil
import sqlite3
import subprocess
import sys
import time
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

DEFAULT_DB = os.path.join(ROOT, "mylar.db")
DEFAULT_LOG = os.path.join(ROOT, "logs", "mylar.log")
DEFAULT_STATE = os.path.join(ROOT, ".ddl_healthcheck.state")

OK, WARN, CRIT = 0, 1, 2
LABEL = {OK: "OK", WARN: "WARN", CRIT: "CRITICAL"}


def service_active(unit):
    """True if systemd reports the unit active. None if systemctl is unavailable."""
    if not shutil.which("systemctl"):
        return None
    try:
        r = subprocess.run(
            ["systemctl", "is-active", unit],
            capture_output=True, text=True, timeout=10,
        )
        return r.stdout.strip() == "active"
    except Exception:
        return None


def queue_counts(db_path):
    """Return {status: count} from ddl_info, read-only so we never block Mylar."""
    uri = "file:%s?mode=ro" % db_path
    con = sqlite3.connect(uri, uri=True, timeout=15)
    try:
        return dict(con.execute("SELECT status, COUNT(*) FROM ddl_info GROUP BY status"))
    finally:
        con.close()


def recent_exceptions(log_path, window_s):
    """Count 'Uncaught exception' lines near the tail, if the log was touched recently.

    Only the tail is read - the log rotates at 10MB and we care about now, not history.
    """
    if not os.path.exists(log_path):
        return 0
    if time.time() - os.path.getmtime(log_path) > window_s:
        return 0
    try:
        with open(log_path, "rb") as f:
            f.seek(0, os.SEEK_END)
            f.seek(max(0, f.tell() - 400_000))
            tail = f.read().decode("utf-8", "ignore")
    except Exception:
        return 0
    return tail.count("Uncaught exception")


def log_age_minutes(log_path):
    if not os.path.exists(log_path):
        return None
    return (time.time() - os.path.getmtime(log_path)) / 60.0


def read_state(path):
    try:
        with open(path) as f:
            return json.load(f)
    except Exception:
        return None


def write_state(path, state):
    try:
        tmp = path + ".tmp"
        with open(tmp, "w") as f:
            json.dump(state, f)
        os.replace(tmp, path)
    except Exception as e:
        print("  (could not write state file: %s)" % e, file=sys.stderr)


def notify_syslog(level, message):
    if not shutil.which("logger"):
        return
    pri = {OK: "info", WARN: "warning", CRIT: "err"}[level]
    try:
        subprocess.run(
            ["logger", "-t", "mylar-healthcheck", "-p", "daemon.%s" % pri, message],
            timeout=10,
        )
    except Exception:
        pass


def notify_webhook(url, message):
    """POST to a webhook. Discord and Gotify accept these keys; Slack accepts 'text'."""
    payload = json.dumps({"content": message, "text": message, "message": message})
    req = urllib.request.Request(
        url, data=payload.encode(), headers={"Content-Type": "application/json"}
    )
    try:
        urllib.request.urlopen(req, timeout=20)
    except Exception as e:
        print("  (webhook failed: %s)" % e, file=sys.stderr)


def main():
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--db", default=DEFAULT_DB)
    p.add_argument("--log", default=DEFAULT_LOG)
    p.add_argument("--state", default=DEFAULT_STATE)
    p.add_argument("--unit", default="mylar.service")
    p.add_argument("--stale-log-minutes", type=float, default=180.0,
                   help="warn if the log has not been written for this long (default 180)")
    p.add_argument("--exception-window-minutes", type=float, default=180.0,
                   help="how far back an uncaught exception still counts (default 180)")
    p.add_argument("--webhook", default=os.environ.get("MYLAR_HEALTHCHECK_WEBHOOK"))
    p.add_argument("--no-syslog", action="store_true")
    p.add_argument("--quiet", action="store_true",
                   help="print nothing when healthy (use for cron)")
    args = p.parse_args()

    problems = []   # (level, text)
    notes = []
    level = OK

    # ---- 1. service -------------------------------------------------------
    active = service_active(args.unit)
    if active is False:
        problems.append((CRIT, "%s is not running" % args.unit))
    elif active is None:
        notes.append("service state unknown (no systemctl)")

    # ---- 2. queue counts --------------------------------------------------
    try:
        counts = queue_counts(args.db)
    except Exception as e:
        print("CRITICAL: cannot read %s: %s" % (args.db, e))
        notify_syslog(CRIT, "cannot read ddl_info: %s" % e)
        return CRIT

    queued = counts.get("Queued", 0)
    downloading = counts.get("Downloading", 0)
    done = counts.get("Completed", 0) + counts.get("Failed", 0)
    notes.append("queued=%d downloading=%d completed+failed=%d" % (queued, downloading, done))

    # ---- 3. progress since last run (the load-bearing check) --------------
    now = time.time()
    prev = read_state(args.state)
    if prev is None:
        notes.append("no previous state - baseline recorded, progress check starts next run")
    elif queued > 0:
        elapsed_min = (now - prev.get("ts", now)) / 60.0
        if done <= prev.get("done", -1) and elapsed_min >= 20:
            problems.append((
                CRIT,
                "queue is not draining: %d item(s) Queued and nothing has completed or "
                "failed in %.0f minutes" % (queued, elapsed_min),
            ))
        else:
            notes.append("progress since last run: +%d in %.0f min"
                         % (done - prev.get("done", done), elapsed_min))

    write_state(args.state, {"ts": now, "done": done, "queued": queued})

    # ---- 4. worker death --------------------------------------------------
    exc = recent_exceptions(args.log, args.exception_window_minutes * 60)
    if exc:
        problems.append((
            CRIT,
            "%d uncaught exception(s) in the log within the last %.0f min - the "
            "DDL worker thread may have died" % (exc, args.exception_window_minutes),
        ))

    # ---- 5. log freshness -------------------------------------------------
    age = log_age_minutes(args.log)
    if age is None:
        problems.append((WARN, "log file not found: %s" % args.log))
    else:
        notes.append("log last written %.0f min ago" % age)
        if active is not False and age > args.stale_log_minutes:
            problems.append((
                WARN,
                "service is up but the log has not been written for %.0f minutes" % age,
            ))

    # ---- report -----------------------------------------------------------
    if problems:
        level = max(lv for lv, _ in problems)

    lines = ["[%s] Mylar DDL queue" % LABEL[level]]
    for lv, text in problems:
        lines.append("  %-8s %s" % (LABEL[lv] + ":", text))
    for n in notes:
        lines.append("  note:    %s" % n)
    report = "\n".join(lines)

    if problems or not args.quiet:
        print(report)

    if problems:
        summary = "%s - %s" % (LABEL[level], "; ".join(t for _, t in problems))
        if not args.no_syslog:
            notify_syslog(level, summary)
        if args.webhook:
            notify_webhook(args.webhook, "Mylar DDL queue %s" % summary)

    return level


if __name__ == "__main__":
    sys.exit(main())
