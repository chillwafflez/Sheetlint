"use client";

import { LayoutDashboard, LineChart, ListChecks } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export function AnalysisNav({ jobId }: { jobId: string }) {
  const pathname = usePathname();
  const base = `/analysis/${jobId}`;

  const tabs = [
    { href: base, label: "Overview", Icon: LayoutDashboard },
    { href: `${base}/issues`, label: "Issues", Icon: ListChecks },
    { href: `${base}/time-series`, label: "Time-series", Icon: LineChart },
  ];

  return (
    <nav className="flex gap-1 border-b">
      {tabs.map(({ href, label, Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
              active
                ? "border-blue-600 text-blue-700 dark:border-blue-400 dark:text-blue-300"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
