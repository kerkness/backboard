# UI design notes

Design and style guide for the new UI. Owned by @kerkness — everything below is a
prompt, not a proposal. Delete what isn't useful.

Related: [FORK.md](FORK.md) for fork strategy, and the charter linked there for the
acquisition flow this UI drives.

**Scope:** the new flow only as a priority with an end goal of completely replacing mylar UI — starting with new flow of candidate review, post-download reconciliation,
discovery. Settings, config and provider setup will come after `:8090`.

**Stack (decided):** Vite + React + TypeScript, built into `data/ui/`, served by Mylar
at `/ui` on the same origin as the API.

**Always Responsive**  The UI should always be responsive and adopt a mobile first policy.
---

## Reference points

The MUI Component library should be used for all UX components. https://mui.com
Follow all examples provided by MUI for layout usage and style.
Make use of the MCP server https://mui.com/material-ui/getting-started/mcp/ (configured in
`.mcp.json`; it serves version-matched docs, which matters — see the v9 note below).

**MIT only — decided 31 Aug 2026.** Use `@mui/material` and `@mui/icons-material`, both
MIT. **Do not use MUI X** (`@mui/x-*` Pro or Premium), even though we hold a Pro licence.
The licence key is baked into the client bundle at build time, so shipping this fork would
publish our key and force anyone building from source to buy their own. That rules Pro out
for a distributable fork.

The free `@mui/x-data-grid` (Community, MIT) was considered and rejected: `listView` — the
prop that gives the responsive mobile layout — is Pro-gated, so mobile has to be hand-rolled
either way. With row counts in the hundreds, virtualisation buys nothing. See Components.

`MUI_X_KEY` stays in the repo-root `.env` but is no longer read; `vite.config.ts` exposes
only `VITE_*`, so nothing licence-shaped can reach a build.

Note for future work: MUI Material v9 removed system props (`alignItems`, `fontWeight` and
friends as direct props) — they now go in `sx`. There is a codemod:
`npx @mui/codemod@latest v9.0.0/system-props src`.

Be minimal with labels, descriptions and help prompting.
Keep files organized by feature.


Things to avoid: Long descriptive help text that describes why something works the way it does. Copying screens and sections from main mylar ui for the sake of completeness.
DO NOT include all current UI navigation, if I don't specifically mention navigation to include then skip it. You can keep a list of navigation you are skipping so that we can review to see if it should be added or not, but by default only add navigation I tell you I want.


---

## Navigation

### Top level

The top of every screen contains the main navigation. It has a seach box and then the main navigation is:

*Series*
This page shows a table of series which the user is following. This is similar to the table primary landing page of the current UI and shows the same columns. When selecting a series you can view all the comics in that series. Similar to main UI you can see the series details at the top, below the details are some tabs let you see different details. The tabs are  Comics - a paginated list of comics in the series that were pulled from CV or wherever mylar gets those details.   Search Results - a tab that shows search results from searches for those comics. This is where we can show alternative or fuzzy search results or series search results or info on how many times we searched for an issue and if there are any choices to make about those search results.

*This Week*
This is where we show new releases similar to the current UI.  Users can see whats coming up and add to their tracked comics and browse previous weeks.  One main difference to note, when we add a series to our list we should always automatically add all issues to the wanted list.
- 

*Activity*
Global view of what the daemon is doing and when it will next do something. Queues and
schedule sit side by side in one collapsible row; below that, pending searches in queue
order and a paginated list of recent search runs. Each run links to that series' Search
Results tab (`/series/:id?tab=search` — the tab lives in the URL so it is linkable).
Polls every 10s.

### Landing screen

Which screen opens first, and why: My Comic Series opens first. This is always where we start.


---

## Screens

### Candidate review — built 31 Aug 2026

Lives on the series' **Search Results** tab, backed by `mylar/search_audit.py`.

One accordion per search run, headed with the issue number, when it ran, and an
`N found · M matched` chip. Inside: the literal query strings sent to the provider, then
every candidate with an outlined chip carrying a plain-English rejection reason
("Wrong book type", "Year did not match") and the specific detail underneath
("looking for Print, this result is a TPB"). Titles link to the posting. Packs are marked
with a `pack` tag in the metadata line.

Triggers: a search icon on every row of the Comics tab (the common case — one issue,
~45s), and **Search all wanted** on this tab for the whole series.

Answers to the open questions this section used to carry: **rows, not cards** — the
reason has to sit next to the title to be read as a verdict. **The reason shows
immediately**, no interaction; hiding it defeats the point of the screen. **Runs expand by
default when they have candidates**, since an empty run needs no inspection.

**Actions on a candidate** (overflow menu on each row):

| Action | What it does |
|---|---|
| Download / Download pack | Queues the posting via the normal GetComics path, **staged** |
| Download as one-shot | Same, flagged `oneoff` |
| Find on ComicVine… | CV search on a name parsed from the posting title, then add with all issues wanted |
| Ignore / Un-ignore | Dims the row so it stops competing for attention |

Downloads land in a staging folder (`candidate_folder`, default
`<ddl_location>/candidates`) and are **never post-processed**. That is deliberate: these
bypass the matcher, which is also what stops Mylar filing a wrong file into a series
folder. Two independent guards — the download is queued with `issueid=None` so nothing
downstream can auto-file it even if the staging flag were lost, and `queues/ddl.py`
diverts the finished download and skips post-processing. Packs need no special handling:
`zip_zip()` already unpacks a `.zip` before the queue sees it.

"Follow this as a new series" is deliberately **not** one click. A candidate carries a
posting title, not a ComicVine id, so the honest flow is lookup → pick → add.

### Downloads — built 1 Sep 2026

Top-level screen. Filter tabs (All / Downloading / Completed / Failed); one accordion per
download showing live progress (`size` vs `remote_filesize`), which host it fell back to,
the issue range the **posting advertised**, and — the point of the screen — what
post-processing actually did with each file: filed, duplicate, or failed.

A pack whose files were all duplicates raises a warning banner, because that is the case
that silently strands issues at `Snatched`.

### Post-download reconciliation — built 1 Sep 2026

The **Files** tab on Downloads. Lists what is actually on disk in the staging and DDL
folders, packs expanded to their contents. Each file offers **Match to issue…** — pick a
series, then an issue, and Mylar post-processes the file into place under that identity —
or **Delete**.

This is the reverse of the normal flow: instead of the matcher deciding what a file is,
you assert it. Staged downloads accumulate in the candidate folder with their
provenance in `search_candidates.ddl_id`; deciding which unpacked files satisfy which
wanted issues is this screen's job.




### Discovery

Editions the search surfaced that aren't on the watchlist at all — the eleven Cavewoman
one-shots. How these are presented and added.

---

## How state reads

This UI's job is explaining *why* something didn't happen. Notes on how status,
rejection reasons, and progress should be surfaced:

### Missing issue titles — decided 31 Aug 2026

ComicVine carries no title for a large share of modern books: **117 of 268 watched series
(44%) have no titled issue at all**, and it is trending up — 54% of 2026 issues are
untitled versus 27% in 2019. Mylar stores CV's value verbatim (`importer.py:1254`), so the
column is genuinely empty, not broken.

The Comics tab synthesises `Series (issue)` — "Monstress (63)" — rather than showing a
blank cell or hiding the column. The issue number repeating in the `#` column is accepted:
a filled cell reads as data, an empty one reads as a fetch failure. Real titles are always
preferred when CV has one. Sorting uses the same fallback so order matches what is shown.

`issueTitle()` in `IssuesTab.tsx` also treats the literal string `'None'` as missing —
`importer.py:1256` writes that instead of NULL on one path.


---

## Conventions

Responsive, mobile first 


### Typography


### Colour

Light mode by default

### Feedback and live updates

Toasts are MUI `Snackbar` + `Alert`, bottom-centre, auto-dismissing at 6s and capped at
three so a burst can't cover the page. `useToast()` from `app/ToastProvider`.

`app/EventBridge` subscribes to Mylar's existing SSE channel
(`api?cmd=checkGlobalMessages`, fed by `mylar.GLOBAL_MESSAGES`) and turns server events
into toasts *and* react-query invalidations. Adding a series runs on a background thread,
so the HTTP response only says "queued" — the `addbyid` event is what reports the result,
and invalidating `['series']` on it is what makes the new series appear without a refresh.

Anything long-running should follow this pattern: return "queued" immediately, report
completion through the event channel.

### Components

MUI Material components (MIT). See the MIT-only rule under Reference points.

**`components/DataTable.tsx`** is the one table in the UI — Series, the Comics tab, and
This Week all render through it. Built on MUI `Table` + `TableSortLabel` +
`TablePagination`. It takes a `columns` array and a `renderCard`, and swaps from rows to
cards below the `md` breakpoint, so each screen declares its layout once rather than
maintaining a desktop and a mobile rendering. Sorting is client-side and numeric-aware, so
issue 10 sorts after issue 9.


---

## Out of scope

Screens that stay in the old UI: Everything unless specifically mentioned by me but you can recommend ones to incldue.

### Navigation skipped so far

Present in the old UI, deliberately left out until you ask for them:

| Item | Recommend adding? |
|---|---|
| History | Yes — snatched/failed history is how you'd audit the acquisition flow. `getHistory` already exists. |
| Manage / Manage Issues | Later — bulk status changes are useful once candidate review lands. |
| Import | No — one-off setup, fine in the old UI. |
| Logs | No — journalctl is better. |
| Story Arcs | No — not part of the new flow. |
| Read List | No. |
| Config / Providers | No — explicitly deferred in Scope above; no API endpoints exist for it. |

---

## Building the UI

Source in `ui/`, built into `data/ui/`, served by Mylar at `/ui`.

```bash
cd ui
npm install
npm run dev     # Vite on :5173, proxies /api to :8090
npm run build   # writes ../data/ui, picked up by the running service
```

Config comes from the repo-root `.env` (`VITE_MYLAR_API_KEY`, `VITE_MYLAR_API_URL`), read
via `envDir: '..'` in `vite.config.ts`. Only `VITE_*` is exposed to the bundle. `/ui` sits behind Mylar's basic auth like the rest of
the interface; `/api` stays exempt and authenticates with the API key.

