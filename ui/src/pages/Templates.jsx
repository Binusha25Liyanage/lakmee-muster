import { useEffect, useRef, useState } from 'react'
import { Upload, Plus, Pencil, Copy, Download, Trash2, Star, Save, FileSpreadsheet } from 'lucide-react'
import { api } from '../api'
import { Toggle } from '../ui.jsx'

const NUM = [['font_size', 'Font size', 6, 24, 0.5], ['row_height', 'Row height', 12, 60, 1], ['cell_pad', 'Cell padding', 2, 30, 1],
  ['border_width', 'Border width', 0.2, 4, 0.1], ['min_col', 'Min column width', 14, 200, 1], ['max_chars', 'Max characters per cell', 8, 120, 1]]
const COLORS = [['title_fill', 'Title background'], ['title_text', 'Title text'], ['header_fill', 'Header background'], ['header_text', 'Header text'],
  ['body_fill', 'Row background'], ['body_text', 'Row text'], ['zebra_fill', 'Alternate row'], ['border_color', 'Border']]

function Thumb({ tpl }) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    let dead = false
    const t = setTimeout(async () => { const r = await api.template_sample(tpl); if (!dead && r.ok) setUrl(r.data_url) }, 200)
    return () => { dead = true; clearTimeout(t) }
  }, [JSON.stringify(tpl)])
  return <div className="preview-stage" style={{ padding: 10, minHeight: 90 }}>{url && <img src={url} alt="" style={{ maxWidth: '100%' }} />}</div>
}

export default function Templates({ notify }) {
  const [list, setList] = useState([])
  const [st, setSt] = useState({})
  const [edit, setEdit] = useState(null)
  const [xl, setXl] = useState([])
  const edRef = useRef(null)
  useEffect(() => { if (edit && edRef.current) edRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' }) }, [edit && edit.id, edit && edit.name])
  const load = async () => { setList(await api.templates()); setSt(await api.settings()) }
  useEffect(() => { load(); api.xlsx_templates().then(setXl) }, [])
  const uploadXl = async () => {
    const f = await api.pick_other('xlsx'); if (!f) return
    const r = await api.import_xlsx_template(f)
    if (!r.ok) return notify(r.error, true)
    setXl(r.templates); notify(`Excel layout "${r.template}" learned (${r.kind === 'grid' ? 'weekly grid' : 'list'}).` + (r.notes.length ? ' ' + r.notes.join(' ') : ''))
  }
  const renameXl = async (t) => { const n = prompt('Name for this Excel layout', t.name); if (n) setXl(await api.rename_xlsx_template(t.id, n)) }
  const delXl = async (t) => { if (confirm(`Delete the Excel layout "${t.name}"?`)) setXl(await api.delete_xlsx_template(t.id)) }
  const defOf = (m) => st['default_template_' + m]
  const BUILTIN_DEF = { rep: 'classic-grid', employee: 'emp-summary' }
  const defFor = (t) => ['rep', 'employee'].filter((m) => (t.module === 'any' || t.module === m) && (defOf(m) || BUILTIN_DEF[m]) === t.id)

  const setDefault = async (t) => {
    const mods = t.module === 'any' ? ['rep', 'employee'] : [t.module]
    const patch = {}; mods.forEach((m) => { patch['default_template_' + m] = t.id })
    setSt(await api.save_settings(patch)); notify(`"${t.name}" is now the default for ${mods.join(' and ')} reports.`)
  }
  const upload = async () => {
    const f = await api.pick_other('json'); if (!f) return
    const r = await api.import_template(f)
    if (!r.ok) return notify(r.error, true)
    setList(r.templates); notify(`Imported ${r.count} template(s).`)
  }
  const exportT = async (t) => {
    const folder = await api.pick_folder(''); if (!folder) return
    const r = await api.export_template(t.id, folder)
    r.ok ? notify('Saved: ' + r.path) : notify(r.error, true)
  }
  const del = async (t) => { if (confirm(`Delete "${t.name}"?`)) setList(await api.delete_template(t.id)) }
  const dup = (t) => setEdit({ ...t, id: '', name: t.name + ' (copy)', builtin: false })
  const save = async (asNew) => {
    const t = await api.save_template({ ...edit, id: asNew || edit.builtin ? '' : edit.id })
    setEdit(t); await load(); notify('Template saved.')
  }
  const up = (p) => setEdit({ ...edit, ...p })

  return (
    <>
      <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div><div className="eyebrow">Schema engine</div><div className="page-title">Output Templates & Image Layouts</div>
          <p className="sub">A template controls how the table image looks: title, colours, fonts, spacing and borders. Upload a template file to change the output structure without touching any code.</p></div>
        <div className="sp" />
        <button className="btn outline" onClick={uploadXl}><FileSpreadsheet size={16} /> Upload Excel structure (.xlsx)</button>
        <button className="btn ghost" onClick={upload}><Upload size={16} /> Upload template (.json)</button>
        <button className="btn primary" onClick={() => setEdit({ ...list[0], id: '', name: 'New template', builtin: false })}><Plus size={16} /> Create new template</button>
      </div>

      <div className="card mt">
        <div className="row"><FileSpreadsheet size={18} /><h3 style={{ margin: 0 }}>Excel output layouts</h3><div className="sp" />
          <button className="btn sm primary" onClick={uploadXl}><Upload size={14} /> Upload Excel structure</button></div>
        <div className="sub small">Upload an example Excel file of the output you want (for example your daily sheet or one weekly sheet). The app learns the title rows, column names and order, colours, widths and day groups, then writes new outputs in that structure. Pick it in the Configure step.</div>
        {!xl.length ? <div className="small muted mt">No uploaded layouts yet. The built-in layouts copy your Transaction and Attendance example sheets.</div> : xl.map((t) => (
          <div key={t.id} className="issue row mt" style={{ flexWrap: 'wrap' }}>
            <span className="chip maroon">{t.kind === 'grid' ? 'Weekly grid' : 'Daily list'}</span>
            <div style={{ flex: 1, minWidth: 220 }}><b>{t.name}</b><div className="small muted">{t.summary}</div>{t.notes.map((n) => <div key={n} className="small" style={{ color: 'var(--maroon)' }}>{n}</div>)}</div>
            <button className="btn sm ghost" onClick={() => renameXl(t)}><Pencil size={14} /></button>
            <button className="btn sm ghost" onClick={() => delXl(t)}><Trash2 size={14} /></button></div>))}
      </div>

      <div className="grid g3 mt">
        {list.map((t) => (
          <div key={t.id} className="card">
            <div className="row"><span className="chip maroon">{t.module === 'any' ? 'Rep + Employee' : t.module === 'rep' ? 'Rep' : 'Employee'}</span>
              {defFor(t).map((m) => <span key={m} className="chip dark">Default · {m === 'rep' ? 'Rep' : 'Employee'}</span>)}{t.builtin && <span className="chip">Built-in</span>}</div>
            <h3 style={{ marginTop: 8 }}>{t.name}</h3>
            <Thumb tpl={t} />
            <div className="row mt" style={{ flexWrap: 'wrap', gap: 6 }}>
              <button className="btn sm ghost" onClick={() => setEdit(t)}><Pencil size={14} /> {t.builtin ? 'View / copy' : 'Edit'}</button>
              <button className="btn sm ghost" onClick={() => dup(t)}><Copy size={14} /></button>
              <button className="btn sm ghost" onClick={() => exportT(t)}><Download size={14} /></button>
              <button className="btn sm ghost" title="Use as default" onClick={() => setDefault(t)}><Star size={14} /></button>
              {!t.builtin && <button className="btn sm ghost" onClick={() => del(t)}><Trash2 size={14} /></button>}
            </div>
          </div>))}
      </div>

      {edit && (
        <div className="card mt2" ref={edRef}>
          <div className="row"><h3 style={{ margin: 0 }}>Template editor</h3>
            {edit.builtin && <span className="chip warn">Built-in: save as a new copy to change it</span>}<div className="sp" />
            {!edit.builtin && edit.id && <button className="btn primary" onClick={() => save(false)}><Save size={15} /> Save template</button>}
            <button className={'btn ' + (edit.builtin || !edit.id ? 'primary' : 'ghost')} onClick={() => save(true)}><Save size={15} /> Save as new</button>
            <button className="btn ghost" onClick={() => setEdit(null)}>Close</button></div>
          <div className="grid mt" style={{ gridTemplateColumns: '1fr 1.1fr', alignItems: 'start' }}>
            <div>
              <div className="grid g2">
                <div><label className="lab">TEMPLATE NAME</label><input className="input" value={edit.name} onChange={(e) => up({ name: e.target.value })} /></div>
                <div><label className="lab">USED FOR</label><select className="select" value={edit.module} onChange={(e) => up({ module: e.target.value })}>
                  <option value="any">Rep + Employee</option><option value="rep">Rep reports</option><option value="employee">Employee reports</option></select></div>
              </div>
              <label className="lab">TITLE ({'{date}'} = report date, {'{month}'} = month name)</label>
              <input className="input" value={edit.title} onChange={(e) => up({ title: e.target.value })} />
              <label className="lab">COLOURS</label>
              <div className="grid g2">{COLORS.map(([k, n]) => (
                <div key={k} className="row"><input type="color" value={edit[k]} onChange={(e) => up({ [k]: e.target.value })} style={{ width: 38, height: 32, border: 0, background: 'none' }} />
                  <span className="small">{n}</span><span className="small muted mono">{edit[k]}</span></div>))}</div>
              <label className="lab">SIZES</label>
              <div className="grid g3">{NUM.map(([k, n, mn, mx, stp]) => (
                <div key={k}><div className="small muted">{n}</div><input className="input" type="number" min={mn} max={mx} step={stp} value={edit[k]} onChange={(e) => up({ [k]: +e.target.value })} /></div>))}</div>
              <div className="grid g3">
                <div><label className="lab">FIRST COLUMN</label><select className="select" value={edit.align_first} onChange={(e) => up({ align_first: e.target.value })}><option value="left">Left</option><option value="center">Centre</option></select></div>
                <div><label className="lab">OTHER COLUMNS</label><select className="select" value={edit.align_rest} onChange={(e) => up({ align_rest: e.target.value })}><option value="center">Centre</option><option value="left">Left</option></select></div>
                <div><label className="lab">EMPTY CELL TEXT</label><input className="input" value={edit.null_text} onChange={(e) => up({ null_text: e.target.value })} /></div>
              </div>
              <div className="row mt"><Toggle on={edit.zebra} onChange={(v) => up({ zebra: v })} /><span>Alternate row colours</span></div>
              <div className="row mt"><Toggle on={edit.status_colors} onChange={(v) => up({ status_colors: v })} /><span>Colour status cells (P, L, H, Ab, HD, V)</span></div>
            </div>
            <div><label className="lab" style={{ marginTop: 0 }}>LIVE PREVIEW (sample data)</label><Thumb tpl={edit} /></div>
          </div>
        </div>
      )}
    </>
  )
}
