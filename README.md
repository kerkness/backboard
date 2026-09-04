# Backboard

**A refreshed web UI for [Mylar3](https://github.com/MylarComics/mylar3).**

This is a fork of [MylarComics/mylar3](https://github.com/MylarComics/mylar3) that adds an
alternative web interface on top of the existing Mylar API, along with some fixes and
optimisations underneath.

It is not a different comic downloader. The engine, the database and the API are Mylar's. 
Backboard is just a re-invisioned front end over them, and Mylar's own interface is still 
there for everything this one doesn't cover.

> **Not affiliated with or endorsed by the Mylar3 project.** If something in this UI is
> broken, that is this fork's doing. Please report it
> [here](https://github.com/kerkness/mylar3/issues), **not** on the Mylar3 issue tracker or
> their Discord.

---

## How this was built

**This project is 100% vibe coded.** Every line of it was written by AI. I direct the work,
review it and decide what ships, but I am not hand-writing this code.

I have thirty+ years experience as a full stack web developer, and that shows up in what gets built
and what gets rejected. It is not an experiment in letting a model run unattended. It is an experiment 
in how far this way of working goes when someone who knows the craft is steering.

Two things I get out of it: I find out what is actually possible with AI right now, and I
end up with the Mylar UI I want.

**It has been selfishly designed.** I built the screens I use, in the way I use them. There
is almost certainly no support here for things other people rely on. That is not an
oversight so much as a starting point, and I would rather say so plainly than have you
discover it.

Ideas, suggestions and contributions are welcome.

## What this adds

Everything Mylar already does, it still does. What's new:

**A responsive UI.** The interface works on a phone, not just a desktop browser.

**Cover art everywhere.** The weekly pull, your series, individual issues and search
results. Images are cached locally rather than hotlinked, and resolved in batches to stay
inside ComicVine's rate limits.

**A flow for the things that don't match automatically.** This is the part I actually built
this for:

- **Unmatched files** Files that downloaded fine but that post-processing couldn't place.
  They get their own tab, with cover previews, and you can match one against a chosen series
  and issue instead of moving and renaming it by hand.
- **Candidate review** Act on search results the matcher rejected, rather than losing them
  to a log line.

Underneath, to make the above possible:

- **Post-processing audit** (`pp_runs` / `pp_files`) Actionable details on what happened to 
  each file in a download: filed, duplicate or failed. Previously this only ever reached the log.
- **Search audit** What was searched for, and why candidates were rejected.
- Assorted engine fixes: DDL queue survival, SAB timeouts, pack filename handling.

Full detail, including every local patch and why it exists, is in [FORK.md](FORK.md).
UI decisions are recorded in [DESIGN.md](DESIGN.md).

## Installing

Same as Mylar3. This fork runs the same way:

```bash
git clone https://github.com/kerkness/mylar3.git
cd mylar3
python3 Mylar.py
```

The UI is served at `http://<host>:<port>/ui`. Mylar's own interface stays at
`http://<host>:<port>/home`, and **settings are only available there currently**.

The UI is a build artifact committed to `data/ui`. To work on it:

```bash
cd ui
npm install
npm run dev     # dev server, proxies /api to a running Mylar
npm run build   # writes to ../data/ui, which Mylar serves
```

## Upstream

Mylar3 is the work of its maintainers and contributors, and none of this exists without it.
If you find this useful, the project worth supporting is theirs. They take help as code,
documentation, and answering questions on Discord.

- [MylarComics/mylar3](https://github.com/MylarComics/mylar3)
- [Documentation](https://mylar.nerdfirehurricane.com/)
- [Discord](https://discord.gg/6qpyCZRZRB)
- [How to contribute to Mylar3](https://mylar.nerdfirehurricane.com/docs/contributing)

Bugs that aren't specific to this fork are worth reporting upstream, where they help
everyone.

## Licence

GPL-3.0, the same as Mylar3. This is a modified version of Mylar3; see [FORK.md](FORK.md)
for what was changed and when.
