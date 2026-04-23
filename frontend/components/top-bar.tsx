"use client";

import { usePathname } from "next/navigation";
import { useMemo } from "react";

import { Brand } from "@/components/brand";
import { Crumbs } from "@/components/crumbs";

function crumbsForPath(pathname: string): string[] {
  if (pathname === "/") return ["Sheetlint", "Upload"];
  if (pathname.startsWith("/configure/")) return ["Sheetlint", "Configure"];
  if (pathname.startsWith("/analysis/")) return ["Sheetlint", "Report"];
  return ["Sheetlint"];
}

export function TopBar() {
  const pathname = usePathname();
  const crumbs = useMemo(() => crumbsForPath(pathname), [pathname]);

  return (
    <header className="topbar">
      <Brand />
      <Crumbs items={crumbs} />
      <div className="topbar__right">
        <span className="mono" style={{ fontSize: 11 }}>
          LOCAL · NO UPLOAD
        </span>
      </div>
    </header>
  );
}
