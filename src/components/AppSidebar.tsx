import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, UserPlus, Handshake, FolderKanban, Building2, Users, ListTodo, Menu, ChevronLeft, ChevronDown, Users2, GitBranch, Shield, LogOut, Activity, BarChart3, CalendarDays, GitMerge, NotebookPen, Phone, Mail } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/use-auth";
import { useSidebarCollapsed } from "@/hooks/use-sidebar-collapsed";
import { useProfiles } from "@/hooks/use-profiles";
import logo from "@/assets/logo-white.svg";
import { useState } from "react";
import { cn } from "@/lib/utils";

type NavItem = { to: string; icon: any; label: string };

// Salgsflyten – alltid synlig
const mainItems: NavItem[] = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/leads", icon: UserPlus, label: "Leads" },
  { to: "/ringeliste", icon: Phone, label: "Ringeliste" },
  { to: "/salgsmuligheter", icon: Handshake, label: "Salgsmuligheter" },
  { to: "/selskaper", icon: Building2, label: "Kundeforhold" },
  { to: "/prosjekter", icon: FolderKanban, label: "Prosjekter" },
  { to: "/kontakter", icon: Users, label: "Kontakter" },
  { to: "/partnere", icon: Users2, label: "Partnere" },
  { to: "/kalender", icon: CalendarDays, label: "Kalender" },
  { to: "/oppgaver", icon: ListTodo, label: "Oppgaver" },
  { to: "/rapporter", icon: BarChart3, label: "Rapporter" },
];

// Alt annet – samlet under «Mer»
const moreItems: NavItem[] = [
  { to: "/alle-selskaper", icon: Building2, label: "Alle selskaper" },
  { to: "/kontaktstrom", icon: GitMerge, label: "Kontaktstrøm" },
  { to: "/moetenotater", icon: NotebookPen, label: "Møtenotater" },
  { to: "/aktiviteter", icon: Activity, label: "Endringslogg" },
  { to: "/partner-pipeline", icon: GitBranch, label: "Partner Pipeline" },
  { to: "/nyhetsbrev", icon: Mail, label: "Nyhetsbrev" },
];

function SidebarNav({ onNavigate, isAdmin, displayName }: { onNavigate?: () => void; isAdmin: boolean; displayName?: string }) {
  const location = useLocation();
  const { signOut, user } = useAuth();
  const [moreOpen, setMoreOpen] = useState(() => moreItems.some((i) => i.to === location.pathname));

  const renderItem = ({ to, icon: Icon, label }: NavItem) => {
    const active = location.pathname === to;
    return (
      <NavLink
        key={to}
        to={to}
        onClick={onNavigate}
        className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
          active
            ? "bg-sidebar-accent text-sidebar-primary"
            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        }`}
      >
        <Icon className="w-4 h-4 shrink-0" />
        {label}
      </NavLink>
    );
  };

  return (
    <>
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto scrollbar-sidebar">
        <div className="space-y-0.5">{mainItems.map(renderItem)}</div>
        <div className="pt-3">
          <button
            onClick={() => setMoreOpen((v) => !v)}
            className="flex w-full items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
          >
            <ChevronDown className={cn("w-4 h-4 shrink-0 transition-transform", !moreOpen && "-rotate-90")} />
            Mer
          </button>
          {moreOpen && <div className="space-y-0.5 pt-0.5">{moreItems.map(renderItem)}</div>}
        </div>
        {isAdmin && (
          <div className="pt-2">
            {renderItem({ to: "/admin", icon: Shield, label: "Admin" })}
          </div>
        )}
      </nav>
      {user && (
        <div className="px-3 pb-2">
          <div className="px-3 py-1.5">
            <p className="text-sm font-medium text-sidebar-foreground truncate">{displayName || user.email}</p>
            {displayName && <span className="text-xs text-sidebar-foreground/60 truncate">{user.email}</span>}
          </div>
          <button
            onClick={() => { signOut(); onNavigate?.(); }}
            className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors w-full"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            Logg ut
          </button>
        </div>
      )}
    </>
  );
}

function CollapsedSidebarNav({ isAdmin }: { isAdmin: boolean }) {
  const location = useLocation();
  const { signOut, user } = useAuth();
  const allItems = [...mainItems, ...moreItems];
  const items = isAdmin ? [...allItems, { to: "/admin", icon: Shield, label: "Admin" }] : allItems;

  return (
    <>
      <nav className="flex-1 px-2 space-y-0.5 mt-1 overflow-y-auto scrollbar-sidebar">
        {items.map(({ to, icon: Icon, label }) => {
          const active = location.pathname === to;
          return (
            <NavLink
              key={to}
              to={to}
              title={label}
              className={`flex items-center justify-center p-2 rounded-md transition-colors ${
                active
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <Icon className="w-4 h-4" />
            </NavLink>
          );
        })}
      </nav>
      {user && (
        <div className="px-2 pb-2">
          <button
            onClick={() => signOut()}
            title="Logg ut"
            className="flex items-center justify-center p-2 rounded-md text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors w-full"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      )}
    </>
  );
}

export default function AppSidebar() {
  const isMobile = useIsMobile();
  const { isAdmin, user } = useAuth();
  const { profiles } = useProfiles();
  const [open, setOpen] = useState(false);
  const { collapsed, setCollapsed } = useSidebarCollapsed();

  const displayName = user ? profiles.find(p => p.user_id === user.id)?.display_name : undefined;

  if (isMobile) {
    return (
      <>
        <Button
          variant="ghost"
          size="icon"
          className="fixed top-3 left-3 z-50 bg-sidebar text-sidebar-foreground hover:bg-sidebar-accent"
          onClick={() => setOpen(true)}
        >
          <Menu className="w-5 h-5" />
        </Button>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="left" className="w-60 p-0 bg-sidebar border-sidebar-border flex flex-col">
            <SheetTitle className="sr-only">Navigasjon</SheetTitle>
            <div className="p-4 pb-3">
              <img src={logo} alt="Snakk CRM" className="h-8 w-auto" />
            </div>
            <SidebarNav onNavigate={() => setOpen(false)} isAdmin={isAdmin} displayName={displayName} />
            <div className="p-3 text-xs text-sidebar-foreground/50">
              Snakk CRM v2.0
            </div>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 bottom-0 bg-sidebar flex flex-col z-50 transition-all duration-200",
        collapsed ? "w-14" : "w-60"
      )}
    >
      {!collapsed && (
        <div className="p-4 pb-3 flex items-center justify-between">
          <img src={logo} alt="Snakk CRM" className="h-8 w-auto" />
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={() => setCollapsed(true)}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
        </div>
      )}
      {collapsed && (
        <div className="p-2 flex justify-center">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={() => setCollapsed(false)}
          >
            <Menu className="w-4 h-4" />
          </Button>
        </div>
      )}
      {collapsed ? <CollapsedSidebarNav isAdmin={isAdmin} /> : <SidebarNav isAdmin={isAdmin} displayName={displayName} />}
      {!collapsed && (
        <div className="p-3 text-xs text-sidebar-foreground/50">
          Snakk CRM v2.0
        </div>
      )}
    </aside>
  );
}

export function useSidebarWidth() {
  return { collapsed: false };
}
