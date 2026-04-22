import { AlertOctagon, AlertTriangle, Info } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Severity } from "@/lib/schemas";

const CONFIG: Record<
  Severity,
  { label: string; classes: string; Icon: typeof Info }
> = {
  critical: {
    label: "Critical",
    classes: "bg-red-600 text-white hover:bg-red-600 border-transparent",
    Icon: AlertOctagon,
  },
  warning: {
    label: "Warning",
    classes: "bg-amber-500 text-white hover:bg-amber-500 border-transparent",
    Icon: AlertTriangle,
  },
  info: {
    label: "Info",
    classes: "bg-sky-500 text-white hover:bg-sky-500 border-transparent",
    Icon: Info,
  },
};

export function SeverityBadge({
  severity,
  withIcon = true,
  className,
}: {
  severity: Severity;
  withIcon?: boolean;
  className?: string;
}) {
  const { label, classes, Icon } = CONFIG[severity];
  return (
    <Badge className={cn(classes, "gap-1 uppercase tracking-wide", className)}>
      {withIcon ? <Icon className="size-3" /> : null}
      {label}
    </Badge>
  );
}
