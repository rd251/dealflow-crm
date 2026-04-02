import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Settings } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import NotificationBell from "@/components/NotificationBell";

interface PageShellProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export default function PageShell({ title, subtitle, actions, children }: PageShellProps) {
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  return (
    <div className={`min-h-screen bg-background ${isMobile ? "ml-0" : "ml-60"} transition-all duration-200`}>
      <header className={`sticky top-0 z-40 bg-background/80 backdrop-blur-sm border-b ${isMobile ? "px-4 py-4 pl-14" : "px-8 py-5"}`}>
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight truncate">{title}</h1>
            {subtitle && <p className="text-sm text-muted-foreground mt-0.5 truncate">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <NotificationBell />
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground hover:text-foreground"
              onClick={() => navigate("/innstillinger")}
              title="Innstillinger"
            >
              <Settings className="w-5 h-5" />
            </Button>
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 mt-3">{actions}</div>}
      </header>
      <main className={isMobile ? "p-4" : "p-8"}>{children}</main>
    </div>
  );
}
