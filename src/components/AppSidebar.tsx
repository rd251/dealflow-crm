import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, UserPlus, Handshake, FolderKanban, Building2, Users, ListTodo } from "lucide-react";
import logo from "@/assets/logo.svg";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/leads", icon: UserPlus, label: "Leads" },
  { to: "/salgsmuligheter", icon: Handshake, label: "Salgsmuligheter" },
  { to: "/prosjekter", icon: FolderKanban, label: "Prosjekter" },
  { to: "/selskaper", icon: Building2, label: "Kundeforhold" },
  { to: "/kontakter", icon: Users, label: "Kontakter" },
  { to: "/oppgaver", icon: ListTodo, label: "Oppgaver" },
];

export default function AppSidebar() {
  const location = useLocation();

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-60 bg-sidebar flex flex-col z-50">
      <div className="p-6 pb-4">
        <img src={logo} alt="Snakk CRM" className="h-8 w-auto" />
      </div>
      <nav className="flex-1 px-3 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => {
          const active = location.pathname === to;
          return (
            <NavLink
              key={to}
              to={to}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </NavLink>
          );
        })}
      </nav>
      <div className="p-4 text-xs text-sidebar-foreground/50">
        Snakk CRM v2.0
      </div>
    </aside>
  );
}
