import { useState } from 'react'
import { MapPin, Map, UserSearch, Building2, ArrowLeft, ArrowRight, Search, X } from 'lucide-react'
import { Stepper } from '../ui.jsx'

export default function Scope({ S, set, go, step, maxStep }) {
  const d = S.data
  const [q, setQ] = useState('')
  const inScope = d.records.map((r, i) => ({ r, i })).filter((x) => x.r[d.keys.in])
  const all = inScope.map((x) => x.i)
  const kind = S.scope.kind
  const sel = new Set(S.scope.selected)
  const pick = (k) => set({ scope: { kind: k, selected: k === 'rep' && !S.scope.selected.length ? all : S.scope.selected } })
  const toggle = (i) => { const n = new Set(sel); n.has(i) ? n.delete(i) : n.add(i); set({ scope: { kind, selected: [...n] } }) }
  const shown = inScope.filter((x) => !q || x.r[d.keys.terr].toLowerCase().includes(q.toLowerCase()))
  const count = kind === 'all' ? all.length : sel.size

  const Card = ({ id, icon, tag, title, text, foot, off }) => (
    <div className={'pick ' + (kind === id ? 'sel' : '') + (off ? ' off' : '')} onClick={() => !off && pick(id)}>
      <div className="radio" />
      <div className="row"><div className="chip maroon" style={{ padding: 10 }}>{icon}</div>
        <div><div className="small muted" style={{ fontWeight: 700, letterSpacing: '.06em' }}>{tag}</div><div style={{ fontSize: 20, fontWeight: 700 }}>{title}</div></div></div>
      <p className="sub" style={{ margin: '10px 0' }}>{text}</p>
      <div className="row"><span className="small muted">{foot}</span><div className="sp" />{off && <span className="chip warn">Next update</span>}</div>
    </div>
  )

  return (
    <>
      <Stepper step={step} go={go} maxStep={maxStep} />
      <div className="row"><div><div className="eyebrow">Scope assignment</div><div className="page-title">Select Attendance Generation Scope</div>
        <p className="sub">Choose whether the output covers all field sales reps or only selected territories.</p></div><div className="sp" />
        <div className="card kpi" style={{ minWidth: 200 }}><div className="l">Validated source</div><div className="v" style={{ fontSize: 24 }}>{d.stats.logged_in} reps</div></div></div>
      <div className="grid g2 mt">
        <Card id="rep" icon={<MapPin size={22} />} tag="FIELD OPERATIONS" title="Rep-Wise Attendance" text="Generate the tables for chosen territories or reps only. Good for checking a region or a few people." foot="Pick territories below" />
        <Card id="all" icon={<Map size={22} />} tag="NATIONAL NETWORK" title="All Reps Attendance" text="Every rep who logged in. Produces the standard tables: not logged out, and logged out." foot={`${all.length} reps included`} />
        <Card id="emp1" off icon={<UserSearch size={22} />} tag="HEAD OFFICE / PLANT" title="Employee-Wise Attendance" text="Individual monthly muster sheet with daily punch analysis and late arrivals." foot="Employee module preview" />
        <Card id="emp2" off icon={<Building2 size={22} />} tag="CORPORATE ROSTER" title="All Employees Attendance" text="Master muster grid across all departments." foot="Employee module preview" />
      </div>

      {kind === 'rep' && (
        <div className="card mt">
          <div className="row" style={{ flexWrap: 'wrap' }}><h3 style={{ margin: 0 }}>Choose territories</h3><span className="chip maroon">{sel.size} of {all.length} selected</span><div className="sp" />
            <div className="row" style={{ position: 'relative', width: 280 }}><Search size={15} style={{ position: 'absolute', left: 10, color: 'var(--muted)' }} />
              <input className="input" style={{ paddingLeft: 32 }} placeholder="Search territory or rep…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
            <button className="btn sm primary" onClick={() => set({ scope: { kind, selected: all } })}>Select all ({all.length})</button>
            <button className="btn sm ghost" onClick={() => set({ scope: { kind, selected: [] } })}>Clear</button></div>
          <div className="pillbar mt" style={{ maxHeight: 260, overflow: 'auto' }}>
            {shown.map((x) => (
              <label key={x.i} className="tag" style={{ cursor: 'pointer', background: sel.has(x.i) ? 'var(--maroon-l)' : '#fff', borderColor: sel.has(x.i) ? 'var(--maroon)' : 'var(--line)' }}>
                <input type="checkbox" checked={sel.has(x.i)} onChange={() => toggle(x.i)} /> {x.r[d.keys.terr]}
              </label>))}
          </div>
        </div>
      )}
      <div className="footbar">
        <span className="dot" style={{ background: 'var(--maroon)' }} />
        <div><div className="small muted">Active target scope</div><b>{kind === 'all' ? `All reps (${count})` : `${count} selected territories`}</b></div>
        <div className="sp" />
        <button className="btn ghost" onClick={() => go(2)}><ArrowLeft size={16} /> Back to Review</button>
        <button className="btn primary" disabled={!count} onClick={() => go(4)}>Continue to Workspace & Layout <ArrowRight size={16} /></button>
      </div>
    </>
  )
}
