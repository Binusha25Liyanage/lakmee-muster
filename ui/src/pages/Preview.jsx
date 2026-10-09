import { useEffect, useState } from 'react'
import { FolderOpen, ZoomIn, ZoomOut, ArrowLeft, Pencil, Save, CheckCircle2, ImageIcon, FileText, FileSpreadsheet } from 'lucide-react'
import { api } from '../api'
import { usePreview, dirname } from '../hooks'
import { computeRows, editCount, scopeName, outputExtras, isXlsx } from '../store'
import { Stepper, Modal, Toggle } from '../ui.jsx'
import { Preview2 } from './Configure.jsx'

export default function Preview({ S, set, go, step, maxStep, notify, nav }) {
  const [tab, setTab] = useState(0)
  const [zoom, setZoom] = useState(100)
  const [done, setDone] = useState(null)
  const [dbSaved, setDbSaved] = useState(null)
  const [busyExp, setBusyExp] = useState(false)
  const { res, busy } = usePreview(S, { dpi_preview: 200 })
  const out = S.out
  const setOut = (p) => set({ out: { ...out, ...p } })
  const base = dirname(S.file?.path)
  const xl = isXlsx(S)

  useEffect(() => {  // first run: default all three folders to the Excel file's folder
    const p = {}
    ;['img1', 'img2', 'pdf', 'xlsx'].forEach((k) => { if (!out[k]) p[k] = base })
    if (xl) { p.png = false; p.pdfOn = false }
    if (Object.keys(p).length) setOut(p)
  }, [])

  const browse = async (k) => { const f = await api.pick_folder(out[k]); if (f) setOut({ [k]: f }) }
  const two = res?.ok && res.images.length > 1
  const example = (out.naming || '').replace('{Module}', S.data.module === 'rep' ? 'Rep' : 'Employee').replace('{Scope}', scopeName(S))
    .replace('{Date}', (S.data.date || '').replace(/-/g, ''))

  async function generate() {
    if (!xl && !out.png && !out.pdfOn) return notify('Tick at least one of PNG or PDF.', true)
    setBusyExp(true)
    const r = await api.export({
      rows: computeRows(S), columns: S.cfg.columns, mode: S.cfg.mode, sort: S.cfg.sort, template: S.cfg.template,
      title: S.cfg.title, date_format: S.cfg.dateFormat, ...outputExtras(S),
      folders: { img1: out.img1 || base, img2: out.img2 || out.img1 || base, pdf: out.pdf || base, xlsx: out.xlsx || base },
      dpi: out.dpi, want_png: out.png, want_pdf: out.pdfOn, naming: out.naming,
      scope: scopeName(S), edits: editCount(S),
    })
    setBusyExp(false)
    if (!r.ok) return notify(r.error, true)
    setDone(r.files); setDbSaved(r.db)
  }
  const openAll = () => [...new Set([out.xlsx, out.img1, out.img2, out.pdf])].forEach((f) => f && api.open_folder(f))

  const Row = ({ k, label, tag, icon }) => (
    <>
      <label className="lab" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{icon} {label}<span className="sp" /><span className="small muted" style={{ fontWeight: 400 }}>{tag}</span></label>
      <div className="row"><input className="input" value={out[k]} onChange={(e) => setOut({ [k]: e.target.value })} />
        <button className="btn ghost" onClick={() => browse(k)}><FolderOpen size={15} /> Browse…</button></div>
    </>
  )

  return (
    <>
      <Stepper step={step} go={go} maxStep={maxStep} />
      <div className="row" style={{ marginBottom: 12 }}>
        <div><div className="eyebrow">Step 6</div><div className="page-title">Preview & Save</div></div><div className="sp" />
        <button className="btn outline" onClick={() => go(5)}><Pencil size={15} /> Edit data</button>
        <button className="btn ghost" onClick={() => go(4)}><ArrowLeft size={15} /> Back to layout</button>
      </div>
      <div className="grid" style={{ gridTemplateColumns: '1.7fr 1fr', alignItems: 'start' }}>
        <div className="card">
          <div className="row" style={{ marginBottom: 8 }}>
            <button className="btn sm ghost" onClick={() => setZoom(Math.max(30, zoom - (zoom > 100 ? 50 : 10)))}><ZoomOut size={15} /></button><b>{zoom}%</b>
            <button className="btn sm ghost" onClick={() => setZoom(Math.min(500, zoom + (zoom >= 100 ? 50 : 10)))}><ZoomIn size={15} /></button>
            <button className="btn sm ghost" onClick={() => setZoom(100)}>Fit</button>
            <div className="sp" />{editCount(S) > 0 && <span className="chip maroon">Contains {editCount(S)} edit(s)</span>}</div>
          <Preview2 res={res} busy={busy} tab={tab} setTab={setTab} maxW={zoom + '%'} xlsx={xl} />
        </div>
        <div>
          <div className="card">
            <div className="row"><h3 style={{ margin: 0 }}>Save locations</h3><div className="sp" /><span className="chip dark">Independent paths</span></div>
            <div className="sub small">Choose a separate folder for each output.</div>
            {xl && <Row k="xlsx" icon={<FileSpreadsheet size={15} />} label="Excel folder" tag="XLSX" />}
            {(!xl || out.png) && <Row k="img1" icon={<ImageIcon size={15} />} label={two || S.cfg.mode === 'split' ? 'Image 1 folder (not logged out)' : 'Image folder'} tag="PNG" />}
            {S.cfg.mode === 'split' && <Row k="img2" icon={<ImageIcon size={15} />} label="Image 2 folder (logged out)" tag="PNG" />}
            {(!xl || out.pdfOn) && <Row k="pdf" icon={<FileText size={15} />} label="PDF folder" tag="PDF" />}
          </div>
          <div className="card mt">
            <h3>Packaging</h3>
            {xl && <div className="row mt"><Toggle on={true} onChange={() => {}} /><div><b>Excel file (.xlsx)</b><div className="small muted">{S.cfg.mode === 'xlsx_month' ? '1 workbook, one sheet per employee' : S.data.kind === 'timecard' ? '1 workbook, one sheet per week' : '1 sheet, same layout as the example'}</div></div></div>}
            <div className="row mt"><Toggle on={out.png} onChange={(v) => setOut({ png: v })} /><div><b>{xl ? 'Also save PNG images' : 'PNG images'}</b><div className="small muted">{two ? res.images.length : 1} file(s), cropped to the table</div></div></div>
            <div className="row mt"><Toggle on={out.pdfOn} onChange={(v) => setOut({ pdfOn: v })} /><div><b>{xl ? 'Also save a PDF' : 'PDF'}</b><div className="small muted">1 file, one page per image</div></div></div>
            <label className="lab">IMAGE QUALITY</label>
            <div className="grid g2">{[[300, '300 DPI', 'Crisp, print ready'], [150, '150 DPI', 'Smaller, quick to share']].map(([v, t, s]) => (
              <div key={v} className={'radio-row ' + (out.dpi === v ? 'sel' : '')} onClick={() => setOut({ dpi: v })}><input type="radio" readOnly checked={out.dpi === v} /><div><b>{t}</b><div className="small muted">{s}</div></div></div>))}</div>
            <label className="lab">FILE NAME PATTERN ({'{Module} {Scope} {Date}'})</label>
            <input className="input" value={out.naming} onChange={(e) => setOut({ naming: e.target.value })} />
            <div className="small muted mono" style={{ marginTop: 5 }}>e.g. {example}.pdf</div>
          </div>
          <button className="btn primary mt" style={{ width: '100%', justifyContent: 'center', padding: 13, fontSize: 15 }} disabled={busyExp || !res?.ok} onClick={generate}>
            <Save size={17} /> {busyExp ? 'Saving…' : 'Generate & Save All Files'}</button>
          <button className="btn ghost mt" style={{ width: '100%', justifyContent: 'center' }} onClick={openAll}><FolderOpen size={16} /> Open target folders</button>
        </div>
      </div>
      {done && (
        <Modal title="Export successful" onClose={() => setDone(null)} width={560}>
          <div className="row"><CheckCircle2 color="var(--ok)" size={22} /><b>{done.length} file(s) saved</b></div>
          {dbSaved && <div className="small muted mt">Also saved to the attendance database: {dbSaved.employees + dbSaved.reps} record(s).</div>}
          <div className="mt" style={{ maxHeight: 220, overflow: 'auto' }}>{done.map((f) => <div key={f} className="issue small mono" style={{ userSelect: 'text', marginBottom: 6, wordBreak: 'break-all' }}>{f}</div>)}</div>
          <div className="row mt"><button className="btn primary" onClick={openAll}><FolderOpen size={15} /> View files in Explorer</button>
            <button className="btn ghost" onClick={() => { setDone(null); nav('history') }}>Open history</button></div>
        </Modal>)}
    </>
  )
}
