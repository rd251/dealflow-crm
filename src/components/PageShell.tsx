import { ReactNode } from "react";

interface PageShellProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export default function PageShell({ title, subtitle, actions, children }: PageShellProps) {
  return (
    <div className="ml-60 min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-sm border-b px-8 py-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-3">{actions}</div>}
      </header>
      <main className="p-8">{children}</main>
    </div>
  );
}
