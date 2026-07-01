import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, UserPlus, Handshake, FolderKanban, Building2, Users, ListTodo, Menu, ChevronLeft, Users2, GitBranch, Shield, LogOut, Activity, BarChart3, CalendarDays, GitMerge, NotebookPen, Phone } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/use-auth";
import { useProfiles } from "@/hooks/use-profiles";
import logo from "@/assets/logo-white.svg";
import { useState } from "react";
import { cn } from "@/lib/utils";

type NavItem = { to: string; icon: any; label: string };

const navSections: { title: string; items: NavItem[] }[] = [
  {
    title: "Oversikt",
    items: [
      { to: "/kontaktstrom", icon: GitMerge, label: "Kontaktstrøm" },
      { to: "/", icon: LayoutDashboard, label: "Dashboard" },
    ],
  },
  {
    title: "Salg",
    items: [
      { to: "/leads", icon: UserPlus, label: "Leads" },
      { to: "/salgsmuligheter", icon: Handshake, label: "Salgsmuligheter" },
      { to: "/prosjekter", icon: FolderKanban, label: "Prosjekter" },
      { to: "/ringeliste", icon: Phone, label: "Ringeliste" },
    ],
  },
  {
    title: "Kunder",
    items: [
      { to: "/selskaper", icon: Building2, label: "Kundeforhold" },
      { to: "/alle-selskaper", icon: Building2, label: "Selskaper" },
      { to: "/kontakter", icon: Users, label: "Kontakter" },
    ],
  },
  {
    title: "Aktivitet",
    items: [
      { to: "/oppgaver", icon: ListTodo, label: "Oppgaver" },
      { to: "/kalender", icon: CalendarDays, label: "Kalender" },
      { to: "/moetenotater", icon: NotebookPen, label: "Møtenotater" },
      { to: "/aktiviteter", icon: Activity, label: "Endringslogg" },
    ],
  },
  {
    title: "Partnere",
    items: [
      { to: "/partnere", icon: Users2, label: "Partnere" },
      { to: "/partner-pipeline", icon: GitBranch, label: "Partner Pipeline" },
    ],
  },
  {
    title: "Innsikt",
    items: [
      { to: "/rapporter", icon: BarChart3, label: "Rapporter" },
    ],
  },
];

function SidebarNav({ onNavigate, isAdmin, displayName }: { onNavigate?: () => void; isAdmin: boolean; displayName?: string }) {
  const location = useLocation();
  const { signOut, user } = useAuth();

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
        {navSections.map((section) => (
          <div key={section.title} className="pt-2 first:pt-0">
            <p className="px-3 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
              {section.title}
            </p>
            <div className="space-y-0.5">{section.items.map(renderItem)}</div>
          </div>
        ))}
        {isAdmin && (
          <div className="pt-3">
            {renderItem({ to: "/admin", icon: Shield, label: "Admin" })}
          </div>
        )}
      </nav>
      {user && (
        <div className="px-3 pb-2">
          <div className="px-3 py-2">
            <p className="text-sm font-medium text-sidebar-foreground truncate">{displayName || user.email}</p>
            {displayName && <span className="text-xs text-sidebar-foreground/60 truncate">{user.email}</span>}
          </div>
          <button
            onClick={() => { signOut(); onNavigate?.(); }}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors w-full"
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
  const allItems = navSections.flatMap((s) => s.items);
  const items = isAdmin ? [...allItems, { to: "/admin", icon: Shield, label: "Admin" }] : allItems;

  return (
    <>
      <nav className="flex-1 px-2 space-y-1 mt-2 overflow-y-auto scrollbar-sidebar">
        {items.map(({ to, icon: Icon, label }) => {
          const active = location.pathname === to;
          return (
            <NavLink
              key={to}
              to={to}
              title={label}
              className={`flex items-center justify-center p-2.5 rounded-lg transition-colors ${
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
            className="flex items-center justify-center p-2.5 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors w-full"
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
  const [collapsed, setCollapsed] = useState(false);

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
            <div className="p-6 pb-4">
              <img src={logo} alt="Snakk CRM" className="h-8 w-auto" />
            </div>
            <SidebarNav onNavigate={() => setOpen(false)} isAdmin={isAdmin} displayName={displayName} />
            <div className="p-4 text-xs text-sidebar-foreground/50">
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
        <div className="p-6 pb-4 flex items-center justify-between">
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
        <div className="p-4 text-xs text-sidebar-foreground/50">
          Snakk CRM v2.0
        </div>
      )}
    </aside>
  );
}

export function useSidebarWidth() {
  return { collapsed: false };
}
