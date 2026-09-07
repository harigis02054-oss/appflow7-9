"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  Boxes,
  GitBranch,
  Hammer,
  Rocket,
  KeyRound,
  Activity,
  Settings,
} from "lucide-react";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutGrid },
  { href: "/apps", label: "Apps", icon: Boxes },
  { href: "/github", label: "GitHub", icon: GitBranch },
  { href: "/builds", label: "Builds", icon: Hammer },
  { href: "/releases", label: "Releases", icon: Rocket },
  { href: "/credentials", label: "Credentials", icon: KeyRound },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 border-r border-border bg-panel flex flex-col h-screen sticky top-0">
      <div className="h-14 flex items-center gap-2 px-4 border-b border-border">
        <div className="w-2.5 h-2.5 bg-signal-success" />
        <span className="text-[13px] font-semibold tracking-tight text-text">
          AppFlow
        </span>
      </div>

      <nav className="flex-1 py-3">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 px-4 py-2 text-[13px] border-l-2 transition-colors ${
                active
                  ? "border-l-signal-info bg-panel-raised text-text"
                  : "border-l-transparent text-text-muted hover:text-text hover:bg-panel-raised/60"
              }`}
            >
              <Icon size={15} strokeWidth={1.75} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="px-4 py-3 border-t border-border text-[11px] text-text-faint">
        Local storage · v0.1
      </div>
    </aside>
  );
}
