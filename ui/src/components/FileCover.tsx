import { useState } from 'react'
import Box from '@mui/material/Box'
import Skeleton from '@mui/material/Skeleton'
import ImageNotSupportedIcon from '@mui/icons-material/ImageNotSupported'
import { fileCoverUrl } from '../lib/api'

/**
 * Thumbnail of a comic file's first page.
 *
 * Extraction can legitimately fail — an unreadable archive, a PDF, a file still
 * being written — so this degrades to a placeholder rather than a broken image.
 */
export function FileCover({
  path,
  width = 48,
  onClick,
}: {
  path: string
  width?: number
  onClick?: (e: React.MouseEvent) => void
}) {
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading')
  const height = Math.round(width * 1.5)

  if (state === 'error') {
    return (
      <Box
        sx={{
          width,
          height,
          flexShrink: 0,
          borderRadius: 1,
          bgcolor: 'action.hover',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'text.disabled',
        }}
      >
        <ImageNotSupportedIcon fontSize="small" />
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
        src={fileCoverUrl(path)}
        alt=""
        loading="lazy"
        onLoad={() => setState('ok')}
        onError={() => setState('error')}
        onClick={state === 'ok' ? onClick : undefined}
        sx={{
          width,
          height,
          objectFit: 'cover',
          borderRadius: 1,
          boxShadow: 1,
          display: 'block',
          cursor: onClick && state === 'ok' ? 'zoom-in' : 'default',
          opacity: state === 'ok' ? 1 : 0,
        }}
      />
    </Box>
  )
}
