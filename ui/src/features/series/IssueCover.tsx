import { useState } from 'react'
import Box from '@mui/material/Box'
import Skeleton from '@mui/material/Skeleton'
import MenuBookIcon from '@mui/icons-material/MenuBook'
import { pullCoverUrl } from '../../lib/api'

/**
 * Cover thumbnail for one issue.
 *
 * Served from Mylar's cache by IssueID, the same store the weekly pull uses, so
 * an issue already seen on the pull list is a hit straight away. A miss is
 * normal while the series prefetch is still running, and some issues have no
 * usable art at all, so both degrade to a placeholder.
 */
export function IssueCover({
  issueId,
  epoch = 0,
  width = 32,
  onClick,
}: {
  issueId: string | null
  epoch?: number
  width?: number
  onClick?: () => void
}) {
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading')
  const [seenEpoch, setSeenEpoch] = useState(epoch)
  const height = Math.round(width * 1.5)

  // A new epoch means the prefetch landed more art; retry the ones that missed.
  if (seenEpoch !== epoch) {
    setSeenEpoch(epoch)
    setState('loading')
  }

  if (!issueId || state === 'error') {
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
        src={pullCoverUrl(issueId, null, epoch)}
        alt=""
        loading="lazy"
        onLoad={() => setState('ok')}
        onError={() => setState('error')}
        // Rows are clickable, and a placeholder has nothing to enlarge.
        onClick={
          state === 'ok' && onClick
            ? (e: React.MouseEvent) => {
                e.stopPropagation()
                onClick()
              }
            : undefined
        }
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
