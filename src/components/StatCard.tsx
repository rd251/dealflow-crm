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
    <div className={`rounded-lg border bg-card p-4 sm:p-6 flex items-start gap-3 sm:gap-4 animate-slide-in ${className}`}>
      <div className="p-2 sm:p-2.5 rounded-md bg-secondary text-secondary-foreground shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs sm:text-sm text-muted-foreground font-medium break-words">{label}</p>
        <p className="font-display text-2xl font-bold tabular-nums sm:text-3xl mt-2 break-words">{value}</p>
        {trend && <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 truncate">{trend}</p>}
      </div>
    </div>
  );
}
