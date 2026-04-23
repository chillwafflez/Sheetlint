"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ChartIcon, GridIcon, ListIcon } from "@/components/icons";

type Tab = {
  href: string;
  label: string;
  Icon: typeof GridIcon;
  count?: number;
};

export function ReportTabs({
  jobId,
  issueCount,
  anomalyCount,
}: {
  jobId: string;
  issueCount: number;
  anomalyCount: number;
}) {
  const pathname = usePathname();
  const base = `/analysis/${jobId}`;

  const tabs: Tab[] = [
    { href: base, label: "Overview", Icon: GridIcon },
    { href: `${base}/issues`, label: "Issues", Icon: ListIcon, count: issueCount },
    {
      href: `${base}/time-series`,
      label: "Time-series",
      Icon: ChartIcon,
      count: anomalyCount,
    },
  ];

  return (
    <nav className="tabs" role="tablist">
      {tabs.map(({ href, label, Icon, count }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={`tab ${active ? "active" : ""}`}
            role="tab"
            aria-selected={active}
          >
            <Icon />
            {label}
            {count !== undefined && <span className="count">{count}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
