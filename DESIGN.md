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

### Series → Files tab — built 1 Sep 2026

Answers "this issue says Snatched but never arrived — where is the file?" for one series.

Warns up front which issues are stuck at Snatched, then lists every file on disk (staging
and DDL roots) whose name resembles the series, each with the issue number parsed from its
filename and a one-click **Match #N** against the issue it looks like. Below that, the
downloads recorded against the series.

The parser refuses pack ranges ("001-004") and returns no suggestion rather than guessing;
volume markers ("v1", "Vol 2") and years are not mistaken for issue numbers.

Every file shows a **cover thumbnail** extracted from its first page — click to enlarge.
The cover is what makes a suggested match verifiable at a glance, since the issue number is
usually printed on it. Extraction failures degrade to a placeholder icon, never a broken
image.

### Post-download reconciliation — built 1 Sep 2026

The **Files** tab on Downloads. Lists what is actually on disk in the staging and DDL
folders, packs expanded to their contents. Each file offers **Match to issue…** — pick a
series, then an issue, and Mylar post-processes the file into place under that identity —
or **Delete**.

This is the reverse of the normal flow: instead of the matcher deciding what a file is,
you assert it. Staged downloads accumulate in the candidate folder with their
provenance in `search_candidates.ddl_id`; deciding which unpacked files satisfy which
wanted issues is this screen's job.




### Search options, CV links, toast stacking — 4 Sep 2026

**Search scope moved to a gear.** The scope dropdown implied you had to choose between
your series and ComicVine. You don't: a search always covers your own series, and the only
question is whether it *also* reaches ComicVine. That is now a checkbox behind a gear at
the end of the field ("Also search ComicVine"), off by default because it costs a
rate-limited API call. The preference persists in localStorage — it reflects how someone is
working, not a per-search decision — and rides the URL as `?cv=1` so a result page is
shareable. Left off, the results page still offers the search as a button.

**ComicVine results link out.** `mb.findComic` already returns `url`
(`.../paper-girls/4050-124394/`), so every match row has an open-on-ComicVine button
alongside Add series.

**Toasts stack vertically.** They were rendered as a `Stack` inside a single MUI
`Snackbar`. Snackbar is built around one message — it owns positioning, transition and
auto-hide for a single child — so the Alerts were being laid out by its internals rather
than by us. Replaced with a plain fixed container (`flexDirection: column`, `gap`), each
toast carrying its own `Grow`. `pointerEvents: none` on the container and `auto` on the
toasts keeps the empty space clickable.

### Global series search — built 4 Sep 2026

You could only add a series from This Week or a search-result posting. The search box now
also finds series you don't follow yet.

**ComicVine, not GCD.** `addComic` calls `addbyid(comicid)`, and the importer, issue
lists, covers and weekly matching are all keyed to ComicVine volume ids — so a global
search is only useful if its results carry CV ids. The Grand Comics Database has better
print and creator data but its own identifiers, and no reliable GCD->CV mapping exists, so
a GCD hit could be found but not added. It would be a multi-GB dataset answering a
question you still couldn't act on.

titor-cache is not an alternative to this, it's a transport for it: being a CV mirror it
returns CV ids, so it's a drop-in. Same query, `volumes/?filter=name:Saga`: ComicVine 454
results, titor 444 (~98%). Switching `comicvine_url` raises the ceiling enough to make
type-ahead viable later, with no code change.

The backend already existed — `findComic` was in `cmd_list`, calling `mb.findComic` ->
`pullsearch`, and nothing in the UI ever invoked it. It answers with a bare array (not the
`{success, data}` envelope) in the same shape as the candidate picker's `CvMatch`, so the
row component is shared between them: cover, explicit **Add series**, and an "On
watchlist" chip from `haveit`.

**Scope lives in the search field**, GitHub-style: a dropdown reading "My series" /
"ComicVine". Watchlist is the default because it is instant and free; ComicVine costs a
call against ~200/hour with a >=2s sleep per call, so it stays deliberate rather than
type-ahead. The scope rides the URL as `?scope=comicvine`, so a global search is
shareable and survives a reload, and picking the scope with a query already typed runs it
immediately. The results page keeps its own "Search ComicVine" button for when you started
local and came up short.

### Search results → Find series — 4 Sep 2026

The candidate menu's "Find on ComicVine…" is now **Find series…**, which is what it does:
a posting title carries no CV id, so it searches ComicVine for the series the posting
refers to. The old label read like it would open comicvine.com.

The picker gained covers and an explicit **Add series** button per row. Adding is not
one-click undoable, so making the whole row a `ListItemButton` meant a mis-click enrolled a
series and marked every issue Wanted; the row is now inert and only the button adds.

Rows already on the watchlist show an "On watchlist" chip instead of the button.
`haveit` looks boolean but is not — `mb.findComic` sets the string `'No'` when absent and
the library row (`{comicid, status}`) when present, so the test is `haveit && haveit !== 'No'`.

Covers come from Mylar's cache, not hotlinked from CV: `_lookupCandidate` hands its
results to `pullcovers.prefetch_results`, which pulls the images the search already named
off CV's CDN. That costs no extra API call. They land after the dialog opens, so it
retries at 3s and 9s.

### Unmatched: empty leftovers — 4 Sep 2026

8 of the 23 entries in Unmatched were empty folders, not work. Mylar leaves the download
folder behind after filing its contents, so a *successful* pack shows up as a directory
with nothing in it. `Motor Girl 001-010 (2016-2017) [__556546__]` reads "0 files" because
all 10 issues were filed to `comix/Abstract Studio/Motor Girl (2016)/` — `ddl_info` has it
Completed at 398MB. Nothing was broken; the folder is empty *because* it worked.

`_getStagedFiles` already walks recursively (`os.walk`), so this was never a read depth
problem — there genuinely are no files.

Empty directories now sort into a collapsed "N empty folders left over from
post-processing" section with a per-row Remove, and the tab badge counts only entries that
actually need matching (15, not 23). The folder-name marker is *not* a reliable signal —
`[__None__]` usually means unidentified and `[__<id>__]` usually means processed, but
`Death Vigil [__500329__]` still has 1 of 8 files left. Emptiness is what distinguishes
them.

### Series issue covers — built 4 Sep 2026

The Comics tab shows each issue's own cover, with the same click-to-zoom as everywhere
else.

This costs **no ComicVine call at all**, unlike the weekly pull: `issues.ImageURL` is
already populated for all 3,630 issues on the watchlist, so the server only downloads from
CV's CDN. Mylar stores the `scale_small` rendition; CV serves the same image at other
sizes from an interchangeable path segment, so `_largest_variant` swaps in `scale_large`
for a string cost rather than a lookup. `thumbnail()` only shrinks, so an issue whose
source art is genuinely small simply stays small.

Covers reuse the pull-list store, keyed by IssueID, so `getPullCover` serves them
unchanged and an issue already seen on the pull list is a hit immediately.
`prefetchIssueCovers` fires per series on opening the tab; a fully-cached series does no
work. An issue whose stored URL will not load gets the same `.none` marker, so a series
with dead art doesn't re-download it on every visit — 6 of one test series' issues were
in that state.

There is a dead `_getIssueArt` in api.py that predates this: it is absent from `cmd_list`
so nothing can reach it, and it calls `cache.getArtwork(IssueID=...)` when that function
only accepts `ComicID`/`imageURL`, so it would raise if it ever were reachable. Left
alone for now, but it should go rather than sit next to the working path looking usable.

### Downloads tabs — reworked 4 Sep 2026

`All | Downloaded | Unmatched | Failed | Downloading`. Order runs from what needs
attention to what looks after itself, so Downloading sits last.

The Files tab became **Unmatched**, because staged files *are* the unmatched set: they
downloaded fine but post-processing could not place them, and the tab is where you match
them by hand. It carries a count badge (23 at time of writing) so a backlog is visible
without opening it.

**Failed stayed separate.** It is tempting to fold it into Unmatched, but the 24 rows
there are failed *transfers* — `Tomorrow Girl #12` got 74 MB of 77 MB — not files awaiting
a match. Relabelling them Unmatched would promise a manual match for files that never
arrived. The two states read the same to a user and are entirely different underneath.

Tabs now declare their own source (`kind: 'downloads' | 'staged'`) rather than the page
inferring it from an index, and the downloads query is disabled on the staged tab so it
stops polling something it isn't showing.

Caveat worth knowing: `pp_runs`/`pp_files` are empty for all 2,073 historical downloads —
`pp_audit` was instrumented after they ran — so the per-file matched/duplicate/failed chip
only appears for downloads post-processed from now on. Older rows say "no per-file detail
recorded" rather than pretending to know.

### Image zoom — built 4 Sep 2026

Every thumbnail in the UI opens a larger view on click, via one shared
`components/ImageLightbox.tsx` (MUI Dialog, `maxHeight: 85vh`, closes on backdrop,
Escape, or clicking the image). It is deliberately dumb — the caller owns the
`string | null` state and picks the URL — because the six call sites pull art from three
endpoints: `getArt`, `getFileCover`, `getPullCover`. `FilesTab` had its own inline copy of
this dialog; it now uses the shared one.

Two call sites sit inside something else that handles clicks — the Series list row
navigates, the Downloads accordion header expands — so those covers `stopPropagation`.
`FileCover`'s `onClick` was widened to receive the event for that reason, and both it and
`PullCover` only become clickable once the image has actually loaded, so a placeholder is
never clickable.

Watchlist covers (`cache/<comicid>.jpg`) are already ~830x1280, so they enlarge with no
backend work. Pull covers were stored at 480px for a 36px list thumbnail, so `pullcovers`
now writes two sizes from a single download: 320x480 for the list and 640x960 for the
dialog (CV's own `scale_large` is 830x1280 / ~400KB; 640x960 fills an 85vh dialog for a
third of the disk). `getPullCover` takes `size=zoom`, and a row cached before the zoom
copy existed falls back to its thumbnail rather than showing nothing.

Rows that ComicVine has no art for now get a `.none` marker, so a week containing one
stops re-querying CV on every visit.

### This Week covers and dates — built 4 Sep 2026

The pull list is mostly series that are *not* on the watchlist, so `cache/<comicid>.jpg`
(written when a series is added) covered only 14 of 80 rows in a typical week. Rows now
show the actual **issue** cover via CV IssueID, falling back to the series cover via
ComicID — 74 of 80 rows in week 35. Rows with neither id keep a neutral placeholder.

Covers are resolved **a week at a time**, not per row. `cv.pulldetails` sleeps
`CVAPI_RATE` (>=2s) before every call and cv.py has an explicit CV-banned-our-IP path, so
one call per row (~59 misses on a cold week) was not an option. `GetBatchImages` uses
CV's `filter=id:` with a pipe-joined list, 100 ids per call — the same shape the importer
already uses — so a whole week costs **two** API calls. The images themselves come from
CV's CDN, which takes no api_key and is not metered.

`prefetchPullCovers` starts a background fetch and returns immediately; `getPullCover` is
**cache-only** and never touches CV, because it is hit once per visible row. Covers land
asynchronously, so the page re-requests misses at 4s/12s/30s. A warm week makes no CV
call at all, so the prefetch is safe to fire on every view.

The header shows the real date range (`Aug 30 – Sep 5, 2026`) with `Week 35 · 2026` kept
underneath. Weeks are Python `%U` (Sunday-first) because that is what `_weekOf` and the
`weekly` table use; `week.ts` derives the range from that and is checked against Python's
own `%U` across 2020-2030. The previous `shiftWeek` approximated by adding 7-day
multiples to Jan 1 and did not round-trip across New Year (2025-W52 → 2026-W01 → W00), so
it now steps through the actual Sunday.

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

