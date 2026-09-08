import { Sidebar } from "./Sidebar";
import { NotificationBell } from "./NotificationBell";

export function PageShell({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar />
      <div className="flex-1 min-w-0">
        <header className="h-14 border-b border-border flex items-center justify-between px-6 sticky top-0 bg-bg/95 backdrop-blur z-10">
          <div>
            <h1 className="text-[15px] font-semibold text-text">{title}</h1>
            {description && (
              <p className="text-[12px] text-text-muted -mt-0.5">
                {description}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell />
            {actions}
          </div>
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
