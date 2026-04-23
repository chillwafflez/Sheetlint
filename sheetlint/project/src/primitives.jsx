// Shared UI primitives

const { useState, useEffect, useRef, useMemo, useCallback } = React;

/* ---- Icons ---- */
const Icon = {
  Sheet: (p) => (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" {...p}>
      <rect x="2" y="2" width="12" height="12" rx="1" />
      <path d="M2 6h12M2 10h12M6 2v12M10 2v12" />
    </svg>
  ),
  Check: (p) => (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
      <path d="M2.5 6.5l2.5 2.5 4.5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Arrow: (p) => (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}>
      <path d="M3 6h6M6 3l3 3-3 3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  ArrowBack: (p) => (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}>
      <path d="M9 6H3m3 3L3 6l3-3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Search: (p) => (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" {...p}>
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5L14 14" strokeLinecap="round" />
    </svg>
  ),
  Download: (p) => (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}>
      <path d="M6 2v6M3.5 5.5L6 8l2.5-2.5M2 10h8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Doc: (p) => (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" {...p}>
      <path d="M3 2h6l3 3v9H3z" />
      <path d="M9 2v3h3" />
    </svg>
  ),
  Warn: (p) => (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" {...p}>
      <path d="M8 2l6.5 11.5h-13z" />
      <path d="M8 6v3M8 11.5v.01" strokeLinecap="round" />
    </svg>
  ),
  Critical: (p) => (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" {...p}>
      <circle cx="8" cy="8" r="6.5" />
      <path d="M8 5v3.5M8 10.5v.01" strokeLinecap="round" />
    </svg>
  ),
  Info: (p) => (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" {...p}>
      <circle cx="8" cy="8" r="6.5" />
      <path d="M8 7v4M8 5v.01" strokeLinecap="round" />
    </svg>
  ),
  Eye: (p) => (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" {...p}>
      <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" />
      <circle cx="8" cy="8" r="2" />
    </svg>
  ),
  EyeOff: (p) => (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" {...p}>
      <path d="M2 2l12 12" strokeLinecap="round" />
      <path d="M6.5 6.5a2 2 0 002.83 2.83M3.5 4.5C2 5.8 1 8 1 8s2.5 5 7 5c1.1 0 2.1-.3 3-.7M13 12.2c1.2-1 2-2.2 2-2.2s-2.5-5-7-5c-.6 0-1.2.1-1.7.2" />
    </svg>
  ),
  Settings: (p) => (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" {...p}>
      <circle cx="8" cy="8" r="2.5" />
      <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.5 1.5M11.5 11.5L13 13M3 13l1.5-1.5M11.5 4.5L13 3" strokeLinecap="round" />
    </svg>
  ),
  Sparkle: (p) => (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" {...p}>
      <path d="M8 2v4M8 10v4M2 8h4M10 8h4M4 4l2 2M10 10l2 2M12 4l-2 2M6 10l-2 2" strokeLinecap="round" />
    </svg>
  ),
  Chart: (p) => (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" {...p}>
      <path d="M2 13l3-4 3 2 4-6 2 3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2 2v12h12" strokeLinecap="round" />
    </svg>
  ),
  Grid: (p) => (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" {...p}>
      <rect x="2" y="2" width="5" height="5" />
      <rect x="9" y="2" width="5" height="5" />
      <rect x="2" y="9" width="5" height="5" />
      <rect x="9" y="9" width="5" height="5" />
    </svg>
  ),
  List: (p) => (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" {...p}>
      <path d="M4 4h10M4 8h10M4 12h10M1.5 4v.01M1.5 8v.01M1.5 12v.01" strokeLinecap="round" />
    </svg>
  ),
  Db: (p) => (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" {...p}>
      <ellipse cx="8" cy="3.5" rx="5.5" ry="1.8" />
      <path d="M2.5 3.5v5c0 1 2.5 1.8 5.5 1.8s5.5-.8 5.5-1.8v-5" />
      <path d="M2.5 8.5v4c0 1 2.5 1.8 5.5 1.8s5.5-.8 5.5-1.8v-4" />
    </svg>
  ),
  Link: (p) => (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" {...p}>
      <path d="M7 9a3 3 0 004.2 0l2.3-2.3a3 3 0 00-4.2-4.2L8 4" strokeLinecap="round" />
      <path d="M9 7a3 3 0 00-4.2 0L2.5 9.3a3 3 0 004.2 4.2L8 12" strokeLinecap="round" />
    </svg>
  ),
};

/* ---- Severity badge ---- */
function SevBadge({ sev }) {
  const cls = sev === "critical" ? "sev--critical" : sev === "warn" ? "sev--warn" : "sev--info";
  const label = sev === "critical" ? "Critical" : sev === "warn" ? "Warning" : "Info";
  return <span className={`sev ${cls}`}>{label}</span>;
}

function Crumbs({ items }) {
  return (
    <div className="topbar__crumbs">
      {items.map((it, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="sep">/</span>}
          <span className={i === items.length - 1 ? "active" : ""}>{it}</span>
        </React.Fragment>
      ))}
    </div>
  );
}

function Brand() {
  return (
    <div className="brand">
      <span className="brand__mark">
        Sheet<span className="brand__dot"></span>lint
      </span>
      <span className="brand__tag">DATA QUALITY · v0.4</span>
    </div>
  );
}

Object.assign(window, { Icon, SevBadge, Crumbs, Brand });
