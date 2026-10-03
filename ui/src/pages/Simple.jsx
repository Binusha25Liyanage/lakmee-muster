import logoFull from '../../public/logo_full.png'

export const Help = ({ info }) => (
  <>
    <div className="card row" style={{ gap: 20 }}><img src={logoFull} alt="Lakmee Holdings" style={{ height: 120 }} />
      <div><div className="eyebrow">About</div><div className="page-title">Lakmee Muster</div>
        <p className="sub">Attendance Management System for Lakmee Holdings. Version {info?.version}.</p></div></div>
    <div className="grid g2 mt">
      <div className="card"><h3>How to make the images</h3>
        {['Import Data: choose the rep attendance file, the monthly staff sheet or the biometric export.', 'Review & Fix: check flagged rows and unknown codes.',
          'Select Scope: everyone, or pick reps / employees.', 'Configure: choose columns, rows to show, sort, template and title.',
          'Edit: double-click cells to correct times, statuses or names.', 'Preview & Save: pick the folders and click Generate.']
          .map((t, i) => <div key={i} className="issue small" style={{ marginTop: 8 }}><b>{i + 1}.</b> {t}</div>)}</div>
      <div className="card"><h3>Shortcuts</h3>
        {[['Ctrl + K', 'Go to any screen'], ['Ctrl + Z / Ctrl + Y', 'Undo / redo an edit'], ['Double-click', 'Edit a cell'], ['Enter / Esc', 'Save / cancel a cell edit'], ['Right-click a row', 'Hide or reset the row']]
          .map(([k, t]) => <div key={k} className="row small" style={{ marginTop: 10 }}><span className="chip dark mono">{k}</span><span>{t}</span></div>)}
        <div className="small muted mt">Your Excel file is never changed. Edits only affect the exported images and PDF.</div></div>
    </div>
  </>
)
