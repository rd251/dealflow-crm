import { ReactNode } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

interface PageShellProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export default function PageShell({ title, subtitle, actions, children }: PageShellProps) {
  const isMobile = useIsMobile();

  return (
    <div className={`min-h-screen bg-background ${isMobile ? "ml-0" : "ml-60"} transition-all duration-200`}>
      <header className={`sticky top-0 z-40 bg-background/80 backdrop-blur-sm border-b flex items-center justify-between ${isMobile ? "px-4 py-4 pl-14" : "px-8 py-5"}`}>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight truncate">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground mt-0.5 truncate">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0 ml-2">{actions}</div>}
      </header>
      <main className={isMobile ? "p-4" : "p-8"}>{children}</main>
    </div>
  );
}
