import { useState } from 'react'
import { AlertTriangle, CheckCircle2, Wand2, ArrowLeft, ArrowRight, Search, Check, Columns3 } from 'lucide-react'
import { batchSet, hideRow, normalizeTime } from '../store'
import { Stepper, Empty } from '../ui.jsx'

export default function Review({ S, set, go, step, maxStep }) {
  const [showAll, setShowAll] = useState(false)
  const [q, setQ] = useState('')
  const [manual, setManual] = useState({})
  const d = S.data
  const hd = (l) => d.columns.find((c) => c.label === l)?.header || l
  const issues = d.issues.filter((i) => !S.ignored.includes(i.id))
  const rowOf = (i) => ({ ...d.records[i.index], ...(S.edit.overrides[i.index] || {}), _i: i.index })
  const safe = issues.filter((i) => i.suggest !== null && i.suggest !== undefined)
  const flagged = new Set(issues.map((i) => i.index))
  const cols = d.review_cols.filter((l) => d.columns.some((c) => c.label === l))
  const lab = d.keys.label
  const rows = d.records.map((r, i) => ({ ...r, ...(S.edit.overrides[i] || {}), _i: i }))
    .filter((r) => !r._skip && (showAll || flagged.has(r._i)) && (!q || String(r[lab]).toLowerCase().includes(q.toLowerCase())))
  const total = d.records.filter((r) => !r._skip).length
  const ignore = (i) => set((p) => ({ ignored: [...p.ignored, i.id] }))

  const apply = (i, value) => { batchSet(S, set, [{ row: rowOf(i), label: i.field, value }]); ignore(i) }
  const fixAll = () => {
    batchSet(S, set, safe.map((i) => ({ row: rowOf(i), label: i.field, value: i.suggest })))
    set((p) => ({ ignored: [...p.ignored, ...safe.map((i) => i.id)] }))
  }
  const mapping = d.module === 'rep'
    ? [['Territory', d.keys.terr], ['Login time', d.keys.in], ['Logout time', d.keys.out]]
    : d.kind === 'monthly' ? [['Employee name', 'NAME'], ['Section', 'SECTION'], ['Day columns (status per day)', d.status_cols[0]]]
      : [['Employee ID', 'EMPLOYEE ID'], ['Name', 'NAME'], ['Check-in time', 'FIRST CHECK-IN']]

  return (
    <>
      <Stepper step={step} go={go} maxStep={maxStep} />
      <div className="grid" style={{ gridTemplateColumns: '1.6fr 1fr', alignItems: 'start' }}>
        <div className="card" style={{ padding: 14 }}>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <div className="row" style={{ position: 'relative', flex: 1, minWidth: 220 }}>
              <Search size={15} style={{ position: 'absolute', left: 10, color: 'var(--muted)' }} />
              <input className="input" style={{ paddingLeft: 32 }} placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <div className="row" style={{ background: 'var(--cream3)', borderRadius: 9, padding: 3 }}>
              <button className={'btn sm ' + (!showAll ? 'primary' : '')} onClick={() => setShowAll(false)}>Issues only ({flagged.size})</button>
              <button className={'btn sm ' + (showAll ? 'primary' : '')} onClick={() => setShowAll(true)}>Show all ({total})</button>
            </div>
            <button className="btn sm outline" disabled={!safe.length} onClick={fixAll}><Wand2 size={14} /> Auto-fix safe ({safe.length})</button>
          </div>
          <div className="tbl-wrap mt" style={{ maxHeight: 470 }}>
            {!rows.length ? (
              <Empty icon={<CheckCircle2 size={30} />} title="No problems found">
                All {total} rows look valid. You can still review every row with "Show all".
              </Empty>
            ) : (
              <table className="t"><thead><tr><th></th><th>Row</th><th>{hd(lab)}</th>{cols.map((l) => <th key={l} className="ctr">{hd(l)}</th>)}</tr></thead>
                <tbody>{rows.map((r) => (
                  <tr key={r._i} className={flagged.has(r._i) ? 'flag' : ''}>
                    <td>{flagged.has(r._i) ? <AlertTriangle size={16} color="var(--maroon)" /> : <Check size={16} color="var(--ok)" />}</td>
                    <td className="muted">#{r._row}</td><td><b>{r[lab]}</b></td>
                    {cols.map((l) => <td key={l} className="ctr mono">{r[l] || '-'}</td>)}
                  </tr>))}</tbody></table>
            )}
          </div>
          <div className="small muted" style={{ marginTop: 8 }}>Showing {rows.length} of {total} records</div>
        </div>

        <div>
          <div className="card">
            <div className="row"><h3>Issues & suggestions</h3><div className="sp" /><span className={'chip ' + (issues.length ? 'maroon' : 'ok')}>{issues.length ? issues.length + ' unresolved' : 'All clear'}</span></div>
            <div className="sub small">Problems found before anything is exported.</div>
            <div className="mt" style={{ maxHeight: 330, overflow: 'auto' }}>
              {!issues.length && <div className="small muted">Nothing to fix. Later, use the Edit step to change any value by hand.</div>}
              {issues.map((i) => (
                <div key={i.id} className="issue">
                  <div className="row"><b style={{ fontSize: 12 }} className="muted">ROW #{i.row} · {i.who.toUpperCase()}</b><div className="sp" />
                    <span className={'chip ' + (i.severity === 'high' ? 'maroon' : 'warn')}>{i.severity === 'high' ? 'Needs action' : i.kind === 'duplicate' ? 'Review' : 'Suggestion'}</span></div>
                  <div style={{ margin: '6px 0' }}>{i.message}</div>
                  {i.kind === 'time_format' && (i.suggest ? (
                    <div className="row"><button className="btn sm primary" onClick={() => apply(i, i.suggest)}>Apply '{i.suggest}'</button>
                      <button className="btn sm ghost" onClick={() => ignore(i)}>Ignore</button></div>
                  ) : (
                    <div className="row"><input className="input" placeholder="HH:MM:SS" value={manual[i.id] || ''} onChange={(e) => setManual({ ...manual, [i.id]: e.target.value })} />
                      <button className="btn sm primary" onClick={() => { const v = normalizeTime(manual[i.id]); v ? apply(i, v) : alert('Enter a time like 08:15:00') }}>Apply</button></div>
                  ))}
                  {i.kind === 'choice' && (
                    <div className="row">
                      <select className="select" style={{ minWidth: 120 }} value={manual[i.id] ?? (i.suggest ?? '')} onChange={(e) => setManual({ ...manual, [i.id]: e.target.value })}>
                        <option value="" disabled={!!i.suggest}>{i.suggest ? '(clear the cell)' : 'Choose…'}</option>
                        {i.options.filter(Boolean).map((o) => <option key={o} value={o}>{o}</option>)}</select>
                      <button className="btn sm primary" onClick={() => apply(i, manual[i.id] ?? (i.suggest ?? ''))}>Apply</button>
                      <button className="btn sm ghost" onClick={() => apply(i, '')}>Clear</button>
                      <button className="btn sm ghost" onClick={() => ignore(i)}>Keep</button></div>
                  )}
                  {i.kind === 'duplicate' && (
                    <div className="row"><button className="btn sm ghost" onClick={() => ignore(i)}>Keep both</button>
                      <button className="btn sm outline" onClick={() => { hideRow(S, set, rowOf(i)); ignore(i) }}>Hide this row</button></div>
                  )}
                </div>))}
            </div>
          </div>
          <div className="card mt">
            <div className="row"><Columns3 size={18} /><h3 style={{ margin: 0 }}>Source column mapping</h3><div className="sp" /><span className="chip ok">Matched</span></div>
            {mapping.filter(([, l]) => l).map(([n, l]) => (
              <div key={n} className="issue row" style={{ marginTop: 8, marginBottom: 0 }}>
                <div><b>{l === d.status_cols[0] ? `Days 1–${d.days.length}` : hd(l)}</b><div className="small muted">{n}</div></div><div className="sp" /><CheckCircle2 size={18} color="var(--ok)" /></div>))}
          </div>
        </div>
      </div>
      <div className="footbar">
        <AlertTriangle size={20} color={issues.length ? 'var(--maroon)' : 'var(--ok)'} />
        <div><b>{issues.length ? `${issues.length} issue(s) identified` : 'No issues identified'}</b>
          <div className="small muted">{safe.length} have a suggested fix · every manual change is logged</div></div>
        <div className="sp" />
        <button className="btn ghost" onClick={() => go(1)}><ArrowLeft size={16} /> Back to Upload</button>
        <button className="btn primary" onClick={() => go(3)}>Proceed to Select Scope <ArrowRight size={16} /></button>
      </div>
    </>
  )
}
