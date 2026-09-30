import { useEffect, useState } from 'react'
import { Search, FolderOpen, Trash2, History as H } from 'lucide-react'
import { api } from '../api'
import { Empty } from '../ui.jsx'

export default function History() {
  const [rows, setRows] = useState([])
  const [q, setQ] = useState('')
  useEffect(() => { api.history().then(setRows) }, [])
  const shown = rows.filter((r) => !q || JSON.stringify(r).toLowerCase().includes(q.toLowerCase()))
  return (
    <>
      <div className="row"><div><div className="eyebrow">Audit trail</div><div className="page-title">Export History</div>
        <p className="sub">Every export is recorded here with its source file, template and number of manual edits.</p></div></div>
      <div className="card mt">
        <div className="row" style={{ position: 'relative', maxWidth: 340, marginBottom: 12 }}><Search size={15} style={{ position: 'absolute', left: 10, color: 'var(--muted)' }} />
          <input className="input" style={{ paddingLeft: 32 }} placeholder="Search history…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        {!shown.length ? <Empty icon={<H size={28} />} title="Nothing here yet">Exports you make will appear in this list.</Empty> : (
          <div className="tbl-wrap"><table className="t"><thead><tr><th>Date & time</th><th>Module</th><th>Scope</th><th>Source</th><th>Template</th><th>Files</th><th /></tr></thead>
            <tbody>{shown.map((r) => (
              <tr key={r.id}><td>{r.time}</td><td>{r.module}</td><td>{r.scope}</td><td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.source}</td><td>{r.template}</td>
                <td>{r.files.length} {r.edited > 0 && <span className="chip maroon">Edited ({r.edited})</span>}</td>
                <td><div className="row"><button className="btn sm ghost" onClick={() => api.reveal_file(r.files[0])}><FolderOpen size={14} /> Open</button>
                  <button className="btn sm ghost" onClick={async () => setRows(await api.delete_history(r.id))}><Trash2 size={14} /></button></div></td></tr>))}</tbody></table></div>)}
      </div>
    </>
  )
}
