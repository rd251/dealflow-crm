import { Deal } from "@/data/crm-data";
import { GripVertical, Building2 } from "lucide-react";

interface DealCardProps {
  deal: Deal;
  onDragStart: (e: React.DragEvent, dealId: string) => void;
  onClick: () => void;
}

const priorityStyles: Record<string, string> = {
  Low: "bg-muted text-muted-foreground",
  Normal: "bg-primary/10 text-primary",
  High: "bg-warning/10 text-warning",
  Urgent: "bg-destructive/10 text-destructive",
};

export default function DealCard({ deal, onDragStart, onClick }: DealCardProps) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, deal.id)}
      onClick={onClick}
      className="bg-card border rounded-lg p-3.5 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow group"
    >
      <div className="flex items-start gap-2">
        <GripVertical className="w-4 h-4 text-muted-foreground/40 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{deal.companyName}</p>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{deal.useCase}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs font-mono font-semibold">
              {deal.expectedMRR.toLocaleString("no-NO")} NOK
            </span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${priorityStyles[deal.priority]}`}>
              {deal.priority}
            </span>
          </div>
          <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
            <Building2 className="w-3 h-3" />
            <span>{deal.segment}</span>
            <span className="mx-1">·</span>
            <span>{deal.probability}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
