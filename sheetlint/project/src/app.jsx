// App shell + Tweaks wiring

function App() {
  const [step, setStep] = useState("upload"); // upload | configure | scanning | report
  const [fileName, setFileName] = useState("");
  const [config, setConfig] = useState(null);
  const [tweaks, setTweaks] = useState(window.__SHEETLINT_TWEAKS || { palette: "forest", density: "comfortable" });
  const [tweaksOpen, setTweaksOpen] = useState(false);

  // Apply palette/density attributes to document root
  useEffect(() => {
    document.documentElement.setAttribute("data-palette", tweaks.palette);
    document.documentElement.setAttribute("data-density", tweaks.density);
  }, [tweaks]);

  // Edit mode wiring
  useEffect(() => {
    function onMessage(e) {
      if (!e.data) return;
      if (e.data.type === "__activate_edit_mode") setTweaksOpen(true);
      if (e.data.type === "__deactivate_edit_mode") setTweaksOpen(false);
    }
    window.addEventListener("message", onMessage);
    window.parent.postMessage({ type: "__edit_mode_available" }, "*");
    return () => window.removeEventListener("message", onMessage);
  }, []);

  function handleTweaks(next) {
    setTweaks(next);
    window.parent.postMessage({ type: "__edit_mode_set_keys", edits: next }, "*");
  }

  const crumbs = (() => {
    if (step === "upload") return ["Sheetlint", "Upload"];
    if (step === "configure") return ["Sheetlint", fileName, "Configure"];
    if (step === "scanning") return ["Sheetlint", fileName, "Scanning"];
    return ["Sheetlint", fileName, "Report"];
  })();

  return (
    <div className="app" data-screen-label={`Sheetlint / ${step}`}>
      <div className="topbar">
        <Brand />
        <Crumbs items={crumbs} />
        <div className="topbar__right">
          <span className="mono" style={{ fontSize: 11, color: "var(--ink-4)" }}>LOCAL · NO UPLOAD</span>
          <button className="btn btn--ghost btn--sm" onClick={() => setTweaksOpen(!tweaksOpen)}>
            <Icon.Settings /> Tweaks
          </button>
        </div>
      </div>

      {step === "upload" && (
        <UploadScreen onFileChosen={(name) => { setFileName(name); setStep("configure"); }} />
      )}
      {step === "configure" && (
        <ConfigureScreen
          fileName={fileName}
          onCancel={() => { setStep("upload"); setFileName(""); }}
          onRun={(cfg) => { setConfig(cfg); setStep("scanning"); }}
        />
      )}
      {step === "scanning" && (
        <ScanningScreen fileName={fileName} config={config} onDone={() => setStep("report")} />
      )}
      {step === "report" && (
        <ReportScreen
          fileName={fileName}
          config={config}
          onRestart={() => { setStep("upload"); setFileName(""); setConfig(null); }}
        />
      )}

      {tweaksOpen && <TweaksPanel state={tweaks} setState={handleTweaks} />}
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
