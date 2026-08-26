# UI design notes

Design and style guide for the new UI. Owned by @kerkness — everything below is a
prompt, not a proposal. Delete what isn't useful.

Related: [FORK.md](FORK.md) for fork strategy, and the charter linked there for the
acquisition flow this UI drives.

**Scope:** the new flow only — candidate review, post-download reconciliation,
discovery. Settings, config and provider setup stay in Mylar's existing UI on `:8090`.

**Stack (decided):** Vite + React + TypeScript, built into `data/ui/`, served by Mylar
at `/ui` on the same origin as the API.

---

## Reference points

Tools whose feel is worth borrowing, and what specifically about them:

<!-- e.g. "Sonarr — table density"  /  "X — don't: too much chrome" -->

Things to avoid:


---

## Navigation

### Top level


### Secondary


### Landing screen

Which screen opens first, and why:


---

## Screens

### Candidate review

Search found results; the matcher rejected them. Show what was found and why each was
rejected, and let the user act.

Open questions worth answering here: table vs cards; how much of the rejection reason
shows before interaction; how a pack/collection is distinguished from a single issue;
what the primary action is.


### Post-download reconciliation

A pack was downloaded and unpacked. Show which files matched wanted issues and which
didn't; let the user delete, keep, or promote unmatched files to wanted items.


### Discovery

Editions the search surfaced that aren't on the watchlist at all — the eleven Cavewoman
one-shots. How these are presented and added.


---

## How state reads

This UI's job is explaining *why* something didn't happen. Notes on how status,
rejection reasons, and progress should be surfaced:


---

## Conventions

### Density


### Typography


### Colour


### Components


### Empty, loading and error states


---

## Out of scope

Screens that stay in the old UI:

