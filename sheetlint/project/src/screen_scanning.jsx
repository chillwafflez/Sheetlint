// Scanning screen: fake progress with streaming log

function ScanningScreen({ fileName, config, onDone }) {
  const [progress, setProgress] = useState(0);
  const [lines, setLines] = useState([]);

  const logSteps = useMemo(() => {
    const out = [];
    out.push(["parse", "parse workbook — 6 sheets detected"]);
    if (config.sheets.includes("submissions")) {
      out.push(["sheet", "reading Submissions (4,200 × 18)"]);
    }
    if (config.detectors.structural) {
      out.push(["struct", "scanning merged cells…"]);
      out.push(["struct", "⚠ merged region C20:C22 inside data"]);
      out.push(["struct", "checking for multi-row headers"]);
      out.push(["struct", "formula error sweep… 0 #REF!, 0 #DIV/0!"]);
    }
    if (config.detectors.statistical) {
      out.push(["stats", "profiling 18 columns…"]);
      out.push(["stats", "premium_amount: 91.2% float, 13 off-type"]);
      out.push(["stats", "state: regex coverage 97.1% (34 misses)"]);
      out.push(["stats", "claim_amount: 18 outliers beyond 4σ"]);
    }
    if (config.detectors.duplicates) {
      out.push(["dup", "hashing rows…"]);
      out.push(["dup", "2 exact duplicate rows"]);
      out.push(["dup", "fuzzy pass on policy_id (edit distance ≤ 1)"]);
      out.push(["dup", "6 near-duplicate clusters"]);
    }
    if (config.detectors.timeseries) {
      out.push(["ts", "matrix-profile on claim_count × submitted_on"]);
      out.push(["ts", "3 discords detected"]);
      out.push(["ts", "z-score pass on monthly_revenue… 14 spikes"]);
    }
    if (config.detectors.ai) {
      out.push(["ai", "claude prompt-cache: 14/18 column headers hit"]);
      out.push(["ai", "reviewing agent_email column…"]);
      out.push(["ai", "⚠ header 'notes' doesn't match content"]);
    }
    out.push(["score", "scoring… DATA TRUST = 0 / 100 (Grade F)"]);
    out.push(["done", "finalizing report…"]);
    return out;
  }, [config]);

  useEffect(() => {
    let cancelled = false;
    const total = logSteps.length;
    (async () => {
      for (let i = 0; i < total; i++) {
        await new Promise(r => setTimeout(r, 260 + Math.random() * 140));
        if (cancelled) return;
        const [tag, msg] = logSteps[i];
        const ts = new Date().toISOString().slice(11, 19);
        setLines((p) => [...p, { ts, tag, msg }]);
        setProgress(((i + 1) / total) * 100);
      }
      await new Promise(r => setTimeout(r, 400));
      if (!cancelled) onDone();
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line
  }, []);

  const scrollRef = useRef(null);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [lines]);

  return (
    <div className="screen screen--narrow">
      <div className="scanning">
        <div className="spinner" />
        <h2>Inspecting <span className="mono" style={{ fontSize: 22 }}>{fileName}</span></h2>
        <div className="scanning__sub">Running {Object.values(config.detectors).filter(Boolean).length} detector(s) across {config.sheets.length} sheet(s).</div>

        <div className="scan-progress">
          <div className="scan-progress__bar" style={{ width: `${progress}%` }} />
        </div>

        <div className="scan-list" ref={scrollRef}>
          {lines.slice(-12).map((l, i) => (
            <div className="scan-line" key={i + lines.length}>
              <span className="scan-line__ts">{l.ts}</span>
              <span className="scan-line__tag">[{l.tag}]</span>
              <span className="scan-line__msg">{l.msg}</span>
            </div>
          ))}
          {lines.length === 0 && (
            <div className="scan-line">
              <span className="scan-line__ts bounce">──────</span>
              <span className="scan-line__tag bounce">[init]</span>
              <span className="scan-line__msg bounce">warming detectors…</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

window.ScanningScreen = ScanningScreen;
