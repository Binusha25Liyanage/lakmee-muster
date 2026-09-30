import { useState } from 'react'
import { AlertTriangle, CheckCircle2, Wand2, ArrowLeft, ArrowRight, Search, Check, Columns3 } from 'lucide-react'
import { batchSet, hideRow, normalizeTime } from '../store'
import { Stepper, Empty } from '../ui.jsx'

export default function Review({ S, set, go, step, maxStep }) {
  const [showAll, setShowAll] = useState(false)
  const [q, setQ] = useState('')
  const [manual, setManual] = useState({})
  const d = S.data
  const issues = d.issues.filter((i) => !S.ignored.includes(i.id))
  const rowOf = (i) => ({ ...d.records[i.index], ...(S.edit.overrides[i.index] || {}), _i: i.index })
  const safe = issues.filter((i) => i.suggest)
  const flagged = new Set(issues.map((i) => i.index))
  const cols = [d.keys.terr, d.keys.in, d.keys.out]
  const rows = d.records.map((r, i) => ({ ...r, ...(S.edit.overrides[i] || {}), _i: i }))
    .filter((r) => (showAll || flagged.has(r._i)) && (!q || r[d.keys.terr].toLowerCase().includes(q.toLowerCase())))

  const apply = (i, value) => { batchSet(S, set, [{ row: rowOf(i), label: i.field, value }]); set((p) => ({ ignored: [...p.ignored, i.id] })) }
  const fixAll = () => {
    batchSet(S, set, safe.map((i) => ({ row: rowOf(i), label: i.field, value: i.suggest })))
    set((p) => ({ ignored: [...p.ignored, ...safe.map((i) => i.id)] }))
  }

  return (
    <>
      <Stepper step={step} go={go} maxStep={maxStep} />
      <div className="grid" style={{ gridTemplateColumns: '1.6fr 1fr', alignItems: 'start' }}>
        <div className="card" style={{ padding: 14 }}>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <div className="row" style={{ position: 'relative', flex: 1, minWidth: 220 }}>
              <Search size={15} style={{ position: 'absolute', left: 10, color: 'var(--muted)' }} />
              <input className="input" style={{ paddingLeft: 32 }} placeholder="Search territory…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <div className="row" style={{ background: 'var(--cream3)', borderRadius: 9, padding: 3 }}>
              <button className={'btn sm ' + (!showAll ? 'primary' : '')} onClick={() => setShowAll(false)}>Issues only ({flagged.size})</button>
              <button className={'btn sm ' + (showAll ? 'primary' : '')} onClick={() => setShowAll(true)}>Show all ({d.records.length})</button>
            </div>
            <button className="btn sm outline" disabled={!safe.length} onClick={fixAll}><Wand2 size={14} /> Auto-fix safe ({safe.length})</button>
          </div>
          <div className="tbl-wrap mt" style={{ maxHeight: 470 }}>
            {!rows.length ? (
              <Empty icon={<CheckCircle2 size={30} />} title="No problems found">
                All {d.records.length} rows have valid times and territories. You can still review every row with "Show all".
              </Empty>
            ) : (
              <table className="t"><thead><tr><th></th><th>Row</th><th>Territory</th><th className="ctr">Logged in</th><th className="ctr">Logged out</th></tr></thead>
                <tbody>{rows.map((r) => (
                  <tr key={r._i} className={flagged.has(r._i) ? 'flag' : ''}>
                    <td>{flagged.has(r._i) ? <AlertTriangle size={16} color="var(--maroon)" /> : <Check size={16} color="var(--ok)" />}</td>
                    <td className="muted">#{r._row}</td><td><b>{r[d.keys.terr]}</b></td>
                    <td className="ctr mono">{r[d.keys.in] || '-'}</td><td className="ctr mono">{r[d.keys.out] || '-'}</td>
                  </tr>))}</tbody></table>
            )}
          </div>
          <div className="small muted" style={{ marginTop: 8 }}>Showing {rows.length} of {d.records.length} records</div>
        </div>

        <div>
          <div className="card">
            <div className="row"><h3>Issues & suggestions</h3><div className="sp" /><span className={'chip ' + (issues.length ? 'maroon' : 'ok')}>{issues.length ? issues.length + ' unresolved' : 'All clear'}</span></div>
            <div className="sub small">Problems found in the times and territory names before anything is exported.</div>
            <div className="mt" style={{ maxHeight: 330, overflow: 'auto' }}>
              {!issues.length && <div className="small muted">Nothing to fix. Later, use the Edit step to change any value by hand.</div>}
              {issues.map((i) => (
                <div key={i.id} className="issue">
                  <div className="row"><b style={{ fontSize: 12 }} className="muted">ROW #{i.row} · {i.territory.toUpperCase()}</b><div className="sp" />
                    <span className={'chip ' + (i.severity === 'high' ? 'maroon' : 'warn')}>{i.severity === 'high' ? 'Needs action' : i.kind === 'duplicate' ? 'Review' : 'Formatting'}</span></div>
                  <div style={{ margin: '6px 0' }}>{i.message}</div>
                  {i.kind === 'time_format' && (i.suggest ? (
                    <div className="row"><button className="btn sm primary" onClick={() => apply(i, i.suggest)}>Apply '{i.suggest}'</button>
                      <button className="btn sm ghost" onClick={() => set((p) => ({ ignored: [...p.ignored, i.id] }))}>Ignore</button></div>
                  ) : (
                    <div className="row"><input className="input" placeholder="HH:MM:SS" value={manual[i.id] || ''} onChange={(e) => setManual({ ...manual, [i.id]: e.target.value })} />
                      <button className="btn sm primary" onClick={() => { const v = normalizeTime(manual[i.id]); v ? apply(i, v) : alert('Enter a time like 08:15:00') }}>Apply</button></div>
                  ))}
                  {i.kind === 'duplicate' && (
                    <div className="row"><button className="btn sm ghost" onClick={() => set((p) => ({ ignored: [...p.ignored, i.id] }))}>Keep both</button>
                      <button className="btn sm outline" onClick={() => { hideRow(S, set, rowOf(i)); set((p) => ({ ignored: [...p.ignored, i.id] })) }}>Hide this row</button></div>
                  )}
                </div>))}
            </div>
          </div>
          <div className="card mt">
            <div className="row"><Columns3 size={18} /><h3 style={{ margin: 0 }}>Source column mapping</h3><div className="sp" /><span className="chip ok">100% matched</span></div>
            {[['Territory', d.keys.terr], ['Login time', d.keys.in], ['Logout time', d.keys.out]].map(([n, l]) => (
              <div key={n} className="issue row" style={{ marginTop: 8, marginBottom: 0 }}>
                <div><b>{d.columns.find((c) => c.label === l).header}</b><div className="small muted">{n}</div></div><div className="sp" /><CheckCircle2 size={18} color="var(--ok)" /></div>))}
          </div>
        </div>
      </div>
      <div className="footbar">
        <AlertTriangle size={20} color={issues.length ? 'var(--maroon)' : 'var(--ok)'} />
        <div><b>{issues.length ? `${issues.length} issue(s) identified` : 'No issues identified'}</b>
          <div className="small muted">{safe.length} can be fixed automatically · every manual change is logged</div></div>
        <div className="sp" />
        <button className="btn ghost" onClick={() => go(1)}><ArrowLeft size={16} /> Back to Upload</button>
        <button className="btn primary" onClick={() => go(3)}>Proceed to Select Scope <ArrowRight size={16} /></button>
      </div>
    </>
  )
}
