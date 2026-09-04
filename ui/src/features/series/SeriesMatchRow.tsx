import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { SeriesCandidateCover } from './SeriesCandidateCover'
import type { CvMatch } from './api'
import { alreadyHave } from './seriesMatch'

/**
 * One ComicVine series match, with an explicit add.
 *
 * Shared by the candidate picker and the global series search, which return the
 * identical shape. Adding is not undoable in one click, so it is a button rather
 * than a click anywhere on the row; the row stays inert and the cover zooms.
 */
export function SeriesMatchRow({
  match,
  epoch = 0,
  adding,
  disabled,
  onAdd,
  onZoom,
}: {
  match: CvMatch
  epoch?: number
  adding?: boolean
  disabled?: boolean
  onAdd: (r: CvMatch) => void
  onZoom: (r: CvMatch) => void
}) {
  const have = alreadyHave(match)

  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', py: 1 }}>
      <SeriesCandidateCover
        comicId={match.comicid}
        epoch={epoch}
        onClick={() => onZoom(match)}
      />
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {match.name} ({match.comicyear})
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {[match.publisher, match.issues ? `${match.issues} issues` : null]
            .filter(Boolean)
            .join(' · ')}
        </Typography>
      </Box>
      {match.url && (
        <Tooltip title="Open on ComicVine">
          <IconButton
            size="small"
            href={match.url}
            target="_blank"
            rel="noreferrer"
            sx={{ flexShrink: 0 }}
          >
            <OpenInNewIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
      {have ? (
        <Chip size="small" variant="outlined" color="success" label="On watchlist" />
      ) : (
        <Button
          size="small"
          variant="outlined"
          startIcon={<AddIcon />}
          disabled={disabled}
          onClick={() => onAdd(match)}
          sx={{ flexShrink: 0 }}
        >
          {adding ? 'Adding…' : 'Add series'}
        </Button>
      )}
    </Stack>
  )
}
