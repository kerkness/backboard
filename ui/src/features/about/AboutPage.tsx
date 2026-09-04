import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import Link from '@mui/material/Link'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'

/** Mylar's own interface is still served from the root, alongside this one. */
const STOCK_UI = '/home'
const STOCK_SETTINGS = '/config'

const UPSTREAM = 'https://github.com/MylarComics/mylar3'
const UPSTREAM_DOCS = 'https://mylar.nerdfirehurricane.com/'
const UPSTREAM_DISCORD = 'https://discord.gg/6qpyCZRZRB'
const UPSTREAM_CONTRIB = 'https://mylar.nerdfirehurricane.com/docs/contributing'
const FORK = 'https://github.com/kerkness/backboard'

function Out({ href, children }: { href: string; children: React.ReactNode }) {
  const external = !href.startsWith('/')
  return (
    <Link
      href={href}
      target={external ? '_blank' : undefined}
      rel="noreferrer"
      underline="hover"
      sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25 }}
    >
      {children}
      {external && <OpenInNewIcon sx={{ fontSize: 14 }} />}
    </Link>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.75 }}>
        {title}
      </Typography>
      {children}
    </Box>
  )
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <Typography variant="body2" sx={{ mb: 1, '&:last-child': { mb: 0 } }}>
      {children}
    </Typography>
  )
}

export function AboutPage() {
  return (
    <Stack spacing={2} sx={{ maxWidth: 760, mx: 'auto', width: '100%' }}>
      <Box sx={{ textAlign: 'center' }}>
        <Typography variant="h1">Backboard</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          A refreshed web UI for Mylar3
        </Typography>
      </Box>

      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Stack spacing={2.5} divider={<Divider flexItem />}>
          <Section title="What this is">
            <P>
              Backboard is a fork of <Out href={UPSTREAM}>MylarComics/mylar3</Out> that adds an
              alternative web interface on top of the existing Mylar API, along with some fixes
              and optimisations underneath.
            </P>
            <P>
              It is not a different comic downloader. The engine, the database and the API are
              Mylar's. Backboard is a re-envisioned front end over them, and Mylar's own
              interface is still there for everything this one does not cover.
            </P>
          </Section>

          <Section title="How this was built">
            <P>
              <strong>This project is 100% vibe coded.</strong> Every line of it was written by
              AI. I direct the work, review it and decide what ships, but I am not hand writing
              this code.
            </P>
            <P>
              I have thirty+ years experience as a full stack web developer, and that shows up
              in what gets built and what gets rejected. It is not an experiment in letting a
              model run unattended. It is an experiment in how far this way of working goes
              when someone who knows the craft is steering.
            </P>
            <P>
              <strong>It has been selfishly designed.</strong> I built the screens I use, in
              the way I use them. There is almost certainly no support here for things other
              people rely on. Ideas, suggestions and contributions are welcome.
            </P>
          </Section>

          <Section title="What this adds">
            <P>Everything Mylar already does, it still does. What is new:</P>
            <P>
              <strong>A responsive UI.</strong> The interface works on a phone, not just a
              desktop browser.
            </P>
            <P>
              <strong>Cover art everywhere.</strong> The weekly pull, your series, individual
              issues and search results. Images are cached locally rather than hotlinked, and
              resolved in batches to stay inside ComicVine's rate limits.
            </P>
            <P>
              <strong>A flow for the things that do not match automatically.</strong> Unmatched
              files get their own tab with cover previews, so you can match one against a
              chosen series and issue instead of moving and renaming it by hand. Candidate
              review lets you act on search results the matcher rejected, rather than losing
              them to a log line.
            </P>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Underneath: a post-processing audit recording what happened to each file in a
              download, a search audit recording why candidates were rejected, and assorted
              engine fixes. <Out href={`${FORK}/blob/kerkness/FORK.md`}>FORK.md</Out> has the
              detail.
            </Typography>
          </Section>

          <Section title="The original interface is still here">
            <P>
              Backboard covers day to day use: your series, the weekly pull, downloads and
              activity. Everything it does not cover is still available in Mylar's own
              interface, which runs alongside it.
            </P>
            <Stack direction="row" spacing={2} sx={{ mt: 1, flexWrap: 'wrap' }}>
              <Out href={STOCK_UI}>Open the standard Mylar UI</Out>
              <Out href={STOCK_SETTINGS}>Mylar settings</Out>
            </Stack>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1 }}>
              Settings in particular are only available there currently. Backboard may grow its
              own screens for some of them over time.
            </Typography>
          </Section>

          <Section title="Credit">
            <P>
              Mylar3 is the work of its maintainers and contributors, and none of this exists
              without it. If you find this useful, the project worth supporting is theirs. They
              take help as code, documentation, and answering questions on Discord.
            </P>
            <Stack direction="row" spacing={2} sx={{ mt: 1, flexWrap: 'wrap' }}>
              <Out href={UPSTREAM}>MylarComics/mylar3</Out>
              <Out href={UPSTREAM_DOCS}>Documentation</Out>
              <Out href={UPSTREAM_DISCORD}>Discord</Out>
              <Out href={UPSTREAM_CONTRIB}>How to contribute</Out>
            </Stack>
          </Section>

          <Section title="Reporting problems">
            <Alert severity="info" variant="outlined">
              Anything wrong with <strong>this</strong> UI is this fork's doing, not Mylar3's.
              Please report it at <Out href={`${FORK}/issues`}>kerkness/backboard</Out>, not on the
              Mylar3 issue tracker or their Discord. Bugs that are not specific to this fork are
              worth reporting upstream, where they help everyone.
            </Alert>
          </Section>

          <Section title="Licence">
            <P>
              GPL-3.0, the same as Mylar3. This is a modified version of Mylar3, and is not
              affiliated with or endorsed by the Mylar3 project.
            </P>
          </Section>
        </Stack>
      </Paper>
    </Stack>
  )
}
