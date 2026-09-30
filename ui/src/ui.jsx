import { Check } from 'lucide-react'

export const STEPS = ['Upload', 'Review & Fix', 'Select Scope', 'Configure', 'Edit', 'Preview & Export']

export function Stepper({ step, go, maxStep }) {
  return (
    <div className="stepper">
      {STEPS.map((s, i) => {
        const n = i + 1
        const cls = n < step ? 'done' : n === step ? 'cur' : ''
        const clickable = n <= maxStep && n !== step
        return (
          <div key={s} style={{ display: 'contents' }}>
            <div className={'step ' + cls} style={{ cursor: clickable ? 'pointer' : 'default' }}
                 onClick={() => clickable && go(n)}>
              <span className="c">{n < step ? <Check size={15} /> : n}</span>{String(n).padStart(2, '0')}. {s}
            </div>
            {i < STEPS.length - 1 && <div className={'step-line ' + (n < step ? 'done' : '')} />}
          </div>
        )
      })}
    </div>
  )
}

export function Modal({ title, children, onClose, width }) {
  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={width ? { width } : null}>
        <div className="row" style={{ marginBottom: 8 }}>
          <h3 style={{ margin: 0, fontSize: 18 }}>{title}</h3><div className="sp" />
          <button className="btn sm ghost" onClick={onClose}>Close</button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Empty({ icon, title, children }) {
  return (
    <div className="empty">
      <div className="ic">{icon}</div>
      <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{title}</div>
      <div style={{ maxWidth: 420 }}>{children}</div>
    </div>
  )
}

export function Toggle({ on, onChange }) {
  return <button className={'switch ' + (on ? 'on' : '')} onClick={() => onChange(!on)} aria-pressed={on} />
}

export const fmtSize = (b) => (b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB')
