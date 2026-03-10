import { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: ReactNode;
  trend?: string;
  className?: string;
}

export default function StatCard({ label, value, icon, trend, className = "" }: StatCardProps) {
  return (
    <div className={`bg-card rounded-xl border p-5 flex items-start gap-4 animate-slide-in ${className}`}>
      <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-muted-foreground font-medium">{label}</p>
        <p className="text-2xl font-bold tracking-tight mt-0.5">{value}</p>
        {trend && <p className="text-xs text-muted-foreground mt-1">{trend}</p>}
      </div>
    </div>
  );
}
