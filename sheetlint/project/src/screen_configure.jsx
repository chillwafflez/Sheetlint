// Configure screen: pick worksheet + detectors

function ConfigureScreen({ fileName, onCancel, onRun }) {
  const initialSelected = MOCK.WORKSHEETS.filter(w => !w.hidden && w.id === "submissions").map(w => w.id);
  const [selectedSheets, setSelectedSheets] = useState(initialSelected);
  const [detectors, setDetectors] = useState({
    structural: true,
    statistical: true,
    duplicates: true,
    timeseries: true,
    ai: false,
    crossref: false,
  });
  const [includeHidden, setIncludeHidden] = useState(false);

  function toggleSheet(id) {
    setSelectedSheets((prev) =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }
  function toggleDetector(id) {
    setDetectors((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  const activeCount = Object.values(detectors).filter(Boolean).length;
  const sheetCount = selectedSheets.length;
  const canRun = sheetCount > 0 && activeCount > 0;

  return (
    <div className="screen">
      <div className="config-head">
        <div>
          <div style={{ fontSize: 12, color: "var(--ink-3)", marginBottom: 8, letterSpacing: "0.1em", textTransform: "uppercase" }}>Inspection setup</div>
          <h2>What should we look at?</h2>
          <div className="config-head__meta">
            <span className="file-pill">
              <Icon.Doc /> {fileName}
            </span>
          </div>
        </div>
        <button className="btn btn--ghost" onClick={onCancel}>
          <Icon.ArrowBack /> Upload another
        </button>
      </div>

      {/* ==== Worksheets ==== */}
      <div className="section-label">
        <div className="section-label__lead">
          <span className="section-label__num">STEP 01</span>
          <span className="section-label__title">Choose worksheets to inspect</span>
        </div>
        <div className="section-label__body">
          Pick the tabs you actually care about. Skipping non-tabular notes, lookup sheets, or archives makes the report far more readable.
        </div>
      </div>

      <div className="sheets">
        {MOCK.WORKSHEETS.filter(w => includeHidden || !w.hidden).map((w) => {
          const on = selectedSheets.includes(w.id);
          return (
            <button
              key={w.id}
              className={`sheet-card ${on ? "selected" : ""} ${w.hidden ? "hidden-sheet" : ""}`}
              onClick={() => toggleSheet(w.id)}
            >
              <div className="sheet-card__check">{on && <Icon.Check />}</div>
              <div className="sheet-card__head">
                <span className="sheet-card__name">{w.name}</span>
              </div>
              <div className="sheet-card__dims">{w.rows.toLocaleString()} rows · {w.cols} cols</div>
              <div className="sheet-card__hint">
                {w.hidden && <span className="chip"><Icon.EyeOff /> hidden</span>}
                {w.flags.map((f) => <span key={f} className="chip">{f}</span>)}
                {w.flags.length === 0 && !w.hidden && <span className="chip chip--ok"><Icon.Check /> looks clean</span>}
              </div>
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 40, fontSize: 12, color: "var(--ink-3)" }}>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
          <input type="checkbox" checked={includeHidden} onChange={(e) => setIncludeHidden(e.target.checked)} />
          Show hidden worksheets
        </label>
        <span>·</span>
        <button className="btn btn--ghost btn--sm" onClick={() => setSelectedSheets(MOCK.WORKSHEETS.filter(w => !w.hidden).map(w => w.id))}>Select all visible</button>
        <button className="btn btn--ghost btn--sm" onClick={() => setSelectedSheets([])}>Clear</button>
        {selectedSheets.length === 1 && (
          <span style={{ marginLeft: "auto", color: "var(--ink-3)" }}>
            Preview: first 5 rows of <span className="mono" style={{ color: "var(--ink)" }}>{MOCK.WORKSHEETS.find(w => w.id === selectedSheets[0])?.name}</span>
          </span>
        )}
      </div>

      {selectedSheets.length === 1 && (
        <div className="preview-strip" style={{ gridTemplateColumns: `40px repeat(${MOCK.PREVIEW_ROWS[0].length}, 1fr)`, marginBottom: 40 }}>
          <div className="cell head"></div>
          {MOCK.PREVIEW_ROWS[0].map((h, i) => <div key={i} className="cell head">{h}</div>)}
          {MOCK.PREVIEW_ROWS.slice(1).map((row, i) => (
            <React.Fragment key={i}>
              <div className="cell rownum">{i + 2}</div>
              {row.map((c, j) => <div key={j} className="cell" style={c === "N/A" ? { background: "var(--critical-soft)", color: "var(--critical)" } : {}}>{c}</div>)}
            </React.Fragment>
          ))}
        </div>
      )}

      {/* ==== Detectors ==== */}
      <div className="section-label">
        <div className="section-label__lead">
          <span className="section-label__num">STEP 02</span>
          <span className="section-label__title">Pick which detectors to run</span>
        </div>
        <div className="section-label__body">
          Each detector runs independently. Toggle off the ones you don't need — fewer detectors means a shorter, more focused report.
        </div>
      </div>

      <div className="detectors">
        {MOCK.DETECTOR_GROUPS.map((d) => {
          const on = !!detectors[d.id];
          const IconC = d.id === "structural" ? Icon.Grid
            : d.id === "statistical" ? Icon.Chart
            : d.id === "duplicates" ? Icon.List
            : d.id === "timeseries" ? Icon.Chart
            : d.id === "ai" ? Icon.Sparkle
            : Icon.Link;
          return (
            <button key={d.id} className={`detector ${on ? "on" : ""}`} onClick={() => toggleDetector(d.id)}>
              <div className="detector__head">
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <IconC style={{ color: on ? "var(--accent)" : "var(--ink-3)" }} />
                  <span className="detector__title">{d.title}</span>
                  {d.ai && <span className="chip chip--info" style={{ fontSize: 9, padding: "1px 6px" }}>AI</span>}
                </span>
                <span className="toggle" aria-hidden="true" />
              </div>
              <div className="detector__body">{d.body}</div>
              <div className="detector__checks">
                {d.checks.map((c) => <span key={c} className="mini-chip">{c}</span>)}
              </div>
            </button>
          );
        })}
      </div>

      {detectors.ai && (
        <div className="ai-callout">
          <Icon.Sparkle style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <strong>Claude semantic checks</strong> call the API once per unique column header (prompt-cached). Typical cost for this file: ~$0.02. Cached headers won't be re-billed.
          </div>
        </div>
      )}

      {/* ==== Footer ==== */}
      <div className="config-footer">
        <div className="config-footer__summary">
          Inspecting <strong>{sheetCount}</strong> worksheet{sheetCount === 1 ? "" : "s"} with <strong>{activeCount}</strong> detector{activeCount === 1 ? "" : "s"}.
          {" "}
          <span style={{ color: "var(--ink-3)" }}>Est. 8–14 s.</span>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn" onClick={onCancel}>Cancel</button>
          <button
            className={`btn btn--accent ${canRun ? "" : "btn--disabled"}`}
            disabled={!canRun}
            onClick={() => canRun && onRun({ sheets: selectedSheets, detectors })}
          >
            Run inspection <Icon.Arrow />
          </button>
        </div>
      </div>
    </div>
  );
}

window.ConfigureScreen = ConfigureScreen;
