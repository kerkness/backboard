import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import Divider from '@mui/material/Divider'
import LinearProgress from '@mui/material/LinearProgress'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TablePagination from '@mui/material/TablePagination'
import TableRow from '@mui/material/TableRow'
import TableSortLabel from '@mui/material/TableSortLabel'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'

export interface Column<T> {
  key: string
  header: string
  width?: number | string
  align?: 'left' | 'right'
  /** Sort key for this column. Omit to make the column unsortable. */
  sortValue?: (row: T) => string | number | null
  render?: (row: T) => ReactNode
}

export interface DataTableProps<T> {
  rows: T[]
  columns: Column<T>[]
  getRowId: (row: T) => string
  /** Mobile rendering. Below `md` the table is replaced by these cards. */
  renderCard: (row: T) => ReactNode
  loading?: boolean
  emptyMessage?: string
  onRowClick?: (row: T) => void
  initialSort?: { key: string; dir: 'asc' | 'desc' }
  /** Omit to render every row without a pager. */
  pageSize?: number
}

/** Nulls sort last; numeric-aware so issue "10" follows "9" rather than "1". */
function compare(a: string | number | null, b: string | number | null) {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
}

/**
 * The one table in this UI.
 *
 * Deliberately hand-rolled on MUI Material (MIT) rather than MUI X: the Pro licence key
 * would be baked into the shipped bundle, and the free DataGrid gates `listView` — the
 * prop that would have given us the mobile layout — behind Pro anyway. Row counts here
 * are in the hundreds, so virtualisation buys nothing.
 */
export function DataTable<T>({
  rows,
  columns,
  getRowId,
  renderCard,
  loading = false,
  emptyMessage = 'Nothing to show.',
  onRowClick,
  initialSort,
  pageSize,
}: DataTableProps<T>) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [sort, setSort] = useState(initialSort)
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(pageSize ?? 25)

  const sorted = useMemo(() => {
    if (!sort) return rows
    const col = columns.find((c) => c.key === sort.key)
    if (!col?.sortValue) return rows
    const dir = sort.dir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => dir * compare(col.sortValue!(a), col.sortValue!(b)))
  }, [rows, columns, sort])

  const visible = useMemo(() => {
    if (!pageSize) return sorted
    const start = page * rowsPerPage
    return sorted.slice(start, start + rowsPerPage)
  }, [sorted, page, rowsPerPage, pageSize])

  const toggleSort = (key: string) => {
    setSort((prev) =>
      prev?.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' },
    )
    setPage(0)
  }

  const pager = pageSize ? (
    <TablePagination
      component="div"
      count={sorted.length}
      page={page}
      onPageChange={(_, p) => setPage(p)}
      rowsPerPage={rowsPerPage}
      onRowsPerPageChange={(e) => {
        setRowsPerPage(Number(e.target.value))
        setPage(0)
      }}
      rowsPerPageOptions={[25, 50, 100]}
    />
  ) : null

  if (!loading && sorted.length === 0) {
    return (
      <Box sx={{ p: 6, textAlign: 'center', color: 'text.secondary' }}>
        <Typography variant="body2">{emptyMessage}</Typography>
      </Box>
    )
  }

  if (isMobile) {
    return (
      <Box>
        {loading && <LinearProgress />}
        <Stack divider={<Divider />}>
          {visible.map((row) => {
            const card = (
              <Box sx={{ px: 1.5, py: 1, width: '100%' }}>{renderCard(row)}</Box>
            )
            return onRowClick ? (
              <ButtonBase
                key={getRowId(row)}
                onClick={() => onRowClick(row)}
                sx={{ display: 'block', textAlign: 'left', width: '100%' }}
              >
                {card}
              </ButtonBase>
            ) : (
              <Box key={getRowId(row)}>{card}</Box>
            )
          })}
        </Stack>
        {pager}
      </Box>
    )
  }

  return (
    <Box>
      {loading && <LinearProgress />}
      <TableContainer>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              {columns.map((col) => (
                <TableCell
                  key={col.key}
                  align={col.align}
                  sx={{ width: col.width, fontWeight: 600, whiteSpace: 'nowrap' }}
                  sortDirection={sort?.key === col.key ? sort.dir : false}
                >
                  {col.sortValue ? (
                    <TableSortLabel
                      active={sort?.key === col.key}
                      direction={sort?.key === col.key ? sort.dir : 'asc'}
                      onClick={() => toggleSort(col.key)}
                    >
                      {col.header}
                    </TableSortLabel>
                  ) : (
                    col.header
                  )}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {visible.map((row) => (
              <TableRow
                key={getRowId(row)}
                hover={Boolean(onRowClick)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                sx={{ cursor: onRowClick ? 'pointer' : 'default' }}
              >
                {columns.map((col) => (
                  <TableCell key={col.key} align={col.align}>
                    {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? '')}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      {pager}
    </Box>
  )
}
