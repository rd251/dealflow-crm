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
    <div className={`rounded-lg border bg-card p-3 shadow-card sm:p-5 flex items-start gap-3 sm:gap-4 animate-slide-in ${className}`}>
      <div className="p-2 sm:p-2.5 rounded-lg bg-primary/10 text-primary shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs sm:text-sm text-muted-foreground font-medium truncate">{label}</p>
        <p className="font-display text-lg font-semibold tabular-nums sm:text-2xl mt-0.5 truncate">{value}</p>
        {trend && <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 truncate">{trend}</p>}
      </div>
    </div>
  );
}
