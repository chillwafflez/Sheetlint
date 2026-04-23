// Tweaks panel

function TweaksPanel({ state, setState }) {
  return (
    <div className="tweaks-panel">
      <div className="tweaks-panel__title">Tweaks</div>
      <div className="tweaks-group">
        <div className="tweaks-group__label">Palette</div>
        <div className="swatch-row">
          {["forest", "ocean", "slate"].map((p) => (
            <button
              key={p}
              className={`swatch ${state.palette === p ? "active" : ""}`}
              data-p={p}
              onClick={() => setState({ ...state, palette: p })}
              title={p}
            />
          ))}
        </div>
      </div>
      <div className="tweaks-group">
        <div className="tweaks-group__label">Density</div>
        <div className="segmented">
          <button className={state.density === "comfortable" ? "active" : ""} onClick={() => setState({ ...state, density: "comfortable" })}>Comfortable</button>
          <button className={state.density === "compact" ? "active" : ""} onClick={() => setState({ ...state, density: "compact" })}>Compact</button>
        </div>
      </div>
    </div>
  );
}

window.TweaksPanel = TweaksPanel;
