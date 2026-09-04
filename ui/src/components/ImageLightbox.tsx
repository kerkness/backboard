import Box from '@mui/material/Box'
import Dialog from '@mui/material/Dialog'

/**
 * Full-size view of a thumbnail, opened by clicking it.
 *
 * Deliberately dumb: the caller owns the `string | null` state and decides which
 * URL to enlarge, because the pages that use this serve art from three different
 * endpoints (getArt, getFileCover, getPullCover).
 *
 * Backdrop click and Escape both close, which Dialog gives us; the image itself
 * closes too, since clicking the picture you just opened is the obvious way out.
 */
export function ImageLightbox({
  src,
  alt = '',
  onClose,
}: {
  src: string | null
  alt?: string
  onClose: () => void
}) {
  return (
    <Dialog open={Boolean(src)} onClose={onClose} maxWidth="sm">
      {src && (
        <Box
          component="img"
          src={src}
          alt={alt}
          onClick={onClose}
          sx={{
            display: 'block',
            maxWidth: '100%',
            maxHeight: '85vh',
            cursor: 'zoom-out',
          }}
        />
      )}
    </Dialog>
  )
}
