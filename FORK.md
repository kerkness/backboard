# kerkness/backboard — fork notes

A **soft fork** of [MylarComics/mylar3](https://github.com/MylarComics/mylar3). The engine
keeps tracking upstream; local changes stay small and documented so merges stay cheap.

## Why this fork exists

Upstream is alive but thin — roughly 9 commits/month, effectively one active maintainer.
Fixes that matter here (GetComics/provider breakage, DB locks, client API changes) do land
upstream, so staying merge-able is worth more than independence. This fork exists to carry
local fixes without waiting on review, not to diverge.

## The larger plan

The long-term goal is a **candidate-review acquisition flow**: when issue-level search
fails, widen to a series search, show the user real candidates, and resolve pack contents
*after* download instead of guessing before it.

**Plan of record:** [Mylar Fork Charter](https://claude.ai/code/artifact/5ea6c5d5-111f-446b-986f-e94cd89a603e)
— evidence, the seven-step flow, architecture decisions, and the phased sequence.
Read it before starting work; this file only carries what lives in the repo.

Nothing from that plan is implemented yet.

## Strategy — read this before making changes

Measured over the last 60 upstream commits (Feb–Aug 2026, ~9/month):

| Path | Commits | Divergence cost |
|---|---|---|
| `mylar/search_filer.py` | **0 / 60** | Free. The whole matching layer, untouched in six months. |
| `mylar/search.py` | 2 / 60 | Cheap. Search orchestration. |
| `mylar/getcomics.py` | 2 / 60 | Cheap. Query shapes, `check_for_pack`. |
| `mylar/api.py` | 4 / 60 | Cheap. **Primary work surface.** |
| `mylar/config.py` | 10 / 60 | Moderate. |
| `mylar/webserve.py` | 13 / 60 | Expensive — busiest file in the tree. |
| `data/interfaces/default/config.html` | 7 / 60 | Expensive. Don't touch. |
| all other templates | 0–3 / 60 | Cheap. |

Two sanctioned places to diverge:

1. **The search/match layer** (`search_filer.py`, `search.py`, `getcomics.py`) — the
   lowest-churn code in the project. This is where the new flow's logic belongs.
2. **The API** (`api.py`) — extend it with new endpoints rather than editing
   `webserve.py` handlers in place.

**Correction (26 Aug 2026):** an earlier version of this file claimed the UI layer was
the most-churned part of the codebase and that UI work should therefore happen elsewhere.
That was wrong, and the reasoning is worth recording so it isn't re-litigated. The raw
commit count treated a one-line bugfix the same as a redesign. Inspecting the actual
commits: 550 insertions across `data/` in six months, entirely config-screen options and
bugfixes — no redesign. Template churn is concentrated in `config.html` (7/60); most
templates were touched **zero** times. Rewriting the views is cheap. The controller
behind them (`webserve.py`, 13/60) is the real hazard — so put new flow logic in new
modules and new endpoints, not in existing handlers.

## UI architecture — decided 26 Aug 2026

**A static SPA (Vite + React + TypeScript), built into `data/ui/` and served by Mylar
itself at `/ui`.**

CherryPy already mounts static directories in `mylar/webstart.py` (`/js`, `/css`,
`/images`), so adding `/ui` is a four-line change. Consequences that drove the decision:

- **Same origin as the API** — no CORS, existing auth applies, and `EventSource` against
  the SSE channel gives live download/unpack progress without polling.
- **No new runtime.** Deployment stays one systemd unit; the fork ships with its own UI.
- Dev runs a Vite server against `:8090` (the API already sends
  `Access-Control-Allow-Origin: *` on every JSON response, so this works unchanged).

Rejected, with reasons, so these don't get re-proposed:

- **Laravel / PHP** — needs a PHP runtime and a second service for no benefit the SPA
  doesn't already provide.
- **Next / Nuxt** — both exist for SSR and a Node server. No SEO, no public traffic, no
  server-side fetching benefit; a Node runtime re-introduces the weight that ruled out PHP.
- **NativePHP / Electron** — ships a runtime plus a browser engine to render what is
  already a web page, gives up multi-device access, and makes us a distributor (three
  platform builds, signing, update channel, app↔daemon version coupling).

Existing API surface to build on: 56 endpoints in `api.py` (`getIndex`, `getComic`,
`addComic`, `getWanted`, `getUpcoming`, `getHistory`, `forceSearch`,
`queueIssue`/`unqueueIssue`, `changeStatus`, `refreshComic`, covers via
`getArt`/`getIssueArt`) plus `eventStreamResponse`. Known gaps: no config/settings
endpoints and no pull-list endpoint — settings stay in the existing interface.

## Branch layout

| Branch | Purpose |
|---|---|
| `stable` | Pristine mirror of `mylarcomics/stable`. **Never commit here.** |
| `nightly` | Pristine mirror of `mylarcomics/nightly`, if tracked. |
| `kerkness` | Upstream + the local patches below. This is what runs. |
| `fix/*` | Single fixes, branched off upstream `nightly`, for upstreaming. |

**Upstreaming: not planned (decided 1 Sep 2026).** Several patches here are genuine
upstream bugs (#5, #8, #11) and would be accepted, but separating them cleanly would mean
splitting this into two repositories, and that overhead is not worth it for this project.
Fixes are recorded here as local patches. The `fix/*` convention stays available if that
judgement ever changes.

## Remotes

```
mylarcomics   https://github.com/MylarComics/mylar3.git   # upstream, fetch only
fork          git@github.com:kerkness/backboard.git       # this fork
origin        https://github.com/mylar3/mylar3.git        # original, effectively dead
                                                          # (master last moved Aug 2025)
```

## Local patches

All are local-only — none exist upstream. Each is its own commit; read the commit message
before resolving a conflict against it.

### 1. `fix(ddl): guard link fallbacks to prevent DDL-QUEUE thread death` — `mylar/getcomics.py`

`parse_downloadresults()` walks `ddl_priority_order` and indexes `site_position[]` for
progressively less-preferred keys. The terminal fallback for mega, pixeldrain, mediafire
and main was unguarded, so a host offered at only one quality tier raised `KeyError`,
which escaped the worker loop and killed the DDL-QUEUE thread.

Seen in production: thread dead 13–24 Aug 2026, 179 items `Queued`, 28 stuck
`Downloading`, systemd still reporting `active (running)` throughout.

*Conflict risk: low.* `getcomics.py` moved twice in six months.
*Upstreamable: yes* — branch `fix/ddl-link-fallback-keyerror` is prepared against nightly.

### 2. `feat(ddl): repopulate queue on startup and survive poisoned items` — `mylar/queues/ddl.py`, `mylar/__init__.py`

Adds `mylar.DDL_QUEUE.put('startup')` so the worker re-queues rows left in
`Queued`/`Downloading` after a restart, with resume support for partial files. Wraps
per-item processing in `try/except/finally` so one bad item is marked `Failed` and skipped
instead of taking the worker down; the `finally` also clears `mylar.DDL_LOCK`, which some
error paths could leave stuck `True`.

*Conflict risk: **high**.* This is the largest divergence and it restructures the worker
loop. Upstream is actively working the same area — see `14fdaa12`, "catch network errors
in DDL downloaders to prevent thread death" (Aug 2026). Expect to hand-resolve, and check
whether upstream has since solved this a different way.

### 3. `fix(sabnzbd): add connect/read timeouts` — `mylar/webserve.py`

Both `requests.get()` calls in the SAB history check lacked timeouts; an unresponsive SAB
host could hang the thread indefinitely. Now `timeout=(5, 20)`.

*Conflict risk: moderate* — `webserve.py` is high-churn, but this is a two-line change.

### 4. `feat(search): record what was searched and why results were rejected` — `mylar/search_audit.py` (new), `mylar/search_filer.py`, `mylar/getcomics.py`, `mylar/api.py`, `mylar/__init__.py`

Phase 02. `_process_entry` returned a bare `None` at 18 rejection points and
`check_for_first_result` kept only the first accepted match, so a failed search left no
evidence. Each rejection now goes through `_reject(code, detail)` — the return contract is
unchanged, the reason just stops being discarded — and `search_audit` records the run.

Tables `search_runs` and `search_candidates`. A run is held per-thread and flushed in one
transaction at the end, so a page-walk doesn't hammer sqlite mid-search; pruned to the last
20 runs per issue. API: `searchIssue`, `searchSeries`, `getSearchRuns`.

Note `search.py:968` constructs `GC()` without comicid/issueid; they are read from
`is_info` instead, so search.py needs no change.

*Conflict risk: low.* `search_filer.py` is 0/60 and the edits are mechanical one-liners.

### 5. `fix(sabnzbd): stop treating every error as an SSL failure` — `mylar/webserve.py`

`if requests.exceptions.SSLError:` (7545, 7632) tests a **class object** and is therefore
always true, so any failure — including SAB simply not running — fell into the
"retry without SSL verification" path. That retry's two `requests.get` calls had no
timeout, unlike the calls it retries (patch #3), so startup blocked on the OS connect
timeout for 2-3 minutes on every restart.

Now `isinstance(e, requests.exceptions.SSLError)`, plus `timeout=(5, 20)` on both retry
calls. The AirDC++ copy of the same guard is fixed too; its retry already had a timeout.

*Upstreamable: yes* — this is an upstream bug, not a fork concern.

### 6. `feat(candidates): act on results the matcher rejected` — `mylar/candidate_actions.py` (new), `mylar/queues/ddl.py`, `mylar/api.py`, `mylar/config.py`, `mylar/__init__.py`

Download, one-shot, ComicVine lookup and ignore, on any candidate recorded by patch #4.

Downloads reuse the existing GetComics path (`loadsite` → `parse_downloadresults`), which
is what turns a posting URL into real host links. **They are staged, never
post-processed.** Bypassing the matcher also bypasses what stops Mylar filing a wrong file
into a series folder, so there are two independent guards: the download is queued with
`issueid=None`, and `queues/ddl.py` diverts the finished download into
`CANDIDATE_FOLDER` (default `<ddl_location>/candidates`) and skips PP. The staging marker
rides inside `comicinfo`, which the queue payload already carries verbatim — so
`getcomics.py` needed no change.

Adds `action`, `action_detail`, `ddl_id` to `search_candidates` (via the
SELECT/OperationalError pattern) and `CANDIDATE_FOLDER` to config.

Note `parse_downloadresults` is the function patch #1 guards. User-chosen postings will
exercise far more link-shape variety than matched downloads do; watch for KeyErrors there.

*Conflict risk: low* for the new module, *moderate* for `queues/ddl.py` (upstream is
active in that file — see patch #2).

### 7. `feat(pp): record what post-processing did with a download` — `mylar/pp_audit.py` (new), `mylar/PostProcessor.py`, `mylar/api.py`, `mylar/__init__.py`

Mylar decides each file's fate — filed, duplicate, failed — and reports it only to the
log. Tables `pp_runs` / `pp_files` now keep it.

Anchored in `PostProcessor.Process()` rather than `process.py`, because PostProcessor runs
on **its own thread** and a thread-local set upstream is not visible there. `Process()` has
~30 return points, all of them `queue.put(self.valreturn)`; they are routed through
`_finish_and_return()` so the audit flushes on the right thread without restructuring the
method. Correlation back to `ddl_info` is by filename, since `download_info` stops at
`process.py`.

**Mylar's own pack tally counts duplicates as processed issues** — the InSEXts pack
reported "8 issues" when all 8 were already owned — so `filed` is derived as
`total - duplicates - failures`, never taken from that number directly.

*Conflict risk: moderate.* `PostProcessor.py` is 4/60, but the 30-site exit change is broad.

### 8. `fix(pack): trust the resolved filename over the post's advertised range` — `mylar/getcomics.py`, `mylar/search.py`

A GetComics post can advertise a range it does not contain: `Insexts #1 - 13 (2015-2017)`
whose only file is `Insexts (1-8) (2015-2016)`. Mylar marked issues 9–13 `Snatched` against
it, and nothing could ever satisfy them.

`parse_downloadresults` now returns `resolved_filename`/`resolved_series`, and
`GC.pack_covers_issue()` tests an issue number against the ranges in that name (stripping
4-digit years first, so `(2015-2016)` is not read as an issue range). `search.py` narrows
`pack_issuelist` to issues the resolved file actually covers, logging `[PACK-RANGE]`.

Returns `None` when the name carries no readable range, and the caller then narrows
nothing — no evidence is not evidence of absence.

### 9. `feat(ddl): cap the page walk` — `mylar/getcomics.py`, `mylar/config.py`

`DDL_MAX_PAGES` (default 3). Predicted in the session log below: a bare-name query on a
common title returns hundreds of old postings that the matcher then correctly discards, at
`ddl_query_delay` seconds per page. Measured: `Thor` returned 400 results, `The Beauty` 487.

### 10. `feat(files): manual matching for staged files` — `mylar/api.py`

`getStagedFiles`, `matchStagedFile`, `deleteStagedFile`. Paths are resolved with
`realpath` and refused unless inside the staging or DDL roots.

`matchStagedFile` constructs `process.Process` with **keyword** arguments — see patch #11
for why that matters.

### 11. `fix(api): issueProcess did nothing at all` — `mylar/api.py`

`_issueProcess` called `process.Process(self.comicid, self.folder, self.issueid)`
positionally against `Process(nzb_name, nzb_folder, failed, issueid, comicid, ...)`, so
`comicid` landed in `nzb_name` and `issueid` in `failed`.

The consequence is worse than a mis-named file. `post_process()` branches on
`if self.failed is False:` and `if self.failed is True:` — identity checks. A string
`failed` (the issueid) matches **neither**, so both branches were skipped: no
post-processing, no failure handling, no error. The endpoint silently did nothing whenever
an issueid was supplied.

Now bound by keyword, with the folder basename as `nzb_name` and `apicall=True`.

*Upstream bug.* **Not being upstreamed** — see the note under Branch layout.

### 12. `feat(files): per-series file reconciliation` — `mylar/api.py`

`getSeriesFiles` pairs files found under the staging/DDL roots with the issues they look
like they satisfy, so a Snatched-but-never-arrived issue can be matched by hand.

Issue numbers are parsed from filenames with the series name removed first, so
`Sandman v1 02.cbr` yields 2 rather than 1 (the volume marker), and `American Splendor 001
(2006)` yields 1 rather than 2006. Pack ranges return None — no suggestion beats a wrong
one. Tested against ten real filename shapes from this library.

Note packs are already extracted on disk: `zip_zip()` unpacks a `.zip` before the DDL
queue sees it, so individual issue files are directly matchable without archive handling.

`getFileCover` serves a cached thumbnail of a file's first page. It reuses
`getimage.open_archive` (which also handles a zip mis-named `.cbr`) and `comic_pages`, but
**not** `extract_image` — that writes to a single fixed `temp_notif` path and would collide
across concurrent thumbnail requests. Covers are cached under `<cache>/file_covers` keyed
by path+mtime+size, so a changed file re-extracts. Verified against real `.cbr` files:
33 pages read, first page thumbnailed to 312x480 at ~47KB.

## Local config and data changes

Not code, so not in any commit — recorded here so they aren't a mystery later.

### `config.ini` — `pack_priority = True` (25 Aug 2026)

Off by default. Prepends a `"<Series> <Year>"` query ahead of the four issue-level shapes,
so collected runs can match. Set it with the service **stopped** — `writeconfig()` rewrites
the whole file (`mode='w+'`) and fires on events like the pull-list refresh, so a live edit
gets clobbered. It is not exposed in the web UI; the file is the only lever.

```bash
sudo systemctl stop mylar.service
sed -i 's/^pack_priority = False$/pack_priority = True/' /home/kerkness/mylar3/config.ini
sudo systemctl start mylar.service
```

Known cost: the query is unquoted, so common-word titles match broadly. `Of the Earth`
walked 31 result pages at `ddl_query_delay = 10` — over 5 minutes for one issue, against
~46s normally. A page-walk cap in `perform_search_queries` is a good candidate for this fork.

### `mylar.db` — Cavewoman `Corrected_Type = TPB` (26 Aug 2026)

ComicID `19538`, set via `cmd=changeBookType`. Left in place deliberately.

`booktype` of TPB/HC/GN sets `chktpb = 1`, which prepends a bare series-name query
(`Cavewoman`) instead of removing it. That took the search from 0 results to 12 real ones
— but all 12 were still rejected, because the postings are named story arcs and a
`Collection (1996-2014)`, none of which map to "issue 1 of 1993". This is the canonical
failing case the charter's flow is designed around; see the charter for the full write-up.

Revert with `cmd=changeBookType&id=19538&booktype=Print` if it causes trouble.

## Merging upstream

Upstream ships ~9 commits/month, so quarterly is plenty.

```bash
git fetch mylarcomics
git checkout stable && git merge --ff-only mylarcomics/stable   # keep mirror pristine
git checkout kerkness && git merge stable
```

On conflict, read the local commit message for the hunk before resolving — the *why* is
recorded there, not in the diff.

After any merge, sanity-check the DDL path specifically, since that's where the local
patches concentrate:

```bash
sudo systemctl restart mylar.service
journalctl -u mylar.service -f | grep -iE 'DDL-QUEUE|Traceback|Uncaught'
sqlite3 mylar.db "select status, count(*) from ddl_info group by status"
```

A healthy start logs `[DDL-QUEUE] Repopulating DDL queue with N previously incomplete
item(s)` and then drains. A dead worker shows `Uncaught exception` and the `Queued` count
never falls.

## Session log

### 26 Aug 2026 — Phase 01 complete, result was negative

The existing manual picker **cannot** serve as the candidate source.
`choose_specific_download?issueid=116850` returns `[]` and `manualresults` stays empty,
because the picker iterates `mylar.COMICINFO` — which `checker()` fills only with entries
`_process_entry` accepted. `manual=True` decides auto-download vs collect-for-choice; it
does not relax matching. A rejected candidate can never reach the picker.

Phase 02 is re-scoped: capture candidates at `parse_search_result`, upstream of the
matcher, together with the verdict and reason. Full write-up in the charter.

Concrete defect found on the way: with debug logging on the rejection reason is
`Booktypes do not match. Looking for Print, this is a TPB/GN/HC/One-Shot` — despite
Cavewoman's `Corrected_Type` being TPB. Query construction saw TPB (the bare-name query
fired and returned 12 real results) but the matcher compared against Print. `search.py`
derives `booktype` in at least two places: line 2370 reads the issue's `Type`, line 2414
honours `Corrected_Type`. First target for Phase 02.

**Upstream bug worth reporting:** `webserve.toggleVerbose(level=N)` assigns the raw
query-string to `mylar.LOG_LEVEL` and passes it to `logger.initLogger()`, which compares
it numerically — HTTP 500, and it leaves the log handlers torn down. Mylar keeps running
and silently stops writing to `mylar.log`. Recover **without a restart** by calling
`/toggleVerbose` with *no* `level` parameter (that path assigns an int); call it twice to
land back on level 1.

### 31 Aug 2026 — Phase 02 landed, and the first real capture

`search_audit` is live. First recorded run, Bitch Planet #1 (2014), is the charter's case
in miniature: **8 candidates, 0 accepted**, across five queries —

```
Bitch Planet 2014            <- pack_priority inserts this first
"Bitch Planet #1 (2014)"
Bitch Planet #1 (2014)
Bitch Planet #1
Bitch Planet                 <- chktpb inserts the bare name last
```

The first three returned nothing at all. The last two returned everything, and every
result was rejected for one of two reasons:

- `Bitch Planet Vol. 1 - 2` (1.6G, flagged as a pack) — **`booktype_mismatch`**: "looking
  for Print, this result is a TPB". This is almost certainly the thing a human would grab:
  a collection containing all ten wanted issues, refused purely on booktype.
- Four `Bitch Planet - Triple Feature #N (2017)` — **`year_mismatch`**. Correct: that is a
  different 2017 spin-off series, not the 2014 book.

So GetComics appears not to carry the original 2014 single issues at all, only the
collected volumes. The matcher's rejections are individually defensible; the failure is
that nothing surfaced "there is a collection here, take it or leave it". That is the
candidate-review flow.

### 1 Sep 2026 — the InSEXts pack, and why Downloads exists

Mylar's auto-search found a GetComics post for InSEXts #13 and concluded it was a pack of
**#1–13**, marking issues 9–13 `Snatched`. The only file on that post is
`Insexts (1-8) (2015-2016)` — the URL itself says `insexts-1-8-2015-2016`. It downloaded
420MB, post-processed 8 issues, and **every one was a duplicate** of what was already
owned. Issues 9–13 stayed `Snatched` with nothing that could ever satisfy them.

None of this was visible outside the log, which is what prompted patch #7 and the
Downloads screen. Cleanup: 9–13 reset to `Wanted`, 420MB of duplicates removed, and a
stalled duplicate download cancelled.

The root cause is upstream of the audit: `check_for_pack` trusted the post's advertised
range over the filename and URL. Worth chasing — it is the same class of error as the
`before_store_date` rejections.

### 1 Sep 2026 — correcting the `before_store_date` claim

Earlier notes in this session flagged `before_store_date` as the top suspect: 86% of all
rejections. **That was wrong**, and read from aggregate counts without checking values. The
rejections say things like `posted Thu, 03 Jul 2025, before the store date 2026-08-xx` — a
2025 posting genuinely cannot be an issue shipping in August 2026. The rule is correct.

What the number actually measured was the **bare-name query's** noise. Rejections by query:
`Thor` 2000 (400 results × 5 runs), `The Beauty` 487, `Tomorrow Girl` 110. The matcher was
doing its job on garbage input. Fix is patch #9, not the date rule.

The audit is honest in both directions: it recorded the one genuine accept (InSEXts #13,
verdict `accepted`, no reason) alongside 3,247 rejections.

## Monitoring — `scripts/ddl_healthcheck.py`

Installed 26 Aug 2026, running every 30 minutes from the user crontab:

```
*/30 * * * * /home/kerkness/mylar3/scripts/ddl_healthcheck.py --quiet
```

Silent when healthy. On a problem it prints, logs to syslog under the tag
`mylar-healthcheck`, and POSTs to `--webhook` / `$MYLAR_HEALTHCHECK_WEBHOOK` if one is
set (the payload carries `content`/`text`/`message`, so Discord, Slack and Gotify all
work). Exit codes: `0` healthy, `1` warning, `2` critical.

```bash
journalctl -t mylar-healthcheck --since '7 days ago'   # what it has been saying
./scripts/ddl_healthcheck.py                            # run by hand, always prints
```

Four independent checks: service running; `Uncaught exception` in the recent log; **no
progress** (items Queued but `Completed+Failed` unchanged since the previous run); and
log freshness. The progress check is the load-bearing one — it detects a stall without
guessing how long a queue *should* take, so a genuine 900-item backlog never
false-positives. State lives in `.ddl_healthcheck.state` (gitignored); the first run
only records a baseline.

All five paths were tested before install: stall → critical, draining backlog → OK,
service down → critical, uncaught exception → critical, stale log → warning.

## Operational note

The failure that prompted this fork was silent: the DDL worker thread died while the
service still reported healthy, and nothing surfaced it for eleven days. Whatever else
changes, keep an alert on either `[DDL-QUEUE] Unhandled error` in the log or `ddl_info`
rows sitting in `Queued` for more than a day.
