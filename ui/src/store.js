// Session state helpers: edits (with undo/redo), scope and the rows that reach the output.
export const TIME_OK = /^\d{2}:\d{2}:\d{2}$/

export function normalizeTime(text) {
  const t = String(text ?? '').trim().toUpperCase().replace(/\./g, ':')
  if (!t) return ''
  const m = t.match(/^(\d{1,2}):?(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/)
  if (!m) return null
  let h = +m[1]; const mi = +m[2]; const s = +(m[3] || 0); const ap = m[4]
  if (ap === 'PM' && h < 12) h += 12
  if (ap === 'AM' && h === 12) h = 0
  if (h > 23 || mi > 59 || s > 59) return null
  const p = (n) => String(n).padStart(2, '0')
  return `${p(h)}:${p(mi)}:${p(s)}`
}

export const isTimeHeader = (h) => /LOGGED (IN|OUT)$/i.test(h) || /TIME$/i.test(h) || /CHECK-IN$|CHECK-OUT$|LAST PUNCH$|^T\d+$|\d (IN|OUT)$/i.test(h)

export const initialSession = () => ({
  file: null, data: null, module: null,
  edit: { overrides: {}, hidden: [], added: [] }, undo: [], redo: [], log: [],
  scope: { kind: 'all', selected: [] },
  cfg: { columns: [], mode: 'split', sort: 'excel', template: 'classic-grid', title: '', dateFormat: 'MM/DD/YYYY', sheet: { rows: false, days: false, totals: false } },
  out: { img1: '', img2: '', pdf: '', xlsx: '', dpi: 300, png: true, pdfOn: true, naming: '{Module}_{Scope}_{Date}' },
  ignored: [],
})

// records with edits applied, hidden rows removed, added rows appended, scope applied
export function computeRows(S) {
  if (!S.data) return []
  const { overrides, hidden, added } = S.edit
  const sel = new Set(S.scope.selected)
  let rows = S.data.records.map((r, i) => ({ ...r, ...(overrides[i] || {}), _i: i }))
  rows = rows.filter((r) => !hidden.includes(r._i) && !r._skip)
  if (S.scope.kind === 'pick') rows = rows.filter((r) => sel.has(r._i))
  return [...rows, ...added]
}

export const editCount = (S) =>
  Object.values(S.edit.overrides).reduce((n, o) => n + Object.keys(o).length, 0) + S.edit.hidden.length + S.edit.added.length

export const clone = (e) => JSON.parse(JSON.stringify(e))

function push(S, set, next, logEntry) {
  const entries = (Array.isArray(logEntry) ? logEntry : logEntry ? [logEntry] : [])
    .map((e) => ({ t: new Date().toLocaleTimeString(), ...e }))
  set({ edit: next, undo: [...S.undo, S.edit].slice(-100), redo: [], log: [...entries.reverse(), ...S.log].slice(0, 200) })
}

function applyCell(S, next, row, label, value) {
  const old = row[label]
  if (typeof row._i === 'string') {
    const a = next.added.find((x) => x._i === row._i); if (a) a[label] = value
  } else {
    const orig = S.data.records[row._i][label]
    next.overrides[row._i] = next.overrides[row._i] || {}
    if (value === orig) delete next.overrides[row._i][label]; else next.overrides[row._i][label] = value
    if (!Object.keys(next.overrides[row._i]).length) delete next.overrides[row._i]
  }
  return { row: row[S.data.keys.label] || '(new row)', col: label, old, neu: value }
}

// several cell changes as ONE undo step: items = [{row, label, value}]
export function batchSet(S, set, items) {
  if (!items.length) return
  const next = clone(S.edit)
  const logs = items.map((it) => applyCell(S, next, it.row, it.label, it.value))
  push(S, set, next, logs)
}

export function setCell(S, set, row, label, value) {
  batchSet(S, set, [{ row, label, value }])
}

export function hideRow(S, set, row) {
  const next = clone(S.edit)
  if (typeof row._i === 'string') next.added = next.added.filter((x) => x._i !== row._i)
  else next.hidden.push(row._i)
  push(S, set, next, { row: row[S.data.keys.label], col: '(row)', old: 'shown', neu: 'hidden' })
}

export function addRow(S, set) {
  const next = clone(S.edit)
  const blank = { _i: 'a' + Date.now() }
  S.data.columns.forEach((c) => { blank[c.label] = '' })
  next.added.push(blank)
  push(S, set, next, { row: '(new row)', col: '(row)', old: '', neu: 'added' })
}

export const undo = (S, set) => {
  if (!S.undo.length) return
  set({ edit: S.undo[S.undo.length - 1], undo: S.undo.slice(0, -1), redo: [...S.redo, S.edit] })
}
export const redo = (S, set) => {
  if (!S.redo.length) return
  set({ edit: S.redo[S.redo.length - 1], redo: S.redo.slice(0, -1), undo: [...S.undo, S.edit] })
}
export const resetAll = (S, set) =>
  set({ edit: { overrides: {}, hidden: [], added: [] }, undo: [...S.undo, S.edit], redo: [], log: [] })
export function resetRow(S, set, row) {
  const next = clone(S.edit)
  if (typeof row._i !== 'string') { delete next.overrides[row._i]; next.hidden = next.hidden.filter((x) => x !== row._i) }
  push(S, set, next, { row: row[S.data.keys.label], col: '(row)', old: 'edited', neu: 'original' })
}

// what a freshly loaded file should start with
export function freshConfig(d, prev, templateDefault) {
  return { ...prev, columns: d.default_columns, mode: d.default_mode, sort: 'excel',
           template: templateDefault && d.default_mode !== 'sheet' ? templateDefault : d.default_template, title: '', sheet: { rows: false, days: false, totals: false } }
}
export const scopeName = (S) => {
  const emp = S.data?.module === 'employee'
  return S.scope.kind === 'all' ? (emp ? 'AllEmployees' : 'AllReps') : (emp ? 'EmployeeWise' : 'RepWise')
}

export const isXlsx = (S) => !!S.data?.modes?.find((m) => m.id === S.cfg.mode)?.xlsx
export const isFixed = (S) => !!S.data?.modes?.find((m) => m.id === S.cfg.mode)?.fixed
// output options the Python side needs besides rows/columns
export const outputExtras = (S) => ({ include_empty: S.scope.kind === 'all', hidden: S.edit.hidden, sheet_opts: S.cfg.sheet })
