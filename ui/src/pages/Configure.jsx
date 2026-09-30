import { useEffect, useState } from 'react'
import { ArrowRight, ArrowLeft, ArrowUp, ArrowDown, Plus, Minus, RefreshCw } from 'lucide-react'
import { api } from '../api'
import { usePreview } from '../hooks'
import { Stepper } from '../ui.jsx'

const MODES = [
  ['split', 'Two images: not logged out + logged out', 'Recommended — one image for each group'],
  ['not_out', 'Only reps NOT logged out', 'The active shift queue'],
  ['out', 'Only reps who logged out', 'Completed shifts'],
  ['all', 'All reps who logged in', 'One master image'],
]

export function Preview2({ res, busy, tab, setTab, maxW }) {
  const imgs = res?.ok ? res.images : []
  const cur = imgs[Math.min(tab, imgs.length - 1)]
  return (
    <>
      <div className="tabs">
        {imgs.map((im, i) => (
          <button key={im.name} className={'tab ' + (i === tab ? 'on' : '')} onClick={() => setTab(i)}>
            Image {i + 1}: {im.name.replace(/_/g, ' ')} <span className="chip maroon">{im.count}</span></button>))}
        {busy && <span className="small muted" style={{ marginLeft: 'auto' }}><RefreshCw size={13} /> updating…</span>}
      </div>
      <div className="preview-stage">
        {res && !res.ok && <div className="chip maroon" style={{ whiteSpace: 'normal' }}>{res.error}</div>}
        {cur && <img src={cur.data_url} alt="preview" style={{ maxWidth: maxW || '100%' }} />}
      </div>
    </>
  )
}

export default function Configure({ S, set, go, step, maxStep }) {
  const d = S.data
  const [tpls, setTpls] = useState([])
  const [tab, setTab] = useState(0)
  const [selA, setSelA] = useState([]), [selC, setSelC] = useState([])
  const { res, busy } = usePreview(S)
  useEffect(() => { api.templates().then(setTpls) }, [])
  const cfg = S.cfg
  const setCfg = (p) => set({ cfg: { ...cfg, ...p } })
  const hd = (l) => d.columns.find((c) => c.label === l).header
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
  const tpl = tpls.find((t) => t.id === cfg.template)

  return (
    <>
      <Stepper step={step} go={go} maxStep={maxStep} />
      <div className="grid" style={{ gridTemplateColumns: '1fr 1.15fr', alignItems: 'start' }}>
        <div>
          <div className="card">
            <h3>Table columns</h3><div className="sub small">Click to select. Use the buttons to add, remove and reorder. Top = left-most column.</div>
            <div className="row mt" style={{ alignItems: 'stretch' }}>
              <div style={{ flex: 1 }}><label className="lab">AVAILABLE ({avail.length})</label>
                <div className="listbox">{avail.map((l) => <div key={l} className={'li ' + (selA.includes(l) ? 'sel' : '')} onClick={(e) => tog(selA, setSelA, l, true)} onDoubleClick={() => setCfg({ columns: [...cfg.columns, l] })}>{l}</div>)}</div></div>
              <div style={{ display: 'grid', alignContent: 'center', gap: 6 }}>
                <button className="btn sm" title="Add" onClick={add} disabled={!selA.length}><Plus size={16} /></button>
                <button className="btn sm" title="Remove" onClick={rem} disabled={!selC.length}><Minus size={16} /></button>
                <button className="btn sm" title="Move up" onClick={() => move(-1)} disabled={!selC.length}><ArrowUp size={16} /></button>
                <button className="btn sm" title="Move down" onClick={() => move(1)} disabled={!selC.length}><ArrowDown size={16} /></button></div>
              <div style={{ flex: 1 }}><label className="lab">IN THE IMAGE ({cfg.columns.length})</label>
                <div className="listbox">{cfg.columns.map((l) => <div key={l} className={'li ' + (selC.includes(l) ? 'sel' : '')} onClick={() => tog(selC, setSelC, l, true)} onDoubleClick={() => setCfg({ columns: cfg.columns.filter((x) => x !== l) })}>{hd(l)}{hd(l) !== l && <span className="small muted">{l.replace(hd(l), '')}</span>}</div>)}</div></div>
            </div>
          </div>
          <div className="card mt">
            <h3>Output image settings</h3>
            <label className="lab">ROWS TO SHOW</label>
            {MODES.map(([id, t, sub]) => (
              <div key={id} className={'radio-row ' + (cfg.mode === id ? 'sel' : '')} onClick={() => setCfg({ mode: id })}>
                <input type="radio" readOnly checked={cfg.mode === id} /><div><b>{t}</b><div className="small muted">{sub}</div></div></div>))}
            <div className="grid g2">
              <div><label className="lab">SORT BY</label>
                <select className="select" value={cfg.sort} onChange={(e) => setCfg({ sort: e.target.value })}>
                  <option value="excel">Same order as Excel</option><option value="territory">Territory A-Z</option><option value="login">Login time</option></select></div>
              <div><label className="lab">DATE FORMAT</label>
                <select className="select" value={cfg.dateFormat} onChange={(e) => setCfg({ dateFormat: e.target.value })}>
                  {['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD', 'DD-MMM-YYYY'].map((f) => <option key={f}>{f}</option>)}</select></div>
            </div>
            <div className="grid g2">
              <div><label className="lab">TEMPLATE (LOOK OF THE IMAGE)</label>
                <select className="select" value={cfg.template} onChange={(e) => setCfg({ template: e.target.value })}>
                  {tpls.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
              <div><label className="lab">TITLE ({'{date}'} = report date)</label>
                <input className="input" value={cfg.title} placeholder={tpl?.title || 'LOGGED IN DATE {date}'} onChange={(e) => setCfg({ title: e.target.value })} /></div>
            </div>
          </div>
        </div>
        <div className="card"><h3>Live preview</h3>
          <Preview2 res={res} busy={busy} tab={tab} setTab={setTab} /></div>
      </div>
      <div className="footbar">
        <div><b>Ready for editing</b><div className="small muted">{res?.ok ? `${res.images.length} image(s) configured` : 'Building preview…'}</div></div><div className="sp" />
        <button className="btn ghost" onClick={() => go(3)}><ArrowLeft size={16} /> Back to Scope</button>
        <button className="btn primary" disabled={!cfg.columns.length || !res?.ok} onClick={() => go(5)}>Continue to Edit <ArrowRight size={16} /></button>
      </div>
    </>
  )
}
