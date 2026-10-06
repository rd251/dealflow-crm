import { ReactNode, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Settings, UserPlus } from "lucide-react";
import QuickAddPersonDialog from "@/components/QuickAddPersonDialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSidebarCollapsed } from "@/hooks/use-sidebar-collapsed";
import { Button } from "@/components/ui/button";
import NotificationBell from "@/components/NotificationBell";
import ThemeToggle from "@/components/ThemeToggle";
import LogActivityButton from "@/components/LogActivityButton";
import GlobalSearch from "@/components/GlobalSearch";

interface PageShellProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export default function PageShell({ title, subtitle, actions, children }: PageShellProps) {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { collapsed } = useSidebarCollapsed();
  const [nyPersonÅpen, setNyPersonÅpen] = useState(false);

  return (
    <div className={`min-h-screen bg-background ${isMobile ? "ml-0" : collapsed ? "ml-14" : "ml-60"} transition-all duration-200`}>
      <header className={`sticky top-0 z-40 border-b bg-background/95 backdrop-blur-md ${isMobile ? "px-4 py-3 pl-14" : "px-8 py-4"}`}>
        <div className="flex items-center justify-between gap-2">
          <span className="font-display text-sm font-bold shrink-0">Snakk CRM</span>
          {!isMobile && (
            <div className="flex-1 max-w-md mx-6">
              <GlobalSearch className="" />
            </div>
          )}
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="hidden sm:inline-flex h-9 w-9 text-muted-foreground hover:text-foreground"
              onClick={() => setNyPersonÅpen(true)}
              title="Ny person"
            >
              <UserPlus className="w-5 h-5" />
            </Button>
            <LogActivityButton allowTargetPick variant="outline" label={isMobile ? "Logg" : "Logg aktivitet"} className="mr-1" />
            <ThemeToggle />
            <NotificationBell />
            <Button
              variant="ghost"
              size="icon"
              className="hidden sm:inline-flex h-9 w-9 text-muted-foreground hover:text-foreground"
              onClick={() => navigate("/innstillinger")}
              title="Innstillinger"
            >
              <Settings className="w-5 h-5" />
            </Button>
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 mt-3">{actions}</div>}
      </header>
      <main className={isMobile ? "p-4" : "p-8 lg:p-10"}>
        <div className="mb-7 border-b-2 border-secondary pb-5">
          <h1 className="font-display text-3xl font-bold leading-tight break-words sm:text-4xl lg:text-5xl">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {children}
      </main>
      <QuickAddPersonDialog open={nyPersonÅpen} onOpenChange={setNyPersonÅpen} onCreated={id => navigate(`/kontakter?open=${id}`)} />
    </div>
  );
}
