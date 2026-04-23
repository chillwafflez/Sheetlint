// Upload screen

function UploadScreen({ onFileChosen }) {
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState("");
  const inputRef = useRef(null);

  function handleFile(name) {
    setFileName(name);
    setTimeout(() => onFileChosen(name), 250);
  }

  return (
    <div className="screen">
      <div className="upload-hero">
        <h1>Catch Excel issues <em>before</em><br/>they become pipeline failures.</h1>
        <p>Sheetlint is a pre-handoff quality inspector for messy, human-entered spreadsheets. Drop a file, pick what to check, get a signed-off report in seconds.</p>
      </div>

      <div
        className={`drop ${dragging ? "dragging" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f) handleFile(f.name);
          else handleFile("dropped_file.xlsx");
        }}
      >
        <div className="drop__icon" aria-hidden="true" />
        <div className="drop__title">
          {fileName ? <>Reading <span className="mono">{fileName}</span>…</> : "Drop an .xlsx or .xlsm file to inspect"}
        </div>
        <div className="drop__sub">Or click to browse. Max 50 MB. Files are scanned in-browser — nothing leaves your machine.</div>
        <div className="drop__actions">
          <button className="btn btn--primary" onClick={() => inputRef.current?.click()}>
            <Icon.Doc /> Choose file
          </button>
          <button className="btn" onClick={() => handleFile("broken_insurance_submissions.xlsx")}>
            Use sample file
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xlsm,.xls,.csv"
            className="sr"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f.name);
            }}
          />
        </div>
        <div className="drop__hint">Supports .xlsx · .xlsm · .xls · .csv — up to 50 sheets per workbook</div>
      </div>

      <div className="samples">
        {MOCK.SAMPLE_FILES.map((f) => (
          <button key={f.name} className="sample" onClick={() => handleFile(f.name)}>
            <span className="sample__name">{f.name}</span>
            <span className="sample__meta">{f.sheets} sheets · {f.rows} rows · {f.size}</span>
          </button>
        ))}
      </div>

      <div className="features">
        <div className="feature">
          <div className="feature__num">01 / STRUCTURAL</div>
          <div className="feature__title">Shape &amp; layout</div>
          <div className="feature__body">Merged cells, multi-row headers, formula errors, hidden sheets, empty columns, orphan cells outside the data region.</div>
        </div>
        <div className="feature">
          <div className="feature__num">02 / STATISTICAL</div>
          <div className="feature__title">Column profiling</div>
          <div className="feature__body">Type purity, null density, regex coverage for dates / emails / IDs, outliers, and cardinality anomalies.</div>
        </div>
        <div className="feature">
          <div className="feature__num">03 / DUPLICATES</div>
          <div className="feature__title">Exact &amp; fuzzy</div>
          <div className="feature__body">Catches near-miss IDs like <span className="mono">POL-01001</span> vs <span className="mono">POL-0100l</span> — the ones that silently corrupt joins.</div>
        </div>
        <div className="feature">
          <div className="feature__num">04 / TIME-SERIES</div>
          <div className="feature__title">Anomaly detection</div>
          <div className="feature__body">Rolling z-score spikes and STUMPY matrix-profile discords over any date × numeric column pair.</div>
        </div>
        <div className="feature">
          <div className="feature__num">05 / SEMANTIC</div>
          <div className="feature__title">Claude review</div>
          <div className="feature__body">Prompt-cached per-column review: does the header match the content? Flags context-dependent issues regex can't see.</div>
        </div>
      </div>
    </div>
  );
}

window.UploadScreen = UploadScreen;
