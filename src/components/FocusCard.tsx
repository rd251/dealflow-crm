import { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

interface FocusCardProps {
  icon: ReactNode;
  label: string;
  count: number;
  color: string; // tailwind text color token e.g. "text-destructive"
  onClick: () => void;
}

export default function FocusCard({ icon, label, count, color, onClick }: FocusCardProps) {
  return (
    <button
      onClick={onClick}
      className="bg-card border rounded-xl p-4 flex items-center gap-3 hover:shadow-md hover:border-primary/30 transition-all text-left group w-full"
    >
      <div className={`p-2 rounded-lg bg-muted shrink-0 ${color}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-2xl font-bold ${color}`}>{count}</p>
        <p className="text-xs text-muted-foreground font-medium truncate">{label}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
    </button>
  );
}
