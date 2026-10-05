import { useEffect, useState } from 'react'
import { FolderOpen, Save, Trash2, Plus } from 'lucide-react'
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
    set((p) => ({ out: { ...p.out, xlsx: r.xlsx_folder, img1: r.img1_folder, img2: r.img2_folder, pdf: r.pdf_folder, dpi: r.dpi, naming: r.naming }, cfg: { ...p.cfg, dateFormat: r.date_format } }))
    notify('Settings saved.')
  }
  const F = ({ k, label }) => (<><label className="lab">{label}</label><div className="row"><input className="input" value={s[k]} onChange={(e) => up({ [k]: e.target.value })} />
    <button className="btn ghost" onClick={() => browse(k)}><FolderOpen size={15} /> Browse…</button></div></>)
  return (
    <>
      <div className="page-title">Settings</div>
      <div className="tabs mt">{[['general', 'General'], ['rules', 'Attendance rules'], ['roster', 'Employee roster'], ['modules', 'Modules'], ['data', 'Data']].map(([id, t]) =>
        <button key={id} className={'tab ' + (tab === id ? 'on' : '')} onClick={() => setTab(id)}>{t}</button>)}</div>
      <div className="card" style={{ maxWidth: 820 }}>
        {tab === 'general' && (<>
          <h3>Default save locations</h3><div className="sub small">Used as the starting folders on the export screen.</div>
          <F k="xlsx_folder" label="EXCEL FOLDER" /><F k="img1_folder" label="IMAGE 1 FOLDER" /><F k="img2_folder" label="IMAGE 2 FOLDER" /><F k="pdf_folder" label="PDF FOLDER" />
          <div className="grid g2"><div><label className="lab">DEFAULT IMAGE QUALITY</label>
            <select className="select" value={s.dpi} onChange={(e) => up({ dpi: +e.target.value })}><option value={300}>300 DPI</option><option value={150}>150 DPI</option></select></div>
            <div><label className="lab">DATE FORMAT</label><select className="select" value={s.date_format} onChange={(e) => up({ date_format: e.target.value })}>
              {['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD', 'DD-MMM-YYYY'].map((f) => <option key={f}>{f}</option>)}</select></div></div>
          <label className="lab">FILE NAME PATTERN</label><input className="input" value={s.naming} onChange={(e) => up({ naming: e.target.value })} /></>)}
        {tab === 'rules' && (<><h3>Attendance rules</h3><div className="sub small">Used by the employee module to count and list late arrivals.</div>
          <label className="lab">LATE ARRIVAL AFTER (HH:MM)</label><input className="input" style={{ maxWidth: 160 }} value={s.late_after} onChange={(e) => up({ late_after: e.target.value })} />
          <div className="small muted mt">Applies to employee files the next time you import one.</div></>)}
        {tab === 'roster' && <Roster notify={notify} />}
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

function Roster({ notify }) {
  const [list, setList] = useState([])
  const [n, setN] = useState({ id: '', name: '', dept: '' })
  useEffect(() => { api.roster().then(setList) }, [])
  const on = list.filter((p) => !p.excluded).length
  return (
    <>
      <h3>Employee roster</h3>
      <div className="sub small">Everyone the app has seen in an employee file. In the daily Excel sheet, roster employees who did not punch are listed with "-". Untick someone who has left, or add a new joiner.</div>
      <div className="small muted mt">{on} of {list.length} employees are listed in the daily sheet.</div>
      <div className="tbl-wrap mt" style={{ maxHeight: 300 }}>
        <table className="t"><thead><tr><th style={{ width: 70 }}>In sheet</th><th>ID</th><th>Name</th><th>Department</th><th /></tr></thead>
          <tbody>{list.map((p) => (
            <tr key={p.id}><td><input type="checkbox" checked={!p.excluded} onChange={async (e) => setList(await api.roster_exclude(p.id, !e.target.checked))} /></td>
              <td>{p.id}</td><td><b>{p.name}</b></td><td>{p.dept}</td>
              <td><button className="btn sm ghost" title="Remove from the roster" onClick={async () => setList(await api.roster_delete(p.id))}><Trash2 size={14} /></button></td></tr>))}
            {!list.length && <tr><td colSpan={5} className="muted">Nothing yet. Import an employee file and the roster fills itself.</td></tr>}</tbody></table>
      </div>
      <div className="row mt" style={{ alignItems: 'end' }}>
        <div style={{ width: 90 }}><label className="lab">ID</label><input className="input" value={n.id} onChange={(e) => setN({ ...n, id: e.target.value })} /></div>
        <div style={{ flex: 1 }}><label className="lab">FIRST NAME</label><input className="input" value={n.name} onChange={(e) => setN({ ...n, name: e.target.value })} /></div>
        <div style={{ flex: 1 }}><label className="lab">DEPARTMENT</label><input className="input" value={n.dept} onChange={(e) => setN({ ...n, dept: e.target.value })} /></div>
        <button className="btn outline" disabled={!n.id.trim() || !n.name.trim()} onClick={async () => { setList(await api.roster_add(n.id, n.name, n.dept)); setN({ id: '', name: '', dept: '' }); notify('Added to the roster.') }}><Plus size={15} /> Add</button>
      </div>
    </>
  )
}
