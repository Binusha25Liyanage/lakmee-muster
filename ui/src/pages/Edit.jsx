import { useEffect, useRef, useState } from 'react'
import {
  Undo2, Redo2, RotateCcw, Plus, EyeOff, Replace, ListChecks, ArrowLeft, ArrowRight, Search, Pencil, Trash2, MoreVertical,
} from 'lucide-react'
import { api } from '../api'
import { usePreview } from '../hooks'
import {
  isFixed, computeRows, editCount, setCell, batchSet, hideRow, addRow, undo, redo, resetAll, resetRow, normalizeTime, isTimeHeader,
} from '../store'
import { Stepper, Modal, Toggle } from '../ui.jsx'

export default function Edit({ S, set, go, step, maxStep, notify }) {
  const d = S.data
  const rows = computeRows(S)
  const [calc, setCalc] = useState({})
  const fixed = isFixed(S)
  const cols = fixed ? ['NAME', ...d.days.flatMap((x) => [x.d, x.t])] : S.cfg.columns
  const header = (l) => d.columns.find((c) => c.label === l)?.header || l
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState(null) // {id,label,value,err}
  const [sel, setSel] = useState([])
  const [menu, setMenu] = useState(null)
  const [modal, setModal] = useState(null)
  const [tab, setTab] = useState('names')
  const [corr, setCorr] = useState([])
  const [nc, setNc] = useState({ a: '', b: '' })
  const { res } = usePreview(S)
  const inputRef = useRef(null)

  useEffect(() => {  // calculated columns (e.g. employee totals) follow the edits
    if (!d.readonly.length) return
    let dead = false
    api.recalc(rows).then((res) => { if (!dead) { const m = {}; res.forEach((r, i) => { m[rows[i]._i] = r }); setCalc(m) } })
    return () => { dead = true }
  }, [S.edit, S.scope])
  const disp = (r, l) => (d.readonly.includes(l) && calc[r._i] ? calc[r._i][l] : r[l])
  const loadCorr = () => api.corrections().then(setCorr)
  useEffect(() => { loadCorr() }, [])
  useEffect(() => { if (editing && inputRef.current) { inputRef.current.focus(); if (inputRef.current.select) inputRef.current.select() } }, [editing?.id, editing?.label])
  useEffect(() => {
    const close = () => setMenu(null)
    window.addEventListener('click', close)
    const key = (e) => {
      if (!(e.ctrlKey || e.metaKey) || editing) return
      if (e.key.toLowerCase() === 'z') { e.preventDefault(); undo(S, set) }
      if (e.key.toLowerCase() === 'y') { e.preventDefault(); redo(S, set) }
    }
    window.addEventListener('keydown', key)
    return () => { window.removeEventListener('click', close); window.removeEventListener('keydown', key) }
  }, [S.edit, S.undo, S.redo, editing])

  const shown = rows.filter((r) => !q || cols.some((l) => String(disp(r, l)).toLowerCase().includes(q.toLowerCase())))
  const isEdited = (r, l) => (typeof r._i === 'string' ? !!r[l] : S.edit.overrides[r._i]?.[l] !== undefined)
  const original = (r, l) => (typeof r._i === 'string' ? '' : d.records[r._i][l])
  const nEdits = editCount(S)

  function commit() {
    if (!editing) return
    const row = rows.find((r) => r._i === editing.id)
    let v = editing.value.trim()
    if (row && isTimeHeader(header(editing.label))) {
      const n = normalizeTime(v)
      if (n === null) return setEditing({ ...editing, err: 'Enter a time like 08:15 or 08:15:30' })
      v = n
    }
    if (row && v !== row[editing.label]) {
      const old = row[editing.label]
      setCell(S, set, row, editing.label, v)
      if (!isTimeHeader(header(editing.label)) && !d.status_cols.includes(editing.label) && old && v) {
        notify(`Changed "${old}" to "${v}".`, false, {
          label: 'Always apply this correction',
          run: async () => { await api.add_correction(old, v, true); loadCorr() },
        })
      }
    }
    setEditing(null)
  }

  const toggleSel = (id) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  const hideSelected = () => {
    const targets = rows.filter((r) => sel.includes(r._i))
    if (!targets.length) return notify('Tick the rows you want to hide first.', true)
    // hide all in one go (single undo step)
    const next = JSON.parse(JSON.stringify(S.edit))
    targets.forEach((r) => (typeof r._i === 'string' ? (next.added = next.added.filter((x) => x._i !== r._i)) : next.hidden.push(r._i)))
    set({ edit: next, undo: [...S.undo, S.edit], redo: [] }); setSel([])
  }

  return (
    <>
      <Stepper step={step} go={go} maxStep={maxStep} />
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div><div className="eyebrow">Inline data editor</div><div className="page-title">Edit Attendance Data Before Export</div>
          <p className="sub">Double-click a cell to change it. Your Excel file is never modified — edits only affect the images and PDF.</p></div>
        <div className="sp" />
        <div className="card kpi" style={{ minWidth: 190 }}><div className="l">Edits applied</div><div className="v" style={{ fontSize: 24 }}>{nEdits}</div></div>
      </div>

      <div className="card row mt" style={{ flexWrap: 'wrap', padding: 10 }}>
        <button className="btn sm ghost" disabled={!S.undo.length} onClick={() => undo(S, set)}><Undo2 size={15} /> Undo</button>
        <button className="btn sm ghost" disabled={!S.redo.length} onClick={() => redo(S, set)}><Redo2 size={15} /> Redo</button>
        <button className="btn sm ghost" disabled={!nEdits} onClick={() => { if (confirm('Discard all edits?')) resetAll(S, set) }}><RotateCcw size={15} /> Reset all</button>
        <div style={{ width: 1, height: 22, background: 'var(--line)' }} />
        <button className="btn sm ghost" onClick={() => addRow(S, set)}><Plus size={15} /> Add row</button>
        <button className="btn sm ghost" onClick={hideSelected}><EyeOff size={15} /> Hide selected</button>
        <button className="btn sm ghost" onClick={() => setModal('find')}><Replace size={15} /> Find & replace</button>
        <button className="btn sm ghost" onClick={() => setModal('bulk')}><ListChecks size={15} /> Bulk edit</button>
        <div className="sp" />
        <div className="row" style={{ position: 'relative', width: 230 }}><Search size={15} style={{ position: 'absolute', left: 10, color: 'var(--muted)' }} />
          <input className="input" style={{ paddingLeft: 32 }} placeholder="Filter rows…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      </div>

      <div className="grid mt" style={{ gridTemplateColumns: '1.9fr 1fr', alignItems: 'start' }}>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="row" style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)' }}>
            <b>Rows in this export</b><span className="chip">{shown.length} rows</span><div className="sp" />
            <span className="small muted">Enter = save · Esc = cancel · right-click a row for more</span></div>
          <div className="tbl-wrap" style={{ border: 0, maxHeight: 460 }}>
            <table className={'t ' + (fixed ? 'fixedcols' : '')}>
              <thead><tr><th style={{ width: 34 }}><input type="checkbox" checked={sel.length === shown.length && shown.length > 0}
                onChange={(e) => setSel(e.target.checked ? shown.map((r) => r._i) : [])} /></th><th>#</th>
                {cols.map((l) => <th key={l}>{header(l)}</th>)}<th /></tr></thead>
              <tbody>
                {shown.map((r, n) => (
                  <tr key={r._i} onContextMenu={(e) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY, r }) }}
                      style={d.keys.in && !r[d.keys.in] ? { opacity: 0.6 } : null}>
                    <td><input type="checkbox" checked={sel.includes(r._i)} onChange={() => toggleSel(r._i)} /></td>
                    <td className="muted">{n + 1}</td>
                    {cols.map((l) => {
                      const on = editing && editing.id === r._i && editing.label === l
                      const ed = isEdited(r, l)
                      return (
                        <td key={l} className={(ed ? 'edited ' : '') + (on && editing.err ? 'invalid' : '')}
                            title={ed ? `Original: ${original(r, l) || '(empty)'}` : d.readonly.includes(l) ? 'Calculated automatically' : 'Double-click to edit'}
                            style={d.readonly.includes(l) ? { color: 'var(--muted)', fontStyle: 'italic' } : null}
                            onDoubleClick={() => !d.readonly.includes(l) && setEditing({ id: r._i, label: l, value: r[l] || '', err: '' })}>
                          {on && d.status_cols.includes(l) ? (
                            <select ref={inputRef} className="cell-in" value={editing.value}
                                    onChange={(e) => { setCell(S, set, r, l, e.target.value); setEditing(null) }}
                                    onBlur={() => setEditing(null)} onKeyDown={(e) => e.key === 'Escape' && setEditing(null)}>
                              {d.status_options.map((o) => <option key={o} value={o}>{o || '(empty)'}</option>)}
                              {!d.status_options.includes(editing.value) && <option value={editing.value}>{editing.value}</option>}
                            </select>
                          ) : on ? (
                            <>
                              <input ref={inputRef} className="cell-in" value={editing.value}
                                     onChange={(e) => setEditing({ ...editing, value: e.target.value, err: '' })}
                                     onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(null) }}
                                     onBlur={commit} />
                              {editing.err && <div className="small" style={{ color: '#a30f0f', marginTop: 3 }}>{editing.err}</div>}
                            </>
                          ) : (disp(r, l) || <span className="muted">-</span>)}
                        </td>
                      )
                    })}
                    <td><button className="btn sm" style={{ background: 'none', padding: 4 }} onClick={(e) => { e.stopPropagation(); setMenu({ x: e.clientX - 180, y: e.clientY, r }) }}><MoreVertical size={16} /></button></td>
                  </tr>))}
              </tbody>
            </table>
            {!shown.length && <div className="empty">No rows match.</div>}
          </div>
          <div className="small muted" style={{ padding: '8px 16px' }}>
            {d.keys.in && rows.filter((r) => !r[d.keys.in]).length ? 'Rows without a login time (faded) are not drawn in the image. ' : ''}
            {S.edit.hidden.length ? `${S.edit.hidden.length} row(s) hidden from this export.` : ''}
          </div>
        </div>

        <div>
          <div className="card">
            <div className="tabs" style={{ marginBottom: 8 }}>
              <button className={'tab ' + (tab === 'names' ? 'on' : '')} onClick={() => setTab('names')}>Name corrections ({corr.length})</button>
              <button className={'tab ' + (tab === 'log' ? 'on' : '')} onClick={() => setTab('log')}>Edit log ({S.log.length})</button>
            </div>
            {tab === 'names' ? (
              <>
                <div className="small muted">Saved fixes with "auto" on are applied to every file you import later.</div>
                <div style={{ maxHeight: 200, overflow: 'auto' }}>
                  {!corr.length && <div className="small muted mt">No saved corrections yet.</div>}
                  {corr.map((c) => (
                    <div key={c.id} className="issue row" style={{ marginTop: 8, marginBottom: 0 }}>
                      <div style={{ minWidth: 0, flex: 1 }}><s className="muted">{c.original}</s> → <b>{c.corrected}</b></div>
                      <Toggle on={c.auto} onChange={async (v) => setCorr(await api.set_correction_auto(c.id, v))} />
                      <button className="btn sm" style={{ background: 'none', padding: 4 }} onClick={async () => setCorr(await api.delete_correction(c.id))}><Trash2 size={15} /></button>
                    </div>))}
                </div>
                <div className="row mt"><input className="input" placeholder="Wrong spelling" value={nc.a} onChange={(e) => setNc({ ...nc, a: e.target.value })} />
                  <input className="input" placeholder="Correct spelling" value={nc.b} onChange={(e) => setNc({ ...nc, b: e.target.value })} />
                  <button className="btn sm primary" disabled={!nc.a || !nc.b} onClick={async () => { setCorr(await api.add_correction(nc.a, nc.b, true)); setNc({ a: '', b: '' }) }}>Add</button></div>
              </>
            ) : (
              <div style={{ maxHeight: 260, overflow: 'auto' }}>
                {!S.log.length && <div className="small muted">Nothing edited yet.</div>}
                {S.log.map((e, i) => (
                  <div key={i} className="small" style={{ padding: '7px 0', borderBottom: '1px solid var(--line)' }}>
                    <span className="muted">{e.t}</span> · <b>{e.row}</b> · {e.col.split(' (')[0]}<div><s className="muted">{String(e.old || '(empty)')}</s> → {String(e.neu)}</div></div>))}
              </div>
            )}
          </div>
          <div className="card mt"><b>Live output</b>
            <div className="preview-stage mt" style={{ padding: 8, minHeight: 120, maxHeight: 250 }}>
              {res?.ok && <img src={res.images[0].data_url} alt="" style={{ maxWidth: '100%' }} />}</div>
            <div className="small muted mt">Updates as you edit.</div></div>
        </div>
      </div>

      {menu && (
        <div className="ctx" style={{ left: Math.min(menu.x, window.innerWidth - 220), top: Math.min(menu.y, window.innerHeight - 140) }}>
          <button onClick={() => { hideRow(S, set, menu.r); setMenu(null) }}><EyeOff size={15} /> Hide from this export</button>
          <button onClick={() => { resetRow(S, set, menu.r); setMenu(null) }}><RotateCcw size={15} /> Reset row to original</button>
        </div>)}
      {modal === 'find' && <FindReplace rows={shown} cols={cols} header={header} S={S} set={set} close={() => setModal(null)} notify={notify} />}
      {modal === 'bulk' && <BulkEdit rows={rows} cols={cols} header={header} sel={sel} S={S} set={set} close={() => setModal(null)} notify={notify} />}

      <div className="footbar">
        <span className="dot" /><div className="small muted">Step 5 of 6 · edits are kept while the app is open</div><div className="sp" />
        <button className="btn ghost" onClick={() => go(4)}><ArrowLeft size={16} /> Back to Configure</button>
        <button className="btn primary" onClick={() => go(6)}>Continue to Preview & Export <ArrowRight size={16} /></button>
      </div>
    </>
  )
}

function FindReplace({ rows, cols, header, S, set, close, notify }) {
  const [f, setF] = useState(''), [r, setR] = useState(''), [col, setCol] = useState('*')
  const hits = []
  if (f) rows.forEach((row) => cols.forEach((l) => {
    if ((col === '*' || col === l) && String(row[l]).toLowerCase().includes(f.toLowerCase())) hits.push({ row, label: l })
  }))
  const go = () => {
    const items = hits.map((h) => {
      const v = String(h.row[h.label]).replace(new RegExp(f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), r)
      return { ...h, value: isTimeHeader(header(h.label)) ? normalizeTime(v) ?? h.row[h.label] : v }
    })
    batchSet(S, set, items); notify(`Replaced in ${items.length} cell(s).`); close()
  }
  return (
    <Modal title="Find & replace" onClose={close}>
      <label className="lab">FIND</label><input className="input" autoFocus value={f} onChange={(e) => setF(e.target.value)} />
      <label className="lab">REPLACE WITH</label><input className="input" value={r} onChange={(e) => setR(e.target.value)} />
      <label className="lab">COLUMN</label><select className="select" value={col} onChange={(e) => setCol(e.target.value)}>
        <option value="*">All columns in the image</option>{cols.map((l) => <option key={l} value={l}>{header(l)}</option>)}</select>
      <div className="row mt"><span className="chip maroon">{hits.length} match(es)</span><div className="sp" />
        <button className="btn primary" disabled={!hits.length} onClick={go}>Replace all</button></div>
    </Modal>
  )
}

function BulkEdit({ rows, cols, header, sel, S, set, close, notify }) {
  const [col, setCol] = useState(cols[cols.length - 1]), [v, setV] = useState('')
  const targets = sel.length ? rows.filter((r) => sel.includes(r._i)) : rows
  const time = isTimeHeader(header(col))
  const val = time ? normalizeTime(v) : v.trim()
  const go = () => { batchSet(S, set, targets.map((row) => ({ row, label: col, value: val }))); notify(`Updated ${targets.length} row(s).`); close() }
  return (
    <Modal title="Bulk edit" onClose={close}>
      <div className="small muted">Sets one column to one value for {sel.length ? `the ${sel.length} ticked row(s)` : 'ALL rows (nothing ticked)'}.</div>
      <label className="lab">COLUMN</label><select className="select" value={col} onChange={(e) => setCol(e.target.value)}>
        {cols.map((l) => <option key={l} value={l}>{header(l)}</option>)}</select>
      <label className="lab">NEW VALUE {time && '(time like 08:15 — leave empty to clear)'}</label>
      <input className="input" autoFocus value={v} onChange={(e) => setV(e.target.value)} />
      {time && v && val === null && <div className="small" style={{ color: '#a30f0f', marginTop: 4 }}>Not a valid time.</div>}
      <div className="row mt"><span className="chip maroon">{targets.length} row(s)</span><div className="sp" />
        <button className="btn primary" disabled={time && v && val === null} onClick={go}>Apply</button></div>
    </Modal>
  )
}
