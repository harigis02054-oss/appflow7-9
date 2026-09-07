"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui";
import { driver } from "@/lib/storage/storage";

const COLLECTIONS = [
  "apps",
  "repositories",
  "builds",
  "releases",
  "activity",
  "settings",
];

export default function SettingsPage() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);

  function resetAll() {
    COLLECTIONS.forEach((c) => driver.clear(c));
    router.push("/");
  }

  return (
    <PageShell
      title="Settings"
      description="Storage backend and local data management."
    >
      <div className="max-w-xl space-y-6">
        <section className="border border-border bg-panel p-4">
          <h2 className="text-[13px] font-medium text-text mb-2">
            Storage backend
          </h2>
          <p className="text-[12px] text-text-muted">
            Currently: <span className="mono text-text">localStorage</span>{" "}
            (browser-local, this device only). Every read/write goes through{" "}
            <code className="mono">src/lib/storage/</code>, so switching to
            Supabase or Firebase later means implementing the{" "}
            <code className="mono">StorageDriver</code> interface once — the
            rest of the app doesn&apos;t change.
          </p>
        </section>

        <section className="border border-signal-danger/40 bg-panel p-4">
          <h2 className="text-[13px] font-medium text-signal-danger mb-2">
            Danger zone
          </h2>
          <p className="text-[12px] text-text-muted mb-3">
            Clears all apps, repositories, builds, releases, and activity
            stored in this browser. This can&apos;t be undone.
          </p>
          {!confirming ? (
            <Button variant="danger" onClick={() => setConfirming(true)}>
              Reset all local data
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-text">Are you sure?</span>
              <Button variant="danger" onClick={resetAll}>
                Yes, delete everything
              </Button>
              <Button variant="secondary" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
            </div>
          )}
        </section>
      </div>
    </PageShell>
  );
}
