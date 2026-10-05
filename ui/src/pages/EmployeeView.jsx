import { useEffect, useState } from 'react'
import { Users, Search, ArrowRight, CloudUpload } from 'lucide-react'
import { api } from '../api'
import { computeRows } from '../store'
import { Empty, Toggle } from '../ui.jsx'

const LEGEND = [['P', 'Present'], ['Ab', 'Absent'], ['L', 'Leave'], ['H', 'Holiday'], ['HD', 'Half-day'], ['V', 'Visit']]

export default function EmployeeView({ S, go }) {
  const d = S.data
  const [tab, setTab] = useState('grid')
  const [q, setQ] = useState('')
  const [sec, setSec] = useState('')
  const [late, setLate] = useState(true)
  const [after, setAfter] = useState('08:15')
  const [calc, setCalc] = useState([])
  const isEmp = d && d.module === 'employee'
  useEffect(() => { api.settings().then((s) => setAfter(s.late_after || '08:15')) }, [])
  const base = isEmp ? computeRows({ ...S, scope: { kind: 'all', selected: [] } }).filter((r) => !r._skip) : []
  useEffect(() => {
    if (!isEmp) return
    let dead = false
    api.recalc(base).then((r) => !dead && setCalc(r))
    return () => { dead = true }
  }, [S.edit, S.data])

  if (!isEmp) {
    return (
      <div className="card"><Empty icon={<Users size={30} />} title="No employee file loaded">
        Import the monthly staff sheet or the biometric export to see the calendar grid, summary table and late arrivals here.
        <div className="mt"><button className="btn primary" onClick={() => go(1)}><CloudUpload size={16} /> Import an employee file</button></div>
      </Empty></div>)
  }
  const rows = (calc.length ? calc : base).filter((r) => (!q || r.NAME.toLowerCase().includes(q.toLowerCase())) && (!sec || (r.SECTION ?? r.DEPARTMENT) === sec))
  const sections = [...new Set(base.map((r) => r.SECTION ?? r.DEPARTMENT).filter(Boolean))]
  const monthly = d.kind === 'monthly'
  const card = d.kind === 'timecard'
  const lateSec = (t) => { const [h, m, s] = t.split(':').map(Number); return h * 3600 + m * 60 + (s || 0) }
  const limit = lateSec(after + ':00')
  const isLate = (r, day) => late && r[day.d] === 'P' && r[day.t] && lateSec(r[day.t]) > limit

  return (
    <>
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <div><div className="eyebrow">Workforce · {d.kind_label}</div><div className="page-title">Employee Attendance — {d.date_label}</div></div>
        <div className="sp" />
        <div className="row" style={{ background: 'var(--cream3)', borderRadius: 9, padding: 3 }}>
          {monthly && <button className={'btn sm ' + (tab === 'grid' ? 'primary' : '')} onClick={() => setTab('grid')}>Monthly calendar grid</button>}
          <button className={'btn sm ' + ((tab === 'table' || !monthly) ? 'primary' : '')} onClick={() => setTab('table')}>{monthly ? 'Employee summary table' : card ? 'Monthly summary' : 'Daily check-ins'}</button></div>
      </div>

      <div className="grid g4 mt">{d.stat_cards.map((c) => <div key={c.l} className="card kpi"><div className="l">{c.l}</div><div className="v" style={{ fontSize: 28 }}>{c.v}</div><div className="s">{c.s}</div></div>)}</div>

      <div className="card mt row" style={{ flexWrap: 'wrap', padding: 12 }}>
        <div className="row" style={{ position: 'relative', width: 240 }}><Search size={15} style={{ position: 'absolute', left: 10, color: 'var(--muted)' }} />
          <input className="input" style={{ paddingLeft: 32 }} placeholder="Filter by name…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        {sections.length > 0 && <select className="select" style={{ width: 200 }} value={sec} onChange={(e) => setSec(e.target.value)}>
          <option value="">All {monthly ? 'sections' : 'departments'}</option>{sections.map((s) => <option key={s}>{s}</option>)}</select>}
        <span className="chip">Showing {rows.length} of {base.length}</span>
        <div className="sp" />
        <div className="row"><Toggle on={late} onChange={setLate} /><span className="small">Highlight late arrivals after {after}</span></div>
      </div>
      {monthly && tab === 'grid' && (
        <div className="legend mt">{LEGEND.map(([k, n]) => <span key={k} className={'st st-' + k} style={{ padding: '3px 9px' }}>{k} : {n}</span>)}<span className="small muted">Red dot = late arrival</span></div>)}

      <div className="tbl-wrap mt" style={{ maxHeight: 470 }}>
        {monthly && tab === 'grid' ? (
          <table className="grid-t">
            <thead><tr><th className="nm">EMPLOYEE</th>
              {d.days.map((x) => <th key={x.n} className={['Sat', 'Sun'].includes(x.wd) ? 'wk' : ''}>{x.n}<div style={{ fontWeight: 400, fontSize: 9 }}>{x.wd.slice(0, 2).toUpperCase()}</div></th>)}</tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r._i}><td className="nm"><b>{r.NAME}</b><div className="small muted">{r.SECTION || ' '}</div></td>
                {d.days.map((x) => <td key={x.n} className={['Sat', 'Sun'].includes(x.wd) ? 'wk' : ''}>
                  {r[x.d] && <span className={'st st-' + r[x.d] + (isLate(r, x) ? ' late' : '')} title={r[x.t] ? 'Arrived ' + r[x.t] : ''}>{r[x.d]}</span>}</td>)}</tr>))}</tbody>
          </table>
        ) : monthly ? (
          <table className="t"><thead><tr><th>Employee</th><th>Section</th>{['PRESENT', 'LEAVES', 'HOLIDAYS', 'HALF DAYS', 'VISITS', 'ABSENT', 'LATE DAYS', 'WORK DAYS'].map((h) => <th key={h} className="ctr">{h}</th>)}</tr></thead>
            <tbody>{rows.map((r) => <tr key={r._i}><td><b>{r.NAME}</b></td><td>{r.SECTION || '-'}</td>
              {['PRESENT', 'LEAVES', 'HOLIDAYS', 'HALF DAYS', 'VISITS', 'ABSENT', 'LATE DAYS', 'WORK DAYS'].map((h) => <td key={h} className="ctr">{r[h]}</td>)}</tr>)}</tbody></table>
        ) : card ? (
          <table className="t"><thead><tr><th>ID</th><th>Name</th><th>Department</th><th className="ctr">Days present</th><th className="ctr">Late days</th></tr></thead>
            <tbody>{rows.map((r) => <tr key={r._i}><td>{r['EMPLOYEE ID']}</td><td><b>{r.NAME}</b></td><td>{r.DEPARTMENT}</td><td className="ctr">{r['DAYS PRESENT']}</td><td className="ctr">{r['LATE DAYS']}</td></tr>)}</tbody></table>
        ) : (
          <table className="t"><thead><tr><th>ID</th><th>Name</th><th>Department</th><th className="ctr">First check-in</th><th className="ctr">Last punch</th><th className="ctr">Punches</th><th className="ctr">Late</th></tr></thead>
            <tbody>{rows.map((r) => <tr key={r._i}><td>{r['EMPLOYEE ID']}</td><td><b>{r.NAME}</b></td><td>{r.DEPARTMENT}</td>
              <td className="ctr mono">{r['FIRST CHECK-IN'] || '-'}</td><td className="ctr mono">{r['LAST PUNCH'] || '-'}</td><td className="ctr">{r.PUNCHES}</td>
              <td className="ctr"><span className={'chip ' + (r.LATE === 'Yes' ? 'maroon' : 'ok')}>{r.LATE}</span></td></tr>)}</tbody></table>
        )}
      </div>
      <div className="footbar">
        <div className="small muted">This view reads the file. To correct times or names, use the Edit step in the export flow.</div><div className="sp" />
        <button className="btn primary" onClick={() => go(4)}>Configure & export <ArrowRight size={16} /></button>
      </div>
    </>
  )
}
