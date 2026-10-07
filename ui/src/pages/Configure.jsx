import { useEffect, useState } from 'react'
import { ArrowRight, ArrowLeft, ArrowUp, ArrowDown, Plus, Minus, RefreshCw } from 'lucide-react'
import { api } from '../api'
import { usePreview } from '../hooks'
import { isFixed, isXlsx } from '../store'
import { Stepper } from '../ui.jsx'

export function Preview2({ res, busy, tab, setTab, maxW, xlsx }) {
  const imgs = res?.ok ? res.images : []
  const cur = imgs[Math.min(tab, imgs.length - 1)]
  return (
    <>
      <div className="tabs">
        {imgs.map((im, i) => (
          <button key={im.name} className={'tab ' + (i === tab ? 'on' : '')} onClick={() => setTab(i)}>
            {xlsx ? 'Sheet' : 'Image'} {i + 1}: {im.name.replace(/_/g, ' ')} <span className="chip maroon">{im.count}</span></button>))}
        {busy && <span className="small muted" style={{ marginLeft: 'auto' }}><RefreshCw size={13} /> updating…</span>}
      </div>
      <div className="preview-stage">
        {res && !res.ok && <div className="chip maroon" style={{ whiteSpace: 'normal' }}>{res.error}</div>}
        {cur && (cur.name === 'staff_sheet'
          ? <img src={cur.data_url} alt="preview" style={{ maxWidth: 'none', width: Math.round(1500 * (maxW ? parseInt(maxW, 10) / 100 : 1)) }} />
          : <img src={cur.data_url} alt="preview" style={{ maxWidth: maxW || '100%' }} />)}
      </div>
    </>
  )
}

export default function Configure({ S, set, go, step, maxStep }) {
  const d = S.data
  const [tpls, setTpls] = useState([])
  const [xlt, setXlt] = useState([])
  const [tab, setTab] = useState(0)
  const [selA, setSelA] = useState([]), [selC, setSelC] = useState([])
  const { res, busy } = usePreview(S)
  useEffect(() => { api.templates().then(setTpls); api.xlsx_templates().then(setXlt) }, [])
  const mine = tpls.filter((t) => t.module === 'any' || t.module === d.module)
  const cfg = S.cfg
  const setCfg = (p) => set({ cfg: { ...cfg, ...p } })
  const col = (l) => d.columns.find((c) => c.label === l) || { header: l, display: l }
  const hd = (l) => col(l).header
  const avail = d.columns.map((c) => c.label).filter((l) => !cfg.columns.includes(l))
  const add = () => { setCfg({ columns: [...cfg.columns, ...selA] }); setSelA([]) }
  const rem = () => { setCfg({ columns: cfg.columns.filter((l) => !selC.includes(l)) }); setSelC([]) }
  const move = (dx) => {
    const a = [...cfg.columns]
    const idx = selC.map((l) => a.indexOf(l)).sort((x, y) => dx * (y - x))
    idx.forEach((i) => { const j = i + dx; if (j >= 0 && j < a.length && !selC.includes(a[j])) [a[i], a[j]] = [a[j], a[i]] })
    setCfg({ columns: a })
  }
  const tog = (arr, setArr, l, multi) => setArr(arr.includes(l) ? arr.filter((x) => x !== l) : multi ? [...arr, l] : [l])
  const fixed = isFixed(S)
  const xl = isXlsx(S)
  const sh = d.sheet || {}
  const setMode = (id) => {
    const m = d.modes.find((x) => x.id === id)
    const t = m.fixed ? 'emp-sheet' : (cfg.template === 'emp-sheet' ? d.grid_template : cfg.template)
    setCfg({ mode: id, template: t })
  }
  const tpl = tpls.find((t) => t.id === cfg.template)
  const applyPreset = (pr) => setCfg({ columns: pr.columns.filter((l) => d.columns.some((c) => c.label === l)), template: pr.name === 'Monthly grid' ? d.grid_template : (d.default_template === cfg.template || cfg.template === d.grid_template ? d.default_template : cfg.template) })

  return (
    <>
      <Stepper step={step} go={go} maxStep={maxStep} />
      <div className="grid" style={{ gridTemplateColumns: '1fr 1.15fr', alignItems: 'start' }}>
        <div>
          {fixed && (
            <div className="card" style={{ borderColor: 'var(--maroon)', marginBottom: 14 }}>
              <h3>Exact copy of your Excel sheet</h3>
              <div className="sub small">The layout is fixed: names down the side, two columns per day (status and arrival time), the same colours and row order as the sheet. Corrections made in the Edit step appear in it.</div>
              <div className="mt">
                {[['rows', `Show the ${sh.n_hidden_rows || 0} row(s) hidden in the Excel sheet`, (sh.n_hidden_rows || 0) > 0],
                  ['days', `Show the date column(s) hidden in the sheet (day ${(sh.hidden_days || []).join(', ')})`, (sh.hidden_days || []).length > 0],
                  ['totals', 'Show the Total Absent / Total Leaves / Total Work days columns (hidden in the sheet)', !!sh.totals_hidden]]
                  .filter((x) => x[2]).map(([k, label]) => (
                    <label key={k} className="row" style={{ marginBottom: 8, cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!cfg.sheet[k]} onChange={(e) => setCfg({ sheet: { ...cfg.sheet, [k]: e.target.checked } })} /> <span>{label}</span></label>))}
              </div>
            </div>)}
          {xl && (
            <div className="card" style={{ borderColor: 'var(--maroon)', marginBottom: 14 }}>
              <h3>Excel file (.xlsx) output</h3>
              <div className="sub small">{d.kind === 'timecard'
                ? 'One Excel file with a sheet for every week (Week 1 = days 1-7, Week 2 = 8-14 ...). Same layout as your weekly example sheets. All employees are listed, even those without punches.'
                : 'One Excel sheet with a row per employee (duplicate punches merged). Employees from your roster with no punch are listed with "-". Same layout as your daily example sheet.'}</div>
              <label className="lab">EXCEL LAYOUT</label>
              <select className="select" value={cfg.xlsxTemplate || ''} onChange={(e) => setCfg({ xlsxTemplate: e.target.value })}>
                <option value="">Built-in: copy of my example sheet</option>
                {xlt.filter((t) => t.kind === (d.kind === 'timecard' ? 'grid' : 'list')).map((t) => <option key={t.id} value={t.id}>{t.name} (uploaded)</option>)}</select>
              <div className="small muted mt">Add your own layouts by uploading an example Excel file in Output Templates.</div>
              <div className="small muted mt">The layout is fixed, so the column picker is switched off. Corrections from the Edit step are included. Choose the folder in the last step.</div>
            </div>)}
          <div className="card" style={fixed || xl ? { opacity: 0.45, pointerEvents: 'none' } : null}>
            <h3>Table columns</h3><div className="sub small">Click to select. Use the buttons to add, remove and reorder. Top = left-most column.</div>
            <div className="row mt" style={{ flexWrap: 'wrap', gap: 6 }}><span className="small muted" style={{ fontWeight: 700 }}>QUICK LAYOUTS</span>
              {d.presets.map((pr) => <button key={pr.name} className="btn sm outline" onClick={() => applyPreset(pr)}>{pr.name}</button>)}</div>
            <div className="row mt" style={{ alignItems: 'stretch' }}>
              <div style={{ flex: 1 }}><label className="lab">AVAILABLE ({avail.length})</label>
                <div className="listbox">{avail.map((l) => <div key={l} className={'li ' + (selA.includes(l) ? 'sel' : '')} onClick={() => tog(selA, setSelA, l, true)} onDoubleClick={() => setCfg({ columns: [...cfg.columns, l] })}>{col(l).display || l}</div>)}</div></div>
              <div style={{ display: 'grid', alignContent: 'center', gap: 6 }}>
                <button className="btn sm" title="Add" onClick={add} disabled={!selA.length}><Plus size={16} /></button>
                <button className="btn sm" title="Remove" onClick={rem} disabled={!selC.length}><Minus size={16} /></button>
                <button className="btn sm" title="Move up" onClick={() => move(-1)} disabled={!selC.length}><ArrowUp size={16} /></button>
                <button className="btn sm" title="Move down" onClick={() => move(1)} disabled={!selC.length}><ArrowDown size={16} /></button></div>
              <div style={{ flex: 1 }}><label className="lab">IN THE IMAGE ({cfg.columns.length})</label>
                <div className="listbox">{cfg.columns.map((l) => <div key={l} className={'li ' + (selC.includes(l) ? 'sel' : '')} onClick={() => tog(selC, setSelC, l, true)} onDoubleClick={() => setCfg({ columns: cfg.columns.filter((x) => x !== l) })}>{col(l).display || l}</div>)}</div></div>
            </div>
          </div>
          <div className="card mt">
            <h3>{xl ? 'Output type' : 'Output image settings'}</h3>
            <label className="lab">ROWS TO SHOW</label>
            {d.modes.map(({ id, title: t, sub }) => (
              <div key={id} className={'radio-row ' + (cfg.mode === id ? 'sel' : '')} onClick={() => setMode(id)}>
                <input type="radio" readOnly checked={cfg.mode === id} /><div><b>{t}</b><div className="small muted">{sub}</div></div></div>))}
            <div className="grid g2">
              <div><label className="lab">SORT BY</label>
                <select className="select" value={cfg.sort} onChange={(e) => setCfg({ sort: e.target.value })}>
                  {d.sorts.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}</select></div>
              <div><label className="lab">DATE FORMAT</label>
                <select className="select" value={cfg.dateFormat} onChange={(e) => setCfg({ dateFormat: e.target.value })}>
                  {['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD', 'DD-MMM-YYYY'].map((f) => <option key={f}>{f}</option>)}</select></div>
            </div>
            <div className="grid g2">
              <div><label className="lab">TEMPLATE (LOOK OF THE IMAGE)</label>
                <select className="select" value={cfg.template} onChange={(e) => setCfg({ template: e.target.value })}>
                  {mine.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
              <div><label className="lab">TITLE ({'{date}'} = report date)</label>
                <input className="input" value={cfg.title} placeholder={fixed ? '(no title, like the sheet)' : (tpl?.title || 'LOGGED IN DATE {date}')} onChange={(e) => setCfg({ title: e.target.value })} /></div>
            </div>
          </div>
        </div>
        <div className="card"><h3>Live preview</h3>
          <Preview2 res={res} busy={busy} tab={tab} setTab={setTab} xlsx={xl} /></div>
      </div>
      <div className="footbar">
        <div><b>Ready for editing</b><div className="small muted">{res?.ok ? `${res.images.length} image(s) configured` : 'Building preview…'}</div></div><div className="sp" />
        <button className="btn ghost" onClick={() => go(3)}><ArrowLeft size={16} /> Back to Scope</button>
        <button className="btn primary" disabled={!cfg.columns.length || !res?.ok} onClick={() => go(5)}>Continue to Edit <ArrowRight size={16} /></button>
      </div>
    </>
  )
}
