import { useState } from 'react'
import Box from '@mui/material/Box'
import Skeleton from '@mui/material/Skeleton'
import MenuBookIcon from '@mui/icons-material/MenuBook'
import { pullCoverUrl } from '../../lib/api'
import type { WeeklyIssue } from './types'

/**
 * Cover thumbnail for a pull-list row.
 *
 * A miss is normal, not an error: the server only serves art it already has, and
 * the week's prefetch may still be running -- or the release may have no CV ids
 * at all. Those rows get a neutral placeholder so the column stays aligned.
 */
export function PullCover({
  row,
  epoch = 0,
  width = 36,
  onClick,
}: {
  row: WeeklyIssue
  epoch?: number
  width?: number
  onClick?: () => void
}) {
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading')
  const [seenEpoch, setSeenEpoch] = useState(epoch)
  const height = Math.round(width * 1.5)
  const hasIds = Boolean(row.issueId || row.comicId)

  // A new epoch means the prefetch landed more art, so give a row that missed
  // another go. Resetting during render (rather than in an effect) avoids
  // painting the placeholder for a frame before the retry.
  if (seenEpoch !== epoch) {
    setSeenEpoch(epoch)
    setState('loading')
  }

  if (!hasIds || state === 'error') {
    return (
      <Box
        sx={{
          width,
          height,
          flexShrink: 0,
          borderRadius: 0.5,
          bgcolor: 'action.hover',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'text.disabled',
        }}
      >
        <MenuBookIcon sx={{ fontSize: width * 0.45 }} />
      </Box>
    )
  }

  return (
    <Box sx={{ width, height, flexShrink: 0, position: 'relative' }}>
      {state === 'loading' && (
        <Skeleton variant="rounded" width={width} height={height} sx={{ position: 'absolute' }} />
      )}
      <Box
        component="img"
        src={pullCoverUrl(row.issueId, row.comicId, epoch)}
        alt=""
        loading="lazy"
        onLoad={() => setState('ok')}
        onError={() => setState('error')}
        // Only clickable once the art is actually there to enlarge.
        onClick={state === 'ok' ? onClick : undefined}
        sx={{
          width,
          height,
          objectFit: 'cover',
          borderRadius: 0.5,
          boxShadow: 1,
          display: 'block',
          cursor: onClick && state === 'ok' ? 'zoom-in' : 'default',
          opacity: state === 'ok' ? 1 : 0,
        }}
      />
    </Box>
  )
}
