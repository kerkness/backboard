import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Grow from '@mui/material/Grow'

type Severity = 'success' | 'info' | 'warning' | 'error'

interface Toast {
  id: number
  message: string
  severity: Severity
}

const ToastContext = createContext<(message: string, severity?: Severity) => void>(() => {})

export const useToast = () => useContext(ToastContext)

let nextId = 0

/**
 * Toasts, stacked vertically, newest at the bottom.
 *
 * Deliberately not MUI's Snackbar: Snackbar is built around a *single* message —
 * it owns the positioning, transition and auto-hide for one child — so a Stack of
 * Alerts inside one ends up fighting its layout rather than being laid out by us.
 * A plain fixed container stacks predictably and lets each toast carry its own
 * transition.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const notify = useCallback((message: string, severity: Severity = 'info') => {
    const id = nextId++
    // Cap at three so a burst of events can't cover the page.
    setToasts((prev) => [...prev.slice(-2), { id, message, severity }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 6000)
  }, [])

  const dismiss = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id))

  const value = useMemo(() => notify, [notify])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Box
        sx={(theme) => ({
          position: 'fixed',
          bottom: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: theme.zIndex.snackbar,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          gap: 1,
          maxWidth: 'min(560px, calc(100vw - 32px))',
          // The container is only a layout box; clicks belong to the toasts.
          pointerEvents: 'none',
        })}
      >
        {toasts.map((t) => (
          <Grow key={t.id} in appear>
            <Alert
              severity={t.severity}
              variant="filled"
              onClose={() => dismiss(t.id)}
              sx={{ pointerEvents: 'auto', boxShadow: 3 }}
            >
              {t.message}
            </Alert>
          </Grow>
        ))}
      </Box>
    </ToastContext.Provider>
  )
}
