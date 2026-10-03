import { useState } from 'react'
import { FolderOpen, FileSpreadsheet, ArrowRight, ShieldCheck, Upload, Smartphone, CalendarDays, Fingerprint, Info } from 'lucide-react'
import { api } from '../api'
import { initialSession, freshConfig } from '../store'
import { Stepper, fmtSize } from '../ui.jsx'

export default function Import({ S, set, go, step, maxStep, notify }) {
  const [over, setOver] = useState(false)
  const [busy, setBusy] = useState(false)

  async function load(path, sheet) {
    if (!path) return
    setBusy(true)
    const r = await api.load_source(path, sheet)
    setBusy(false)
    if (!r.ok) return notify(r.error, true)
    const s = await api.settings()
    const tdef = s['default_template_' + r.data.module]
    set((p) => ({ ...initialSession(), out: p.out, data: r.data, file: r.file, module: r.module,
      cfg: freshConfig(r.data, p.cfg, tdef), scope: { kind: 'all', selected: [] } }))
  }
  const browse = async () => load(await api.pick_file())
  function drop(e) {
    e.preventDefault(); setOver(false)
    const f = e.dataTransfer.files[0]
    if (!f) return
    if (f.pywebviewFullPath) load(f.pywebviewFullPath)
    else notify('Drag & drop is not available here, use "Browse Local Drive".', true)
  }
  const d = S.data
  const hd = (l) => d.columns.find((c) => c.label === l)?.header || l
  const pcols = d ? d.preview_cols.filter((l) => d.columns.some((c) => c.label === l)) : []
  const prow = d ? d.records.filter((r) => !r._skip).slice(0, 5) : []

  return (
    <>
      <Stepper step={step} go={go} maxStep={maxStep} />
      <div className="card">
        <div className="eyebrow">Batch ingestion</div>
        <div className="page-title">Import Attendance Data Source</div>
        <p className="sub">Drop a rep attendance export, the monthly staff sheet or the biometric export. Muster detects the format, checks every row and prepares it for editing and export. Your source file is never modified.</p>
      </div>
      <div className="grid mt" style={{ gridTemplateColumns: '1fr 1.25fr', alignItems: 'start' }}>
        <div>
          <div className={'dropzone ' + (over ? 'over' : '')} style={{ minHeight: 330 }}
               onDragOver={(e) => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)} onDrop={drop}>
            <div>
              <div className="empty" style={{ padding: 0 }}><div className="ic" style={{ width: 78, height: 78 }}><Upload size={34} /></div></div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{busy ? 'Reading file…' : 'Drag & drop attendance sheets here'}</div>
              <div className="muted" style={{ margin: '6px 0 16px' }}>Accepts .xlsx and .xlsm files</div>
              <button className="btn primary" onClick={browse} disabled={busy}><FolderOpen size={17} /> Browse Local Drive</button>
            </div>
          </div>
          <div className="card mt">
            <div className="small muted" style={{ fontWeight: 700, letterSpacing: '.06em' }}>SUPPORTED FILE TYPES</div>
            <div className="issue row mt"><Smartphone size={20} /><div><b>SFA Rep Attendance</b><div className="small muted">Territory, logged in / logged out times</div></div><div className="sp" /><span className="chip ok">Supported</span></div>
            <div className="issue row"><CalendarDays size={20} /><div><b>Monthly Employee Sheet</b><div className="small muted">P, Ab, L, H, Half-day, Visit + arrival times</div></div><div className="sp" /><span className="chip ok">Supported</span></div>
            <div className="issue row"><Fingerprint size={20} /><div><b>Biometric Transaction Export</b><div className="small muted">Employee ID, time, punch state</div></div><div className="sp" /><span className="chip ok">Supported</span></div>
          </div>
        </div>
        <div>
          {!d ? (
            <div className="card empty" style={{ minHeight: 330 }}><div className="ic"><FileSpreadsheet size={28} /></div>
              <b style={{ color: 'var(--text)' }}>No file loaded</b><div>Choose an Excel file to see the detected format, checks and a preview here.</div></div>
          ) : (
            <>
              <div className="card">
                <div className="row"><div className="chip maroon" style={{ padding: 12 }}><FileSpreadsheet size={26} /></div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 17, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis' }}>{S.file.name}</div>
                    <div className="small muted">{fmtSize(S.file.size)} · read in {S.file.ms} ms</div>
                  </div></div>
                <div className="row mt" style={{ flexWrap: 'wrap' }}><span className="chip ok"><ShieldCheck size={14} /> {d.kind_label} detected</span>
                  <span className="chip">{d.module === 'employee' && d.kind === 'monthly' ? 'Month' : 'Report date'}: {d.date_label}</span>
                  {d.sheets.length > 1 && (
                    <span className="row" style={{ gap: 6 }}><span className="small muted">Worksheet</span>
                      <select className="select" style={{ width: 'auto', padding: '4px 8px' }} value={d.sheet} onChange={(e) => load(S.file.path, e.target.value)}>
                        {d.sheets.map((n) => <option key={n}>{n}</option>)}</select></span>)}
                </div>
              </div>
              <div className="card mt" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="row" style={{ background: 'var(--ash)', color: 'var(--cream)', padding: '12px 16px', fontWeight: 700 }}>
                  Automated validation<div className="sp" /><span className="chip ok">Parser ready</span></div>
                <div className="grid g4" style={{ padding: 14 }}>
                  {d.stat_cards.map((c) => <div key={c.l} className="card kpi"><div className="l">{c.l}</div><div className="v" style={{ fontSize: 26 }}>{c.v}</div><div className="s">{c.s}</div></div>)}
                </div>
                {(d.notes.length > 0 || d.auto_fixed > 0) && (
                  <div style={{ padding: '0 14px 10px' }}>
                    {d.auto_fixed > 0 && <div className="issue small row" style={{ marginBottom: 6 }}><Info size={16} color="var(--maroon)" /> {d.auto_fixed} value(s) fixed using your saved name corrections.</div>}
                    {d.notes.map((n, i) => <div key={i} className="issue small row" style={{ marginBottom: 6 }}><Info size={16} color="var(--maroon)" /><span>{n}</span></div>)}
                  </div>)}
                <div className="small muted" style={{ padding: '0 16px 6px', fontWeight: 700 }}>PREVIEW — FIRST 5 ROWS</div>
                <div className="tbl-wrap" style={{ margin: '0 14px 14px' }}>
                  <table className="t"><thead><tr>{pcols.map((l) => <th key={l}>{hd(l)}</th>)}</tr></thead>
                    <tbody>{prow.map((r, i) => <tr key={i}>{pcols.map((l) => <td key={l}>{r[l] || '-'}</td>)}</tr>)}</tbody></table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      <div className="footbar">
        <ShieldCheck size={20} color="var(--maroon)" />
        <div className="small"><b>Source file stays untouched.</b> <span className="muted" style={{ userSelect: 'text' }}>{S.file?.path || 'All edits are stored separately and applied only to the exported images and PDF.'}</span></div>
        <div className="sp" />
        <button className="btn ghost" onClick={browse}>Choose Another File</button>
        <button className="btn primary" disabled={!d} onClick={() => go(2)}>Continue to Review & Fix <ArrowRight size={16} /></button>
      </div>
    </>
  )
}
