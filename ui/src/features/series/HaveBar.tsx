import Box from '@mui/material/Box'
import LinearProgress from '@mui/material/LinearProgress'
import Typography from '@mui/material/Typography'

/** Have/Total, the one number that says whether a series is actually complete. */
export function HaveBar({ have, total }: { have: number | null; total: number | null }) {
  const h = have ?? 0
  const t = total ?? 0
  const pct = t > 0 ? Math.min(100, (h / t) * 100) : 0

  return (
    <Box sx={{ width: '100%', minWidth: 90 }}>
      <Typography variant="caption" sx={{
        color: "text.secondary"
      }}>
        {h}/{t || '?'}
      </Typography>
      <LinearProgress
        variant="determinate"
        value={pct}
        color={t > 0 && h >= t ? 'success' : 'primary'}
        sx={{ height: 4, borderRadius: 2 }}
      />
    </Box>
  );
}
