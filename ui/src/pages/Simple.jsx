import { Users, FileText, CalendarDays, Fingerprint, LayoutGrid, Palette, Upload } from 'lucide-react'
import logoFull from '../../public/logo_full.png'

const Soon = ({ icon, eyebrow, title, text, items }) => (
  <>
    <div className="card"><div className="eyebrow">{eyebrow}</div><div className="page-title">{title}</div><p className="sub">{text}</p></div>
    <div className="grid g3 mt">{items.map(([I, t, s]) => (
      <div key={t} className="card"><div className="chip maroon" style={{ padding: 10 }}><I size={22} /></div><h3 style={{ marginTop: 10 }}>{t}</h3><div className="sub small">{s}</div></div>))}</div>
  </>
)

export const Employee = () => (
  <Soon eyebrow="Coming in the next update" title="Employee Attendance"
    text="This module will read the monthly staff sheet and the daily biometric export, then produce employee-wise and all-employee attendance with the same edit-before-export step."
    items={[[CalendarDays, 'Monthly sheet', 'P, Ab, L, H, Half-day and Visit codes, plus arrival times, in a calendar grid.'],
      [Fingerprint, 'Biometric export', 'First check-in per employee per day, duplicate punches merged, late arrivals flagged.'],
      [Users, 'Employee-wise & all employees', 'Pick one or many people, or the whole roster, and export the same way as reps.']]} />
)

export const Templates = () => (
  <Soon eyebrow="Coming in the next update" title="Output Templates"
    text="You can already choose between two built-in looks on the Configure step: Classic Grid (the original image) and Lakmee Maroon Broadcast. The editor and template upload arrive next."
    items={[[LayoutGrid, 'Template editor', 'Title, columns, widths, alignment, row height, borders and colours with a live preview.'],
      [Upload, 'Upload a template', 'Load a template file so the output layout can change without touching the code.'],
      [Palette, 'Save your own looks', 'Keep several templates and choose a default for each module.']]} />
)

export const Help = ({ info }) => (
  <>
    <div className="card row" style={{ gap: 20 }}><img src={logoFull} alt="Lakmee Holdings" style={{ height: 120 }} />
      <div><div className="eyebrow">About</div><div className="page-title">Lakmee Muster</div>
        <p className="sub">Attendance Management System for Lakmee Holdings. Version {info?.version}.</p></div></div>
    <div className="grid g2 mt">
      <div className="card"><h3>How to make the rep images</h3>
        {['Import Data: choose the SFA rep attendance Excel file.', 'Review & Fix: check flagged rows.', 'Select Scope: all reps, or pick territories.',
          'Configure: choose columns, rows to show, sort, template and title.', 'Edit: double-click cells to correct times or names.', 'Preview & Save: pick three folders and click Generate.']
          .map((t, i) => <div key={i} className="issue small" style={{ marginTop: 8 }}><b>{i + 1}.</b> {t}</div>)}</div>
      <div className="card"><h3>Shortcuts</h3>
        {[['Ctrl + K', 'Go to any screen'], ['Ctrl + Z / Ctrl + Y', 'Undo / redo an edit'], ['Double-click', 'Edit a cell'], ['Enter / Esc', 'Save / cancel a cell edit'], ['Right-click a row', 'Hide or reset the row']]
          .map(([k, t]) => <div key={k} className="row small" style={{ marginTop: 10 }}><span className="chip dark mono">{k}</span><span>{t}</span></div>)}
        <div className="small muted mt">Your Excel file is never changed. Edits only affect the exported images and PDF.</div></div>
    </div>
  </>
)
