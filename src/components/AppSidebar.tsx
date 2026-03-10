import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, Building2, Users, Kanban, ListTodo } from "lucide-react";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/companies", icon: Building2, label: "Companies" },
  { to: "/contacts", icon: Users, label: "Contacts" },
  { to: "/deals", icon: Kanban, label: "Deals" },
  { to: "/tasks", icon: ListTodo, label: "Tasks" },
];

export default function AppSidebar() {
  const location = useLocation();

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-60 bg-sidebar flex flex-col z-50">
      <div className="p-6 pb-4">
        <h1 className="text-xl font-bold text-sidebar-primary-foreground tracking-tight">
          <span className="text-sidebar-primary">Snakk</span> CRM
        </h1>
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
        Snakk CRM v1.0
      </div>
    </aside>
  );
}
