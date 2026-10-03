import { useEffect, useState } from 'react'
import { FolderOpen, Save } from 'lucide-react'
import { api } from '../api'

export default function Settings({ S, set, info, notify, reload }) {
  const [tab, setTab] = useState('general')
  const [s, setSt] = useState(null)
  useEffect(() => { api.settings().then(setSt) }, [])
  if (!s) return null
  const up = (p) => setSt({ ...s, ...p })
  const browse = async (k) => { const f = await api.pick_folder(s[k]); if (f) up({ [k]: f }) }
  const save = async () => {
    const r = await api.save_settings(s)
    set((p) => ({ out: { ...p.out, img1: r.img1_folder, img2: r.img2_folder, pdf: r.pdf_folder, dpi: r.dpi, naming: r.naming }, cfg: { ...p.cfg, dateFormat: r.date_format } }))
    notify('Settings saved.')
  }
  const F = ({ k, label }) => (<><label className="lab">{label}</label><div className="row"><input className="input" value={s[k]} onChange={(e) => up({ [k]: e.target.value })} />
    <button className="btn ghost" onClick={() => browse(k)}><FolderOpen size={15} /> Browse…</button></div></>)
  return (
    <>
      <div className="page-title">Settings</div>
      <div className="tabs mt">{[['general', 'General'], ['rules', 'Attendance rules'], ['modules', 'Modules'], ['data', 'Data']].map(([id, t]) =>
        <button key={id} className={'tab ' + (tab === id ? 'on' : '')} onClick={() => setTab(id)}>{t}</button>)}</div>
      <div className="card" style={{ maxWidth: 820 }}>
        {tab === 'general' && (<>
          <h3>Default save locations</h3><div className="sub small">Used as the starting folders on the export screen.</div>
          <F k="img1_folder" label="IMAGE 1 FOLDER" /><F k="img2_folder" label="IMAGE 2 FOLDER" /><F k="pdf_folder" label="PDF FOLDER" />
          <div className="grid g2"><div><label className="lab">DEFAULT IMAGE QUALITY</label>
            <select className="select" value={s.dpi} onChange={(e) => up({ dpi: +e.target.value })}><option value={300}>300 DPI</option><option value={150}>150 DPI</option></select></div>
            <div><label className="lab">DATE FORMAT</label><select className="select" value={s.date_format} onChange={(e) => up({ date_format: e.target.value })}>
              {['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD', 'DD-MMM-YYYY'].map((f) => <option key={f}>{f}</option>)}</select></div></div>
          <label className="lab">FILE NAME PATTERN</label><input className="input" value={s.naming} onChange={(e) => up({ naming: e.target.value })} /></>)}
        {tab === 'rules' && (<><h3>Attendance rules</h3><div className="sub small">Used by the employee module to count and list late arrivals.</div>
          <label className="lab">LATE ARRIVAL AFTER (HH:MM)</label><input className="input" style={{ maxWidth: 160 }} value={s.late_after} onChange={(e) => up({ late_after: e.target.value })} />
          <div className="small muted mt">Applies to employee files the next time you import one.</div></>)}
        {tab === 'modules' && (<><h3>Modules</h3>
          <div className="sub small">Each module is a separate file in the <code>modules</code> folder, so one can be updated without touching the other. Only load module files from someone you trust — they run as code on this PC.</div>
          {(info?.modules || []).map((m) => (
            <div key={m.id} className="issue mt">
              <div className="row"><div><b>{m.name}</b><div className="small muted mono">{m.file}</div></div>
                <div className="sp" /><span className="small muted">v{m.version}</span><span className={'chip ' + (m.error ? 'maroon' : 'ok')}>{m.error ? 'Error' : 'Active'}</span></div>
              <div className="row mt">
                <button className="btn sm outline" onClick={async () => {
                  const f = await api.pick_other('py'); if (!f) return
                  const r = await api.update_module(m.id, f)
                  if (!r.ok) return notify(r.error, true)
                  await reload(); notify(`${m.name} updated. Your previous version was kept as a backup.`)
                }}>Update from file…</button>
                <button className="btn sm ghost" disabled={!m.has_backup} onClick={async () => {
                  const r = await api.restore_module(m.id)
                  if (!r.ok) return notify(r.error, true)
                  await reload(); notify(`${m.name} restored to the previous version.`)
                }}>Restore previous version</button>
              </div></div>))}</>)}
        {tab === 'data' && (<><h3>Your data</h3><div className="sub small">Settings, history, name corrections and templates are stored here and survive app updates.</div>
          <div className="issue mono small mt" style={{ userSelect: 'text' }}>{info?.data_dir}</div>
          <button className="btn ghost" onClick={() => api.open_folder(info?.data_dir)}><FolderOpen size={15} /> Open data folder</button></>)}
        {(tab === 'general' || tab === 'rules') && <button className="btn primary mt2" onClick={save}><Save size={16} /> Save settings</button>}
      </div>
    </>
  )
}
