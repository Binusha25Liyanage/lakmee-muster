import { useEffect, useState } from 'react'
import { FileUp, ClipboardList, Users, FolderOpen, FileImage, FileText, CheckCircle2 } from 'lucide-react'
import { api } from '../api'
import { Empty } from '../ui.jsx'

export default function Dashboard({ S, go, nav, info, notify }) {
  const [hist, setHist] = useState([])
  useEffect(() => { api.history().then((h) => setHist(h.slice(0, 4))) }, [])
    const h = new Date().getHours()
  const greet = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  
  return (
    <>
      <div className="card row" style={{ padding: '20px 24px', flexWrap: 'wrap', gap: 14 }}>
        <div>
          <div className="page-title" style={{ fontSize: 28 }}>{greet} — Lakmee Holdings</div>
          <div className="sub">{today}{S.file ? ` · Loaded: ${S.file.name}` : ' · No file imported yet'}</div>
        </div>
        <div className="sp" />
        <button className="btn primary" onClick={() => go(1)}><FileUp size={17} /> Import Excel</button>
        <button className="btn ghost" onClick={() => (S.data?.module === 'rep' ? go(4) : go(1))}><ClipboardList size={17} /> Generate Rep Report</button>
        <button className="btn ghost" onClick={() => (S.data?.module === 'employee' ? go(4) : nav('employee'))}><Users size={17} /> Generate Employee Report</button>
      </div>

      <div className="grid g4 mt">
        {(S.data ? S.data.stat_cards : [['Reps logged in'], ['Reps not logged out'], ['Employees'], ['Late arrivals']].map(([l]) => ({ l, v: '—', s: 'import a file to see this' })))
          .map((c) => <div key={c.l} className="card kpi"><div className="l">{c.l}</div><div className="v">{c.v}</div><div className="s">{c.s}</div></div>)}
      </div>

      <div className="grid mt" style={{ gridTemplateColumns: '1.4fr 1fr' }}>
        <div className="card">
          <div className="row"><h3>Recent exports</h3><div className="sp" /><button className="btn sm ghost" onClick={() => nav('history')}>View all in history →</button></div>
          {!hist.length ? (
            <Empty icon={<FileImage size={28} />} title="No exports yet">Your generated images and PDFs will be listed here after the first export.</Empty>
          ) : hist.map((e) => (
            <div key={e.id} className="issue row" style={{ marginTop: 10 }}>
              <div className="chip maroon"><FileImage size={14} /></div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis' }}>{(e.files[0] || '').split(/[\\/]/).pop()}</div>
                <div className="small muted">{e.module} · {e.time} · {e.files.length} file(s){e.edited ? ` · ${e.edited} edits` : ''}</div>
              </div>
              <div className="sp" />
              <button className="btn sm ghost" onClick={() => api.reveal_file(e.files[0])}><FolderOpen size={14} /> Reveal</button>
            </div>
          ))}
        </div>
        <div className="card">
          <h3>Modules</h3>
          <div className="sub small">Each module is an independent file and can be updated on its own.</div>
          {(info?.modules || []).map((m) => (
            <div key={m.id} className="issue row" style={{ marginTop: 10 }}>
              <div style={{ fontWeight: 700 }}>{m.name}</div><div className="sp" />
              <span className="small muted">v{m.version}</span>
              <span className={'chip ' + (m.error ? 'maroon' : 'ok')}>{m.error ? 'Error' : 'Active'}</span>
            </div>
          ))}
          <div className="small muted mt" style={{ userSelect: 'text' }}>Data folder: {info?.data_dir}</div>
        </div>
      </div>
      {S.data && (
        <div className="card mt row"><CheckCircle2 size={20} color="var(--ok)" />
          <div><b>{S.file.name}</b> is ready. Continue where you left off.</div><div className="sp" />
          <button className="btn primary" onClick={() => go(4)}>Continue to layout</button>
        </div>
      )}
    </>
  )
}
