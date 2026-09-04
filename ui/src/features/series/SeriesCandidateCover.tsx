import { useState } from 'react'
import Box from '@mui/material/Box'
import Skeleton from '@mui/material/Skeleton'
import MenuBookIcon from '@mui/icons-material/MenuBook'
import { pullCoverUrl } from '../../lib/api'

/**
 * Cover for one ComicVine search result in the series picker.
 *
 * The lookup queues these into Mylar's cache as it returns, so the first render
 * often misses and fills in on a later epoch. Served from Mylar rather than
 * hotlinked from ComicVine, like every other cover in the UI.
 */
export function SeriesCandidateCover({
  comicId,
  epoch = 0,
  width = 40,
  onClick,
}: {
  comicId: string
  epoch?: number
  width?: number
  onClick?: () => void
}) {
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading')
  const [seenEpoch, setSeenEpoch] = useState(epoch)
  const height = Math.round(width * 1.5)

  if (seenEpoch !== epoch) {
    setSeenEpoch(epoch)
    setState('loading')
  }

  if (state === 'error') {
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
        src={pullCoverUrl(null, comicId, epoch)}
        alt=""
        loading="lazy"
        onLoad={() => setState('ok')}
        onError={() => setState('error')}
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
