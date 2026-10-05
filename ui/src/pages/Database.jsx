import { useEffect, useState } from 'react'
import { Database as Db, Users, ClipboardList, FileUp, FileSpreadsheet, Search, FolderOpen, Trash2 } from 'lucide-react'
import { api } from '../api'
import { Empty, Modal } from '../ui.jsx'

const PRESETS = [['today', 'Today'], ['yesterday', 'Yesterday'], ['this_week', 'This week'], ['last_week', 'Last week'],
  ['this_month', 'This month'], ['last_month', 'Last month'], ['this_year', 'This year'], ['last_year', 'Last year'], ['all', 'All time'], ['custom', 'Custom']]
const fmt = (iso) => (iso && iso.length === 10 ? new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : iso)

export default function Database({ S, notify }) {
  const [kind, setKind] = useState('employee')
  const [preset, setPreset] = useState('today')
  const [custom, setCustom] = useState({ start: '', end: '' })
  const [person, setPerson] = useState('')
  const [group, setGroup] = useState('')
  const [q, setQ] = useState('')
  const [view, setView] = useState('summary')
  const [people, setPeople] = useState([])
  const [res, setRes] = useState(null)
  const [st, setSt] = useState(null)
  const [del, setDel] = useState(false)
  const emp = kind === 'employee'

  const loadStats = () => api.db_stats().then((s) => { setSt(s); setCustom((c) => (c.start ? c : { start: s.today, end: s.today })) })
  useEffect(() => { loadStats() }, [])
  useEffect(() => { setPerson(''); setGroup(''); api.db_people(kind).then(setPeople) }, [kind, st?.employee?.n, st?.rep?.n])
  useEffect(() => {
    let dead = false
    api.db_query({ kind, preset, start: custom.start, end: custom.end, people: person ? [person] : [], group, q }).then((r) => !dead && setRes(r))
    return () => { dead = true }
  }, [kind, preset, custom.start, custom.end, person, group, q, st?.employee?.n, st?.rep?.n])

  const groups = [...new Set(people.map((p) => p.group).filter(Boolean))].sort()
  const total = st ? st[kind].n : 0
  const addFile = async () => {
    const f = await api.pick_file(); if (!f) return
    const r = await api.db_add_file(f)
    if (!r.ok) return notify(r.error, true)
    notify(`${r.kind} (${r.date}) added to the database: ${r.saved.employees + r.saved.reps} records.`); loadStats()
  }
  const exportXlsx = async () => {
    const s = await api.settings()
    const folder = s.xlsx_folder || (await api.pick_folder(''))
    if (!folder) return
    const r = await api.db_export({ kind, preset, start: custom.start, end: custom.end, people: person ? [person] : [], group, q }, folder)
    if (!r.ok) return notify(r.error, true)
    notify(`Saved ${r.path}`, false, { label: 'Show folder', run: () => api.reveal_file(r.path) })
  }
  const k = res?.kpi

  return (
    <>
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <div><div className="eyebrow">Attendance Database</div><div className="page-title">Records & History</div>
          <div className="sub">Every export is saved here automatically. Filter by period, rep or employee.</div></div><div className="sp" />
        <button className="btn outline" onClick={addFile}><FileUp size={16} /> Add Excel file to database</button>
        <button className="btn primary" disabled={!res?.kpi?.records} onClick={exportXlsx}><FileSpreadsheet size={16} /> Download as Excel</button>
      </div>

      <div className="card mt" style={{ padding: 14 }}>
        <div className="row" style={{ background: 'var(--cream3)', borderRadius: 9, padding: 3, width: 'fit-content' }}>
          <button className={'btn sm ' + (emp ? 'primary' : '')} onClick={() => setKind('employee')}><Users size={14} /> Employees</button>
          <button className={'btn sm ' + (!emp ? 'primary' : '')} onClick={() => setKind('rep')}><ClipboardList size={14} /> Reps</button></div>
        <div className="row mt" style={{ flexWrap: 'wrap', gap: 6 }}>
          {PRESETS.map(([id, l]) => <button key={id} className={'btn sm ' + (preset === id ? 'primary' : 'outline')} onClick={() => setPreset(id)}>{l}</button>)}
        </div>
        {preset === 'custom' && (
          <div className="row mt"><label className="small muted">From</label><input type="date" className="input" style={{ width: 160 }} value={custom.start} onChange={(e) => setCustom({ ...custom, start: e.target.value })} />
            <label className="small muted">To</label><input type="date" className="input" style={{ width: 160 }} value={custom.end} onChange={(e) => setCustom({ ...custom, end: e.target.value })} /></div>)}
        <div className="row mt" style={{ flexWrap: 'wrap' }}>
          <select className="select" style={{ width: 260 }} value={person} onChange={(e) => setPerson(e.target.value)}>
            <option value="">{emp ? 'All employees' : 'All reps'}</option>{people.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}</select>
          <select className="select" style={{ width: 200 }} value={group} onChange={(e) => setGroup(e.target.value)}>
            <option value="">{emp ? 'All departments' : 'All regions'}</option>{groups.map((g) => <option key={g}>{g}</option>)}</select>
          <div className="row" style={{ position: 'relative', width: 220 }}><Search size={15} style={{ position: 'absolute', left: 10, color: 'var(--muted)' }} />
            <input className="input" style={{ paddingLeft: 32 }} placeholder="Search name or ID…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          {res?.ok && <span className="chip">{res.label}: {preset === 'all' ? 'all dates' : res.from === res.to ? fmt(res.from) : `${fmt(res.from)} – ${fmt(res.to)}`}</span>}
        </div>
      </div>

      {!total ? (
        <div className="card mt"><Empty icon={<Db size={30} />} title="The database is empty">
          Export any file from the wizard and it is saved here automatically, or use “Add Excel file to database” to load older files.</Empty></div>
      ) : (
        <>
          <div className="grid g4 mt">
            {[[emp ? 'Employees' : 'Reps', k?.people, 'with records in this period'], ['Records', k?.records, 'attendance lines'], ['Days with data', k?.days, 'distinct dates'],
              [emp ? 'Late arrivals' : 'Not logged out', emp ? k?.late : k?.no_out, emp ? 'after the late time in Settings' : 'login without logout']]
              .map(([l, v, s]) => <div key={l} className="card kpi"><div className="l">{l}</div><div className="v" style={{ fontSize: 28 }}>{v ?? '—'}</div><div className="s">{s}</div></div>)}
          </div>
          <div className="row mt">
            <div className="row" style={{ background: 'var(--cream3)', borderRadius: 9, padding: 3 }}>
              <button className={'btn sm ' + (view === 'summary' ? 'primary' : '')} onClick={() => setView('summary')}>{emp ? 'Per employee' : 'Per rep'}</button>
              <button className={'btn sm ' + (view === 'records' ? 'primary' : '')} onClick={() => setView('records')}>Daily records</button></div>
            {res?.truncated && <span className="chip warn">Showing the newest 6000 records. Narrow the period.</span>}
          </div>
          <div className="tbl-wrap mt" style={{ maxHeight: 440 }}>
            {!res?.ok ? <div className="chip maroon">{res?.error}</div> : !res.records.length ? (
              <Empty icon={<Db size={28} />} title="No records in this period">Try another period, or add the Excel files for these dates.</Empty>
            ) : view === 'summary' ? (
              <table className="t"><thead><tr><th>{emp ? 'ID' : 'Rep code'}</th><th>{emp ? 'Employee' : 'Territory'}</th><th>{emp ? 'Department' : 'Region'}</th>
                <th className="ctr">Days</th><th className="ctr">Present</th>{emp && <><th className="ctr">Leave</th><th className="ctr">Absent</th><th className="ctr">Late</th></>}
                {!emp && <th className="ctr">No logout</th>}<th className="ctr">Avg check-in</th><th className="ctr">First – last</th></tr></thead>
                <tbody>{res.summary.map((s) => (
                  <tr key={s.key} style={{ cursor: 'pointer' }} onClick={() => { setPerson(s.key); setView('records') }} title="Click to see this person's daily records">
                    <td>{s.id}</td><td><b>{s.who}</b></td><td>{s.group}</td><td className="ctr">{s.days}</td><td className="ctr">{s.present}</td>
                    {emp && <><td className="ctr">{s.leave}</td><td className="ctr">{s.absent}</td><td className="ctr">{s.late}</td></>}
                    {!emp && <td className="ctr">{s.no_out}</td>}<td className="ctr mono">{s.avg_in || '-'}</td>
                    <td className="ctr small">{fmt(s.first)}{s.first !== s.last ? ` – ${fmt(s.last)}` : ''}</td></tr>))}</tbody></table>
            ) : (
              <table className="t"><thead><tr><th>Date</th><th>{emp ? 'ID' : 'Rep code'}</th><th>{emp ? 'Employee' : 'Territory'}</th><th>{emp ? 'Department' : 'Region'}</th>
                {emp && <th className="ctr">Status</th>}<th className="ctr">Check in</th><th className="ctr">Check out</th><th>Source file</th></tr></thead>
                <tbody>{res.records.map((r, i) => (
                  <tr key={i}><td>{fmt(r.day)}</td><td>{r.emp_id || r.rep_code}</td><td><b>{emp ? r.name : r.territory}</b></td><td>{r.group}</td>
                    {emp && <td className="ctr">{r.status}</td>}<td className="ctr mono">{r.check_in || '-'}</td><td className="ctr mono">{r.check_out || '-'}</td>
                    <td className="small muted">{r.source}</td></tr>))}</tbody></table>
            )}
          </div>
        </>
      )}
      <div className="card mt row small muted" style={{ flexWrap: 'wrap' }}>
        <Db size={16} /> <span>{st ? `${st.employee.n} employee records (${st.employee.p} people) · ${st.rep.n} rep records (${st.rep.p} reps)` : ''}</span><div className="sp" />
        <span className="mono" style={{ userSelect: 'text' }}>{st?.path}</span>
        <button className="btn sm ghost" onClick={() => setDel(true)} disabled={!total}><Trash2 size={14} /> Delete a period…</button>
      </div>
      {del && <DeleteBox kind={kind} onClose={() => setDel(false)} onDone={(n) => { setDel(false); notify(`${n} record(s) deleted.`); loadStats() }} />}
    </>
  )
}

function DeleteBox({ kind, onClose, onDone }) {
  const [a, setA] = useState(''), [b, setB] = useState('')
  return (
    <Modal title="Delete records" onClose={onClose} width={480}>
      <div className="small muted">Removes {kind === 'rep' ? 'rep' : 'employee'} records between these dates from the database. Your Excel files and exported files are not touched.</div>
      <div className="row mt"><input type="date" className="input" value={a} onChange={(e) => setA(e.target.value)} /><span>to</span><input type="date" className="input" value={b} onChange={(e) => setB(e.target.value)} /></div>
      <button className="btn primary mt" disabled={!a || !b} onClick={async () => { const r = await api.db_delete(kind, a, b); onDone(r.deleted) }}><Trash2 size={15} /> Delete these records</button>
    </Modal>)
}
