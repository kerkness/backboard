import { createTheme } from '@mui/material/styles'

// Light mode by default (DESIGN.md). Dense tables, restrained chrome.
export const theme = createTheme({
  palette: {
    mode: 'light',
    background: { default: '#f7f8fa' },
  },
  shape: { borderRadius: 8 },
  typography: {
    fontSize: 14,
    h1: { fontSize: '1.5rem', fontWeight: 600 },
    h2: { fontSize: '1.125rem', fontWeight: 600 },
  },
  components: {
    MuiAppBar: {
      defaultProps: { elevation: 0, color: 'default' },
      styleOverrides: { root: { borderBottom: '1px solid', borderColor: 'divider' } },
    },
  },
})
