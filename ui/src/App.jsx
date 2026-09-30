import { useEffect, useMemo, useState } from 'react'
import {
  LayoutDashboard, CloudUpload, ClipboardList, Users, FileText, History as HistoryIcon, SlidersHorizontal,
  HelpCircle, ChevronsLeft, ChevronsRight, Search, Settings as Cog, UserRound, Minus, Square, X,
} from 'lucide-react'
import { api } from './api'
import { initialSession } from './store'
import { Modal } from './ui.jsx'
import logoH from '../public/logo_horizontal.png'
import logoMark from '../public/logo_mark.png'
import Dashboard from './pages/Dashboard.jsx'
import Import from './pages/Import.jsx'
import Review from './pages/Review.jsx'
import Scope from './pages/Scope.jsx'
import Configure from './pages/Configure.jsx'
import Edit from './pages/Edit.jsx'
import Preview from './pages/Preview.jsx'
import History from './pages/History.jsx'
import Settings from './pages/Settings.jsx'
import { Employee, Templates, Help } from './pages/Simple.jsx'

const NAV = [
  ['dashboard', 'Dashboard', LayoutDashboard], ['import', 'Import Data', CloudUpload],
  ['rep', 'Rep Attendance', ClipboardList], ['employee', 'Employee Attendance', Users],
  ['templates', 'Output Templates', FileText], ['history', 'Export History', HistoryIcon],
  ['settings', 'Settings', SlidersHorizontal], ['help', 'Help & About', HelpCircle],
]

export default function App() {
  const [S, setS] = useState(initialSession())
  const set = (patch) => setS((p) => ({ ...p, ...(typeof patch === 'function' ? patch(p) : patch) }))
  const [page, setPage] = useState('dashboard')
  const [step, setStep] = useState(1)
  const [maxStep, setMaxStep] = useState(1)
  const [collapsed, setCollapsed] = useState(false)
  const [info, setInfo] = useState(null)
  const [toast, setToast] = useState(null)
  const [cmd, setCmd] = useState(false)
  const [maxed, setMaxed] = useState(false)

  const notify = (msg, err = false, action) => {
    setToast({ msg, err, action })
    clearTimeout(window.__t); window.__t = setTimeout(() => setToast(null), err ? 9000 : 6000)
  }
  const go = (n) => { setPage('wizard'); setStep(n); setMaxStep((m) => Math.max(m, n)) }
  const nav = (id) => {
    if (id === 'import') return go(step <= 3 ? step : 1)
    if (id === 'rep') return S.data ? go(step >= 4 ? step : 4) : go(1)
    setPage(id)
  }
  const ctx = { S, set, step, go, nav, notify, info, maxStep, setMaxStep, reload: async () => setInfo(await api.app_info()) }

  useEffect(() => {
    api.app_info().then(setInfo)
    api.settings().then((s) => set((p) => ({ out: { ...p.out, img1: s.img1_folder, img2: s.img2_folder, pdf: s.pdf_folder,
      dpi: s.dpi, naming: s.naming }, cfg: { ...p.cfg, dateFormat: s.date_format } })))
    const key = (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setCmd(true) } }
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key)
  }, [])

  const active = page === 'wizard' ? (step <= 3 ? 'import' : 'rep') : page
  const version = info?.version || '1.0.0'

  const body = useMemo(() => {
    if (page === 'dashboard') return <Dashboard {...ctx} />
    if (page === 'employee') return <Employee {...ctx} />
    if (page === 'templates') return <Templates {...ctx} />
    if (page === 'history') return <History {...ctx} />
    if (page === 'settings') return <Settings {...ctx} />
    if (page === 'help') return <Help {...ctx} />
    return [null, Import, Review, Scope, Configure, Edit, Preview].map((C, i) => (i === step && C ? <C key={i} {...ctx} /> : null))
  }, [page, step, S, info, maxStep])

  return (
    <div className="app">
      <div className="titlebar pywebview-drag-region">
        <div className="badge"><img src={logoMark} alt="" /></div>
        <div className="ttl">Lakmee Muster — Attendance Management System</div>
        <div className="ver">v{version}</div>
        <div className="drag pywebview-drag-region" />
        <div className="tb-search" onClick={() => setCmd(true)} style={{ cursor: 'pointer' }}>
          <Search size={15} /> Search commands… <kbd>Ctrl+K</kbd>
        </div>
        <button className="tb-btn" title="Help" onClick={() => setPage('help')}><HelpCircle size={18} /></button>
        <button className="tb-btn" title="Settings" onClick={() => setPage('settings')}><Cog size={18} /></button>
        <div className="tb-avatar"><UserRound size={18} /></div>
        <button className="tb-btn" title="Minimize" onClick={() => api.win_minimize()}><Minus size={18} /></button>
        <button className="tb-btn" title="Maximize" onClick={async () => setMaxed(await api.win_toggle_maximize())}><Square size={14} /></button>
        <button className="tb-btn close" title="Close" onClick={() => api.win_close()}><X size={19} /></button>
      </div>
      <div className="body">
        <div className={'nav ' + (collapsed ? 'collapsed' : '')}>
          <div className="logo"><img src={logoH} alt="Lakmee Holdings" /></div>
          {NAV.map(([id, label, Icon]) => (
            <button key={id} className={'nav-item ' + (active === id ? 'active' : '')} onClick={() => nav(id)} title={label}>
              <Icon size={19} /><span>{label}</span>
            </button>
          ))}
          <div className="nav-foot">
            <button className="nav-item" onClick={() => setCollapsed(!collapsed)} style={{ padding: '8px 6px' }}>
              {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}<span>Collapse Menu</span>
            </button>
            <div className="row txt"><span>Lakmee Muster v{version}</span><span className="dot" /><span>Ready</span></div>
          </div>
        </div>
        <div className="main">{body}</div>
      </div>
      {toast && (
        <div className={'toast ' + (toast.err ? 'err' : '')}>
          <div style={{ fontWeight: 700, marginBottom: 2 }}>{toast.err ? 'Something went wrong' : 'Done'}</div>
          <div className="small muted" style={{ userSelect: 'text' }}>{toast.msg}</div>
          <div className="row mt">
            {toast.action && <button className="btn sm primary" onClick={() => { toast.action.run(); setToast(null) }}>{toast.action.label}</button>}
            <button className="btn sm ghost" onClick={() => setToast(null)}>Dismiss</button>
          </div>
        </div>
      )}
      {cmd && <CommandBox onClose={() => setCmd(false)} run={(id) => { setCmd(false); nav(id) }} />}
    </div>
  )
}

function CommandBox({ onClose, run }) {
  const [q, setQ] = useState('')
  const list = NAV.filter(([, l]) => l.toLowerCase().includes(q.toLowerCase()))
  return (
    <Modal title="Go to…" onClose={onClose}>
      <input className="input" autoFocus placeholder="Type a screen name…" value={q} onChange={(e) => setQ(e.target.value)}
             onKeyDown={(e) => e.key === 'Enter' && list[0] && run(list[0][0])} />
      <div className="mt">{list.map(([id, l, Icon]) => (
        <button key={id} className="btn ghost" style={{ width: '100%', marginBottom: 6, justifyContent: 'flex-start' }} onClick={() => run(id)}>
          <Icon size={17} /> {l}
        </button>))}</div>
    </Modal>
  )
}
