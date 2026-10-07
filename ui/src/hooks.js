import { useEffect, useState } from 'react'
import { api } from './api'
import { computeRows, outputExtras } from './store'

// Debounced live preview from the Python renderer.
export function usePreview(S, extra = {}) {
  const [res, setRes] = useState(null)
  const [busy, setBusy] = useState(false)
  const params = {
    rows: computeRows(S), columns: S.cfg.columns, mode: S.cfg.mode, sort: S.cfg.sort,
    template: S.cfg.template, title: S.cfg.title, date_format: S.cfg.dateFormat, dpi_preview: 150, ...outputExtras(S), ...extra,
  }
  const key = JSON.stringify([params.columns, params.mode, params.sort, params.template, params.title, params.date_format, S.edit, S.scope, S.cfg.sheet, S.cfg.xlsxTemplate])
  useEffect(() => {
    let dead = false
    setBusy(true)
    const t = setTimeout(async () => {
      const r = await api.preview(params)
      if (!dead) { setRes(r); setBusy(false) }
    }, 250)
    return () => { dead = true; clearTimeout(t) }
  }, [key])
  return { res, busy }
}

// Device clock: re-reads the computer's date and time every second (or every minute when seconds are not shown).
export function useNow(everyMs = 1000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), everyMs)
    return () => clearInterval(t)
  }, [everyMs])
  return now
}

export const dirname = (p) => (p || '').replace(/[\\/][^\\/]*$/, '')
