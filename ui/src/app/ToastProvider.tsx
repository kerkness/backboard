import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import Alert from '@mui/material/Alert'
import Snackbar from '@mui/material/Snackbar'
import Stack from '@mui/material/Stack'

type Severity = 'success' | 'info' | 'warning' | 'error'

interface Toast {
  id: number
  message: string
  severity: Severity
}

const ToastContext = createContext<(message: string, severity?: Severity) => void>(() => {})

export const useToast = () => useContext(ToastContext)

let nextId = 0

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
      <Snackbar
        open={toasts.length > 0}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{ maxWidth: '100%' }}
      >
        <Stack spacing={1} sx={{ width: '100%' }}>
          {toasts.map((t) => (
            <Alert
              key={t.id}
              severity={t.severity}
              variant="filled"
              onClose={() => dismiss(t.id)}
              sx={{ width: '100%' }}
            >
              {t.message}
            </Alert>
          ))}
        </Stack>
      </Snackbar>
    </ToastContext.Provider>
  )
}
