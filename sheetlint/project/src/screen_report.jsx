// Report screen: Overview / Issues / Time-series

function ReportScreen({ fileName, config, onRestart }) {
  const [tab, setTab] = useState("overview");
  const issues = MOCK.ISSUES;
  const crit = issues.filter(i => i.sev === "critical").length;
  const warn = issues.filter(i => i.sev === "warn").length;
  const info = issues.filter(i => i.sev === "info").length;

  return (
    <div className="screen">
      <div className="report-head">
        <div className="report-head__left">
          <div style={{ fontSize: 12, color: "var(--ink-3)", marginBottom: 8, letterSpacing: "0.1em", textTransform: "uppercase" }}>Inspection report</div>
          <h2>{fileName}</h2>
          <div className="report-head__meta">
            <span><strong>{config.sheets.length}</strong> sheet{config.sheets.length === 1 ? "" : "s"}</span>
            <span><strong>{Object.values(config.detectors).filter(Boolean).length}</strong> detectors</span>
            <span><strong>4,200</strong> rows inspected</span>
            <span>scanned in <strong>11.4s</strong></span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn" onClick={onRestart}><Icon.ArrowBack /> New inspection</button>
          <button className="btn btn--primary"><Icon.Download /> Download CSV</button>
        </div>
      </div>

      <div className="tabs" role="tablist">
        <button className={`tab ${tab === "overview" ? "active" : ""}`} onClick={() => setTab("overview")}>
          <Icon.Grid /> Overview
        </button>
        <button className={`tab ${tab === "issues" ? "active" : ""}`} onClick={() => setTab("issues")}>
          <Icon.List /> Issues <span className="count">{issues.length}</span>
        </button>
        <button className={`tab ${tab === "timeseries" ? "active" : ""}`} onClick={() => setTab("timeseries")}>
          <Icon.Chart /> Time-series <span className="count">3</span>
        </button>
      </div>

      {tab === "overview" && <OverviewTab crit={crit} warn={warn} info={info} issues={issues} />}
      {tab === "issues" && <IssuesTab issues={issues} />}
      {tab === "timeseries" && <TimeSeriesTab />}
    </div>
  );
}

/* ==================== Overview ==================== */
function OverviewTab({ crit, warn, info, issues }) {
  const deductions = [
    { label: "Duplicates", pts: 41.1, color: "critical" },
    { label: "Structural", pts: 31.0, color: "critical" },
    { label: "Statistical", pts: 21.3, color: "warn" },
    { label: "Time-series", pts: 10.5, color: "warn" },
    { label: "AI semantic", pts: 5.0, color: "info" },
  ];
  const max = Math.max(...deductions.map(d => d.pts));

  return (
    <>
      <div className="overview-grid">
        <div className="score-card">
          <div>
            <div className="score-card__label">Data trust score</div>
            <div style={{ marginTop: 18 }} className="score-card__dial">
              <span className="score-card__num">0</span>
              <span style={{ fontSize: 28, color: "var(--ink-3)", fontFamily: "Instrument Serif, serif" }}>/100</span>
            </div>
            <div className="score-card__grade" style={{ marginTop: 8 }}>Grade F</div>
          </div>
          <div>
            <div className="score-bar-track">
              <div className="score-bar-fill score-bar-fill--critical" style={{ width: "2%" }} />
            </div>
            <div className="score-card__foot" style={{ marginTop: 10 }}>
              <span>▲ A 90+</span><span>B 75+</span><span>C 60+</span><span>D 40+</span><span>F &lt; 40</span>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateRows: "auto 1fr", gap: 10 }}>
          <div className="kpis">
            <div className="kpi">
              <div className="kpi__label"><span className="sev-dot sev-dot--critical" /> Critical</div>
              <div className="kpi__value">{crit}</div>
              <div className="kpi__delta">block ingestion</div>
            </div>
            <div className="kpi">
              <div className="kpi__label"><span className="sev-dot sev-dot--warn" /> Warnings</div>
              <div className="kpi__value">{warn}</div>
              <div className="kpi__delta">review recommended</div>
            </div>
            <div className="kpi">
              <div className="kpi__label"><span className="sev-dot sev-dot--info" /> Info</div>
              <div className="kpi__value">{info}</div>
              <div className="kpi__delta">heads-up only</div>
            </div>
          </div>
          <div className="deductions">
            <div className="deductions__title">
              <span>Points deducted by detector</span>
              <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)", fontWeight: 400 }}>/100</span>
            </div>
            {deductions.map((d) => (
              <div className="deduction-row" key={d.label}>
                <div className="deduction-row__label">{d.label}</div>
                <div className="deduction-row__bar" style={{ "--pct": `${(d.pts / max) * 100}%` }} />
                <div className="deduction-row__val">−{d.pts.toFixed(1)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Critical callouts */}
      <div className="section-label" style={{ marginTop: 32, marginBottom: 14 }}>
        <div className="section-label__lead">
          <span className="section-label__num">CRITICAL</span>
          <span className="section-label__title">{crit} issue{crit === 1 ? "" : "s"} will block clean ingestion</span>
        </div>
        <div className="section-label__body">Fix these before piping this file into anything downstream.</div>
      </div>

      <div className="callout-list">
        {issues.filter(i => i.sev === "critical").map((it, i) => (
          <div key={i} className="callout callout--critical">
            <div className="callout__sev">
              <SevBadge sev={it.sev} />
            </div>
            <div>
              <div className="callout__msg">
                {it.msg.split(/(`[^`]+`)/).map((p, j) => p.startsWith("`") ? <span key={j} className="mono">{p.slice(1, -1)}</span> : <span key={j}>{p}</span>)}
              </div>
              <div className="callout__fix">{it.fix}</div>
            </div>
            <div className="callout__meta">
              <div>{it.det}</div>
              <div>{it.sheet}</div>
              {it.col !== "—" && <div style={{ color: "var(--ink-3)" }}>{it.col}</div>}
              <div>rows {it.rows}</div>
            </div>
          </div>
        ))}
      </div>

      {/* A couple of notable warnings */}
      <div className="section-label" style={{ marginTop: 32, marginBottom: 14 }}>
        <div className="section-label__lead">
          <span className="section-label__num">NOTABLE</span>
          <span className="section-label__title">Warnings worth a second look</span>
        </div>
        <div className="section-label__body">Not blocking, but likely to cause downstream headaches if ignored.</div>
      </div>
      <div className="callout-list">
        {issues.filter(i => i.sev === "warn").slice(0, 3).map((it, i) => (
          <div key={i} className="callout callout--warn">
            <div className="callout__sev"><SevBadge sev={it.sev} /></div>
            <div>
              <div className="callout__msg">{it.msg}</div>
              <div className="callout__fix">{it.fix}</div>
            </div>
            <div className="callout__meta">
              <div>{it.det}</div>
              <div>{it.sheet}</div>
              {it.col !== "—" && <div style={{ color: "var(--ink-3)" }}>{it.col}</div>}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ==================== Issues tab ==================== */
function IssuesTab({ issues }) {
  const [q, setQ] = useState("");
  const [sev, setSev] = useState("all");
  const [det, setDet] = useState("all");
  const [sort, setSort] = useState({ key: "sev", dir: "asc" });
  const [open, setOpen] = useState(null);

  const sevRank = { critical: 0, warn: 1, info: 2 };

  const filtered = useMemo(() => {
    let rows = issues.filter(i =>
      (sev === "all" || i.sev === sev) &&
      (det === "all" || i.det === det) &&
      (q === "" || (i.msg + i.col + i.det + i.sheet).toLowerCase().includes(q.toLowerCase()))
    );
    rows = [...rows].sort((a, b) => {
      let av, bv;
      if (sort.key === "sev") { av = sevRank[a.sev]; bv = sevRank[b.sev]; }
      else { av = (a[sort.key] || "").toString(); bv = (b[sort.key] || "").toString(); }
      if (av < bv) return sort.dir === "asc" ? -1 : 1;
      if (av > bv) return sort.dir === "asc" ? 1 : -1;
      return 0;
    });
    return rows;
  }, [issues, q, sev, det, sort]);

  function th(key, label) {
    const active = sort.key === key;
    return (
      <th className={active ? "active" : ""} onClick={() => setSort(s => ({ key, dir: s.key === key && s.dir === "asc" ? "desc" : "asc" }))}>
        {label}{active && <span className="arrow">{sort.dir === "asc" ? "▲" : "▼"}</span>}
      </th>
    );
  }

  return (
    <>
      <div className="filters">
        <div className="search">
          <Icon.Search style={{ color: "var(--ink-3)" }} />
          <input placeholder="Search messages, detectors, columns…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="select-pill">
          <span style={{ color: "var(--ink-3)" }}>Severity</span>
          <select value={sev} onChange={(e) => setSev(e.target.value)}>
            <option value="all">all</option>
            <option value="critical">critical</option>
            <option value="warn">warning</option>
            <option value="info">info</option>
          </select>
        </div>
        <div className="select-pill">
          <span style={{ color: "var(--ink-3)" }}>Detector</span>
          <select value={det} onChange={(e) => setDet(e.target.value)}>
            <option value="all">all</option>
            <option>Structural</option>
            <option>Statistical</option>
            <option>Duplicates</option>
            <option>TimeSeries</option>
            <option>AI</option>
          </select>
        </div>
        <div className="filters__spacer" />
        <span className="filter-count">{filtered.length} of {issues.length}</span>
        <button className="btn btn--sm"><Icon.Download /> Download CSV</button>
      </div>

      <table className="issues-table">
        <thead>
          <tr>
            {th("sev", "Severity")}
            {th("det", "Detector")}
            {th("sheet", "Sheet")}
            {th("col", "Column")}
            {th("rows", "Rows")}
            <th style={{ cursor: "default" }}>Message</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((it, i) => (
            <React.Fragment key={i}>
              <tr className={open === i ? "open" : ""} onClick={() => setOpen(open === i ? null : i)}>
                <td><SevBadge sev={it.sev} /></td>
                <td className="col-det">{it.det}</td>
                <td className="col-sheet">{it.sheet}</td>
                <td className="col-col">{it.col}</td>
                <td className="col-col" style={{ textAlign: "right" }}>{it.rows}</td>
                <td className="col-msg">
                  {it.msg}
                  <small>Fix: {it.fix}</small>
                </td>
              </tr>
              {open === i && (
                <tr>
                  <td colSpan={6} style={{ padding: 0 }}>
                    <IssueDetail issue={it} />
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
          {filtered.length === 0 && (
            <tr><td colSpan={6}><div className="empty-state"><h3>No issues match those filters.</h3>Try clearing them.</div></td></tr>
          )}
        </tbody>
      </table>
    </>
  );
}

function IssueDetail({ issue }) {
  // Mini sheet preview — mark bad cells
  const headers = ["policy_id", "agent_email", "premium_amount", "state"];
  const rows = [
    ["POL-01049", "m.reid@brightaxis.co", "1,842.50", "NY"],
    ["POL-01050", "j.chen@brightaxis.co", "N/A", "NY"],
    ["POL-01051", "s.okafor@brightaxis.co", "N/A", "NJ"],
    ["POL-01052", "r.patel@brightaxis.co", "N/A", "NY"],
    ["POL-01053", "a.gomez@brightaxis.co", "N/A", "CT"],
    ["POL-01054", "m.lee@brightaxis.co", "1,988.00", "NY"],
  ];
  const markCol = issue.col === "premium_amount" ? 2 : issue.col === "agent_email" ? 1 : issue.col === "policy_id" ? 0 : -1;
  const badRows = new Set([1, 2, 3, 4]);

  return (
    <div className="issue-detail">
      <div className="detail-grid">
        <div>
          <h4>Where it is</h4>
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 12px", fontSize: 12 }}>
            <span style={{ color: "var(--ink-3)" }}>Detector</span><span>{issue.det}</span>
            <span style={{ color: "var(--ink-3)" }}>Sheet</span><span className="mono">{issue.sheet}</span>
            <span style={{ color: "var(--ink-3)" }}>Column</span><span className="mono">{issue.col}</span>
            <span style={{ color: "var(--ink-3)" }}>Rows</span><span className="mono">{issue.rows}</span>
          </div>
          <div className="mini-sheet" style={{ gridTemplateColumns: `40px repeat(${headers.length}, 1fr)` }}>
            <div className="c head"></div>
            {headers.map((h, i) => (
              <div key={i} className={`c head ${i === markCol ? "err" : ""}`}>{h}</div>
            ))}
            {rows.map((r, i) => (
              <React.Fragment key={i}>
                <div className="c rownum">{i + 49}</div>
                {r.map((c, j) => (
                  <div key={j} className={`c ${markCol === j && badRows.has(i) ? "err" : ""}`}>{c}</div>
                ))}
              </React.Fragment>
            ))}
          </div>
        </div>
        <div>
          <h4>Why this matters</h4>
          <p style={{ margin: "0 0 12px", fontSize: 13, lineHeight: 1.55, color: "var(--ink-2)" }}>{issue.fix}</p>
          <h4>Detection technique</h4>
          <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6, color: "var(--ink-3)" }}>
            {issue.det === "Statistical" && "Each column is type-profiled; any column whose dominant type exceeds 90% triggers a flag against the remaining off-type cells. 'N/A', blanks, and units-in-cell are the usual culprits."}
            {issue.det === "Structural" && "openpyxl is used to walk the worksheet's merged-range registry, detect hidden sheets, and resolve formula errors. Regions overlapping the dense data area are flagged."}
            {issue.det === "Duplicates" && "Rows are hashed column-by-column for exact duplicate detection. IDs additionally run through a fuzzy pass using edit distance ≤ 1 to catch confusable-character typos."}
            {issue.det === "AI" && "Claude Haiku reviews each column header alongside 10 sampled values. Prompt caching means re-scans of similar files are near-free."}
            {issue.det === "TimeSeries" && "Rolling z-score (window=14) plus STUMPY matrix-profile discord search over the (date, numeric) pair. We ensemble the two methods so single-point spikes and shape anomalies both surface."}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ==================== Time series ==================== */
function TimeSeriesTab() {
  return (
    <>
      <TSCard s={MOCK.TS_SERIES_1} />
      <TSCard s={MOCK.TS_SERIES_2} />
      <TSCard s={MOCK.TS_SERIES_3} />
    </>
  );
}

function TSCard({ s }) {
  const w = 1080;
  const h = 220;
  const pad = { l: 44, r: 16, t: 12, b: 32 };
  const inner = { w: w - pad.l - pad.r, h: h - pad.t - pad.b };
  const n = s.data.length;
  const max = Math.max(...s.data) * 1.05;
  const min = 0;
  const x = (i) => pad.l + (i / (n - 1)) * inner.w;
  const y = (v) => pad.t + inner.h - ((v - min) / (max - min)) * inner.h;

  const points = s.data.map((v, i) => `${x(i)},${y(v)}`).join(" ");

  // x ticks roughly every 20 points
  const ticks = [0, 20, 40, 60, 80, 100, 120];
  const dateFor = (i) => {
    const d = new Date(s.start);
    d.setDate(d.getDate() + i);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };
  const yTicks = [0, max * 0.25, max * 0.5, max * 0.75, max];
  const fmtY = (v) => s.unit === "$"
    ? (v >= 1000 ? `${Math.round(v / 1000)}k` : Math.round(v).toString())
    : v.toFixed(0);

  return (
    <div className="ts-card">
      <div className="ts-card__head">
        <div>
          <div className="ts-card__title">{s.title}</div>
          <div className="ts-card__sub">{s.subtitle}</div>
        </div>
        <div className="ts-card__legend">
          <span><span className="sw" /> value</span>
          {(s.anomalies || []).length > 0 && <span><span className="swx" /> matrix-profile discord</span>}
          {(s.zspikes || []).length > 0 && <span><span className="swo" /> z-score spike</span>}
        </div>
      </div>
      <svg className="ts-chart" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        {/* grid */}
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} stroke="var(--rule)" strokeWidth="1" strokeDasharray={i === 0 ? "0" : "2 3"} />
            <text x={pad.l - 8} y={y(t) + 4} fontSize="10" fill="var(--ink-3)" fontFamily="JetBrains Mono" textAnchor="end">{fmtY(t)}</text>
          </g>
        ))}
        {/* x labels */}
        {ticks.filter(t => t < n).map((t, i) => (
          <text key={i} x={x(t)} y={h - 10} fontSize="10" fill="var(--ink-3)" fontFamily="JetBrains Mono" textAnchor="middle">{dateFor(t)}</text>
        ))}
        {/* line */}
        <polyline points={points} fill="none" stroke="var(--accent)" strokeWidth="1.4" strokeLinejoin="round" />
        {/* fill under */}
        <polygon
          points={`${pad.l},${y(0)} ${points} ${x(n-1)},${y(0)}`}
          fill="var(--accent)" opacity="0.07"
        />
        {/* z-spikes */}
        {(s.zspikes || []).map((idx, i) => (
          <circle key={i} cx={x(idx)} cy={y(s.data[idx])} r="4" fill="none" stroke="var(--warn)" strokeWidth="1.5" />
        ))}
        {/* discords (X markers) */}
        {(s.anomalies || []).map((idx, i) => {
          const cx = x(idx), cy = y(s.data[idx]);
          return (
            <g key={i} stroke="var(--critical)" strokeWidth="2" strokeLinecap="round">
              <line x1={cx - 5} y1={cy - 5} x2={cx + 5} y2={cy + 5} />
              <line x1={cx - 5} y1={cy + 5} x2={cx + 5} y2={cy - 5} />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

window.ReportScreen = ReportScreen;
