# kerkness/mylar3 — fork notes

A **soft fork** of [MylarComics/mylar3](https://github.com/MylarComics/mylar3). The engine
keeps tracking upstream; local changes stay small and documented so merges stay cheap.

## Why this fork exists

Upstream is alive but thin — roughly 9 commits/month, effectively one active maintainer.
Fixes that matter here (GetComics/provider breakage, DB locks, client API changes) do land
upstream, so staying merge-able is worth more than independence. This fork exists to carry
local fixes without waiting on review, not to diverge.

## Strategy — read this before making changes

Measured over the last 60 upstream commits (Feb–Aug 2026):

| Path | Commits touching it |
|---|---|
| `data/` (templates) | 15 / 60 |
| `mylar/webserve.py` | 13 / 60 |
| `mylar/config.py` | 10 / 60 |
| `mylar/api.py` | 4 / 60 |
| `mylar/getcomics.py` | 2 / 60 |
| `mylar/search.py` | 2 / 60 |

**The UI layer is the most-churned part of the codebase upstream.** Editing
`webserve.py` or `data/interfaces/` in place is therefore the most expensive possible
place to diverge — it collides with exactly what upstream changes most.

So: **UI work does not happen in this repo.** Mylar exposes 56 API endpoints in
`mylar/api.py` (`getIndex`, `getComic`, `addComic`, `getWanted`, `getUpcoming`,
`getHistory`, `forceSearch`, `queueIssue`/`unqueueIssue`, `changeStatus`, `refreshComic`,
covers via `getArt`/`getIssueArt`) plus `eventStreamResponse` — a server-sent-events
channel keyed by `SSE_KEY` — for live status. A separate front-end talks to that and has
zero merge surface against upstream.

Known API gaps: no config/settings endpoints and no pull-list endpoint. Keep Mylar's
existing UI for settings; replace the views that matter (library, wanted, history, queue).
If the API needs extending, `api.py` is low-churn (4/60) and a cheap place to patch.

## Branch layout

| Branch | Purpose |
|---|---|
| `stable` | Pristine mirror of `mylarcomics/stable`. **Never commit here.** |
| `nightly` | Pristine mirror of `mylarcomics/nightly`, if tracked. |
| `kerkness` | Upstream + the local patches below. This is what runs. |
| `fix/*` | Single fixes, branched off upstream `nightly`, for upstreaming. |

## Remotes

```
mylarcomics   https://github.com/MylarComics/mylar3.git   # upstream, fetch only
fork          git@github.com:kerkness/mylar3.git          # this fork
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

## Operational note

The failure that prompted this fork was silent: the DDL worker thread died while the
service still reported healthy, and nothing surfaced it for eleven days. Whatever else
changes, keep an alert on either `[DDL-QUEUE] Unhandled error` in the log or `ddl_info`
rows sitting in `Queued` for more than a day.
