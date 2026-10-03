import { useState } from 'react'
import { MapPin, Map, UserSearch, Building2, ArrowLeft, ArrowRight, Search } from 'lucide-react'
import { Stepper } from '../ui.jsx'

export default function Scope({ S, set, go, step, maxStep }) {
  const d = S.data
  const emp = d.module === 'employee'
  const [q, setQ] = useState('')
  const lab = d.keys.label
  const ok = (r) => (d.keys.in ? r[d.keys.in] : !r._skip)
  const inScope = d.records.map((r, i) => ({ r, i })).filter((x) => ok(x.r))
  const all = inScope.map((x) => x.i)
  const kind = S.scope.kind
  const sel = new Set(S.scope.selected)
  const pick = (k) => set({ scope: { kind: k, selected: k === 'pick' && !S.scope.selected.length ? all : S.scope.selected } })
  const toggle = (i) => { const n = new Set(sel); n.has(i) ? n.delete(i) : n.add(i); set({ scope: { kind, selected: [...n] } }) }
  const shown = inScope.filter((x) => !q || String(x.r[lab]).toLowerCase().includes(q.toLowerCase()))
  const count = kind === 'all' ? all.length : sel.size
  const sub = (x) => (emp ? x.r.SECTION || x.r.DEPARTMENT || '' : '')

  const Card = ({ id, mod, icon, tag, title, text, foot }) => {
    const off = mod !== d.module
    return (
      <div className={'pick ' + (kind === id ? 'sel' : '') + (off ? ' off' : '')} onClick={() => !off && pick(id)}>
        <div className="radio" />
        <div className="row"><div className="chip maroon" style={{ padding: 10 }}>{icon}</div>
          <div><div className="small muted" style={{ fontWeight: 700, letterSpacing: '.06em' }}>{tag}</div><div style={{ fontSize: 20, fontWeight: 700 }}>{title}</div></div></div>
        <p className="sub" style={{ margin: '10px 0' }}>{text}</p>
        <div className="row"><span className="small muted">{off ? `Import a ${mod === 'rep' ? 'rep attendance' : 'staff'} file to use this` : foot}</span></div>
      </div>
    )
  }

  return (
    <>
      <Stepper step={step} go={go} maxStep={maxStep} />
      <div className="row"><div><div className="eyebrow">Scope assignment</div><div className="page-title">Select Attendance Generation Scope</div>
        <p className="sub">Choose whether the output covers everyone in the file or only the people you tick.</p></div><div className="sp" />
        <div className="card kpi" style={{ minWidth: 200 }}><div className="l">Validated source</div><div className="v" style={{ fontSize: 24 }}>{all.length} {emp ? 'employees' : 'reps'}</div></div></div>
      <div className="grid g2 mt">
        <Card id="pick" mod="rep" icon={<MapPin size={22} />} tag="FIELD OPERATIONS" title="Rep-Wise Attendance" text="Generate the tables for chosen territories or reps only. Good for checking a region or a few people." foot="Pick territories below" />
        <Card id="all" mod="rep" icon={<Map size={22} />} tag="NATIONAL NETWORK" title="All Reps Attendance" text="Every rep who logged in. Produces the standard tables: not logged out, and logged out." foot={`${all.length} reps included`} />
        <Card id="pick" mod="employee" icon={<UserSearch size={22} />} tag="HEAD OFFICE / PLANT" title="Employee-Wise Attendance" text="Choose one or many employees and get only their attendance." foot="Pick employees below" />
        <Card id="all" mod="employee" icon={<Building2 size={22} />} tag="CORPORATE ROSTER" title="All Employees Attendance" text="Everyone with entries in the file, across all sections and departments." foot={`${all.length} employees included`} />
      </div>

      {kind === 'pick' && (
        <div className="card mt">
          <div className="row" style={{ flexWrap: 'wrap' }}><h3 style={{ margin: 0 }}>{emp ? 'Choose employees' : 'Choose territories'}</h3><span className="chip maroon">{sel.size} of {all.length} selected</span><div className="sp" />
            <div className="row" style={{ position: 'relative', width: 280 }}><Search size={15} style={{ position: 'absolute', left: 10, color: 'var(--muted)' }} />
              <input className="input" style={{ paddingLeft: 32 }} placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
            <button className="btn sm primary" onClick={() => set({ scope: { kind, selected: all } })}>Select all ({all.length})</button>
            <button className="btn sm ghost" onClick={() => set({ scope: { kind, selected: [] } })}>Clear</button></div>
          <div className="pillbar mt" style={{ maxHeight: 260, overflow: 'auto' }}>
            {shown.map((x) => (
              <label key={x.i} className="tag" style={{ cursor: 'pointer', background: sel.has(x.i) ? 'var(--maroon-l)' : '#fff', borderColor: sel.has(x.i) ? 'var(--maroon)' : 'var(--line)' }}>
                <input type="checkbox" checked={sel.has(x.i)} onChange={() => toggle(x.i)} /> {x.r[lab]}{sub(x) && <span className="small muted"> · {sub(x)}</span>}
              </label>))}
          </div>
        </div>
      )}
      <div className="footbar">
        <span className="dot" style={{ background: 'var(--maroon)' }} />
        <div><div className="small muted">Active target scope</div><b>{kind === 'all' ? `Everyone (${count})` : `${count} selected`}</b></div>
        <div className="sp" />
        <button className="btn ghost" onClick={() => go(2)}><ArrowLeft size={16} /> Back to Review</button>
        <button className="btn primary" disabled={!count} onClick={() => go(4)}>Continue to Workspace & Layout <ArrowRight size={16} /></button>
      </div>
    </>
  )
}
