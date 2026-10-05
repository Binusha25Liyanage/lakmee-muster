import { Users, ClipboardList, FileSpreadsheet, ImageIcon, ShieldCheck, Clock } from 'lucide-react'
import logoFull from '../../public/logo_full.png'
import { useNow } from '../hooks'

export default function About({ info }) {
  const now = useNow(1000)
  const date = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const time = now.toLocaleTimeString('en-GB')
  const feats = [
    [ClipboardList, 'Rep attendance', 'Turns the SFA RepAttendance export into cropped PNG images and a PDF, saved to three folders.'],
    [Users, 'Employee attendance', 'Reads the monthly staff sheet, the daily biometric export and the monthly Total Time Card.'],
    [FileSpreadsheet, 'Excel downloads', 'Daily transaction sheet, and one workbook with a sheet for every week of the month.'],
    [ImageIcon, 'Edit before export', 'Correct times, statuses and names first. Your original Excel file is never changed.'],
    [ShieldCheck, 'Independent modules', 'Rep and employee modules are separate files and can be updated on their own.'],
    [Clock, 'Real-time', 'Uses this computer\'s clock and calendar for dates, greetings and defaults.'],
  ]
  return (
    <>
      <div className="card row" style={{ gap: 24, flexWrap: 'wrap' }}>
        <img src={logoFull} alt="Lakmee Holdings" style={{ height: 130 }} />
        <div style={{ flex: 1, minWidth: 260 }}>
          <div className="eyebrow">About the application</div>
          <div className="page-title">Lakmee Muster</div>
          <p className="sub">Attendance Management System for Lakmee Holdings. It brings rep and employee attendance into one desktop app: import an Excel export, check and correct it, then download clean images, PDFs or Excel sheets.</p>
          <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
            <span className="chip dark">Version {info?.version}</span>
            <span className="chip">{date}</span><span className="chip mono">{time}</span>
          </div>
        </div>
      </div>
      <div className="grid g3 mt">
        {feats.map(([Icon, t, s]) => (
          <div key={t} className="card"><div className="chip maroon" style={{ marginBottom: 8 }}><Icon size={16} /></div><h3>{t}</h3><div className="sub small">{s}</div></div>))}
      </div>
      <div className="card mt" style={{ borderColor: 'var(--maroon)' }}>
        <div className="eyebrow">Created by</div>
        <div className="page-title" style={{ fontSize: 24 }}>IT Department, Lakmee Holdings</div>
        <div className="sub small">Designed and built in-house for Lakmee Holdings PLC.</div>
        <div className="small muted mt">Modules: {(info?.modules || []).map((m) => `${m.name} v${m.version}`).join(' · ')}</div>
      </div>
    </>
  )
}
