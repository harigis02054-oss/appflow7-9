"use client";

import { useEffect, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { EmptyState } from "@/components/ui";
import { getActivity } from "@/lib/storage/activity";
import type { ActivityEntry } from "@/lib/types";

const SEVERITY_DOT: Record<ActivityEntry["severity"], string> = {
  info: "bg-signal-info",
  success: "bg-signal-success",
  warning: "bg-signal-building",
  danger: "bg-signal-danger",
};

export default function ActivityPage() {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);

  useEffect(() => {
    setEntries(getActivity());
  }, []);

  return (
    <PageShell
      title="Activity"
      description="Every action AppFlow has recorded, most recent first."
    >
      {entries.length === 0 ? (
        <EmptyState
          title="No activity yet"
          description="Actions like creating an app, running a build, or re-analyzing a repository will show up here."
        />
      ) : (
        <div className="border border-border bg-panel divide-y divide-border">
          {entries.map((e) => (
            <div key={e.id} className="flex items-center gap-3 px-4 py-2.5 text-[13px]">
              <span className={`w-1.5 h-1.5 shrink-0 ${SEVERITY_DOT[e.severity]}`} />
              <span className="text-text">{e.message}</span>
              <span className="ml-auto text-text-faint mono text-[11px]">
                {new Date(e.timestamp).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </PageShell>
  );
}
