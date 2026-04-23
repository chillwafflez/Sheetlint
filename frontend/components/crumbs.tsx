import { Fragment } from "react";

export function Crumbs({ items }: { items: readonly string[] }) {
  return (
    <div className="topbar__crumbs">
      {items.map((item, i) => (
        <Fragment key={`${item}-${i}`}>
          {i > 0 && <span className="sep">/</span>}
          <span className={i === items.length - 1 ? "active" : ""}>{item}</span>
        </Fragment>
      ))}
    </div>
  );
}
