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
      <header className={`sticky top-0 z-40 border-b bg-background/90 backdrop-blur-md ${isMobile ? "px-4 py-4 pl-14" : "px-8 py-5"}`}>
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-semibold truncate">{title}</h1>
            {subtitle && <p className="text-sm text-muted-foreground mt-0.5 truncate">{subtitle}</p>}
          </div>
          {!isMobile && (
            <div className="flex-1 max-w-md mx-6">
              <GlobalSearch className="" />
            </div>
          )}
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground hover:text-foreground"
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
      <main className={isMobile ? "p-4" : "p-8 lg:p-10"}>{children}</main>
      <QuickAddPersonDialog open={nyPersonÅpen} onOpenChange={setNyPersonÅpen} onCreated={id => navigate(`/kontakter?open=${id}`)} />
    </div>
  );
}
