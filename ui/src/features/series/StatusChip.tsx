import Chip from '@mui/material/Chip'

const COLOR: Record<string, 'default' | 'success' | 'warning' | 'info' | 'error'> = {
  Active: 'success',
  Continuing: 'success',
  Downloaded: 'success',
  Ended: 'default',
  Paused: 'warning',
  Wanted: 'info',
  Snatched: 'info',
  Skipped: 'default',
  Failed: 'error',
}

export function StatusChip({ status }: { status: string | null }) {
  if (!status) return null
  return <Chip size="small" variant="outlined" label={status} color={COLOR[status] ?? 'default'} />
}
