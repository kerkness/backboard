import { useState } from 'react'
import { Link as RouterLink, NavLink, Outlet, useNavigate } from 'react-router-dom'
import AppBar from '@mui/material/AppBar'
import Box from '@mui/material/Box'
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
import MenuIcon from '@mui/icons-material/Menu'
import SearchIcon from '@mui/icons-material/Search'
import { EventBridge } from './EventBridge'

const NAV = [
  { label: 'Series', to: '/series' },
  { label: 'This Week', to: '/this-week' },
  { label: 'Downloads', to: '/downloads' },
  { label: 'Activity', to: '/activity' },
]

function SearchBox({ onSubmit }: { onSubmit?: () => void }) {
  const [value, setValue] = useState('')
  const navigate = useNavigate()

  return (
    <Box
      component="form"
      onSubmit={(e) => {
        e.preventDefault()
        if (!value.trim()) return
        navigate(`/series?q=${encodeURIComponent(value.trim())}`)
        onSubmit?.()
      }}
      sx={{ flexGrow: 1, maxWidth: { sm: 360 } }}
    >
      <TextField
        size="small"
        fullWidth
        placeholder="Search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          },
        }}
      />
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
            sx={{ display: { sm: 'none' } }}
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
            Mylar
          </Typography>

          <SearchBox />

          <Box sx={{ display: { xs: 'none', sm: 'flex' }, gap: 1, ml: 'auto' }}>
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
          </List>
        </Box>
      </Drawer>

      <Box component="main" sx={{ flex: 1, p: { xs: 1.5, sm: 3 }, minWidth: 0 }}>
        <Outlet />
      </Box>
    </Box>
  )
}
