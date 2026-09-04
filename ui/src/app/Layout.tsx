import { useState } from 'react'
import { Link as RouterLink, NavLink, Outlet, useNavigate } from 'react-router-dom'
import AppBar from '@mui/material/AppBar'
import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import Drawer from '@mui/material/Drawer'
import IconButton from '@mui/material/IconButton'
import InputAdornment from '@mui/material/InputAdornment'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import TextField from '@mui/material/TextField'
import Toolbar from '@mui/material/Toolbar'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Tooltip from '@mui/material/Tooltip'
import Checkbox from '@mui/material/Checkbox'
import ListItemIcon from '@mui/material/ListItemIcon'
import SettingsIcon from '@mui/icons-material/Settings'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import Link from '@mui/material/Link'
import GitHubIcon from '@mui/icons-material/GitHub'
import ListItemIcon2 from '@mui/material/ListItemIcon'
import MenuIcon from '@mui/icons-material/Menu'
import SearchIcon from '@mui/icons-material/Search'
import { EventBridge } from './EventBridge'

const REPO = 'https://github.com/kerkness/backboard'

const NAV = [
  { label: 'Series', to: '/series' },
  { label: 'This Week', to: '/this-week' },
  { label: 'Downloads', to: '/downloads' },
  { label: 'Activity', to: '/activity' },
]

/**
 * Search options, behind a gear at the end of the field.
 *
 * The search itself always covers your own series -- that is instant and free.
 * The one option is whether it *also* reaches ComicVine, which costs an API call
 * against a rate-limited budget, so it is opt-in rather than the default. Left
 * off, the results page still offers it as a button, so the catalogue is never
 * more than one click away.
 *
 * The preference sticks (localStorage) because it reflects how someone is
 * working -- filling gaps in a collection vs. looking things up -- not a
 * per-search decision. It travels as `?cv=1` so a result page is shareable and
 * survives a reload.
 */
const CV_PREF_KEY = 'mylar.search.alsoComicVine'

function readCvPref() {
  try {
    return localStorage.getItem(CV_PREF_KEY) === '1'
  } catch {
    // Private windows and blocked site data both throw here; default to off.
    return false
  }
}

function SearchBox({ onSubmit }: { onSubmit?: () => void }) {
  const [value, setValue] = useState('')
  const [alsoCv, setAlsoCv] = useState(readCvPref)
  const [anchor, setAnchor] = useState<null | HTMLElement>(null)
  const navigate = useNavigate()

  const go = (cv: boolean) => {
    const q = value.trim()
    if (!q) return
    navigate(`/series?q=${encodeURIComponent(q)}${cv ? '&cv=1' : ''}`)
    onSubmit?.()
  }

  const toggleCv = () => {
    const next = !alsoCv
    setAlsoCv(next)
    try {
      localStorage.setItem(CV_PREF_KEY, next ? '1' : '0')
    } catch {
      // Preference just won't persist; the toggle still works this session.
    }
    setAnchor(null)
    // Turning it on with a query already typed is itself the instruction to search.
    if (value.trim()) go(next)
  }

  return (
    <Box
      component="form"
      onSubmit={(e) => {
        e.preventDefault()
        go(alsoCv)
      }}
      sx={{ flexGrow: 1, maxWidth: { sm: 380 } }}
    >
      <TextField
        size="small"
        fullWidth
        placeholder={alsoCv ? 'Search series and ComicVine' : 'Search your series'}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                <Tooltip title="Search options">
                  <IconButton
                    size="small"
                    edge="end"
                    aria-label="Search options"
                    onClick={(e) => setAnchor(e.currentTarget)}
                    color={alsoCv ? 'primary' : 'default'}
                  >
                    <SettingsIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </InputAdornment>
            ),
          },
        }}
      />

      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        <MenuItem onClick={toggleCv}>
          <ListItemIcon>
            <Checkbox edge="start" size="small" checked={alsoCv} tabIndex={-1} disableRipple />
          </ListItemIcon>
          <Box>
            <Typography variant="body2">Also search ComicVine</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Finds series you don’t follow yet. Rate-limited, so it runs once per search.
            </Typography>
          </Box>
        </MenuItem>
      </Menu>
    </Box>
  )
}


export function Layout() {
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <Box sx={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <EventBridge />
      <AppBar position="sticky">
        <Toolbar sx={{ gap: 2 }}>
          <IconButton
            edge="start"
            onClick={() => setDrawerOpen(true)}
            // The nav buttons are a fixed ~430px; below md they squeeze the search
            // field to unusable widths (91px at 620px wide) and overflow the bar.
            sx={{ display: { md: 'none' } }}
            aria-label="Open navigation"
          >
            <MenuIcon />
          </IconButton>

          <Typography
            component={RouterLink}
            to="/series"
            variant="h2"
            sx={{ textDecoration: 'none', color: 'inherit', display: { xs: 'none', sm: 'block' } }}
          >
            Backboard
          </Typography>

          <SearchBox />

          <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 1, ml: 'auto' }}>
            {NAV.map((item) => (
              <Button
                key={item.to}
                component={NavLink}
                to={item.to}
                color="inherit"
                sx={{ '&.active': { bgcolor: 'action.selected' } }}
              >
                {item.label}
              </Button>
            ))}
            {/* About is reference material, not a destination you visit often, so
                it gets an icon here and a full label in the drawer. */}
            <Tooltip title="About Backboard">
              <IconButton
                component={NavLink}
                to="/about"
                color="inherit"
                aria-label="About"
                sx={{ '&.active': { bgcolor: 'action.selected' } }}
              >
                <InfoOutlinedIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Toolbar>
      </AppBar>

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <Box sx={{ width: 240 }} role="presentation" onClick={() => setDrawerOpen(false)}>
          <List>
            {NAV.map((item) => (
              <ListItemButton key={item.to} component={NavLink} to={item.to}>
                <ListItemText primary={item.label} />
              </ListItemButton>
            ))}
            <Divider sx={{ my: 0.5 }} />
            <ListItemButton component={NavLink} to="/about">
              <ListItemIcon2 sx={{ minWidth: 36 }}>
                <InfoOutlinedIcon fontSize="small" />
              </ListItemIcon2>
              <ListItemText primary="About" />
            </ListItemButton>
          </List>
        </Box>
      </Drawer>

      <Box component="main" sx={{ flex: 1, p: { xs: 1.5, sm: 3 }, minWidth: 0 }}>
        <Outlet />
      </Box>

      {/* Quiet by design: present on every screen, competing with none of them. */}
      <Box
        component="footer"
        sx={{
          px: { xs: 1.5, sm: 3 },
          py: 2,
          mt: 2,
          borderTop: 1,
          borderColor: 'divider',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'center',
          gap: { xs: 1, sm: 2 },
          color: 'text.secondary',
        }}
      >
        <Typography variant="caption">
          <Box component="span" sx={{ fontWeight: 700 }}>
            Backboard
          </Box>
          , a refreshed web UI for Mylar3
        </Typography>

        <Link
          href={REPO}
          target="_blank"
          rel="noreferrer"
          variant="caption"
          underline="hover"
          sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
        >
          <GitHubIcon sx={{ fontSize: 15 }} />
          kerkness/backboard
        </Link>

        <Link component={RouterLink} to="/about" variant="caption" underline="hover">
          About
        </Link>
      </Box>
    </Box>
  )
}
