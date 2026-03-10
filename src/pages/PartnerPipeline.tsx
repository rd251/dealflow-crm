import { useState } from "react";
import { useNavigate } from "react-router-dom";
import PageShell from "@/components/PageShell";
import { useCrmStore } from "@/hooks/use-crm-store";
import { useIsMobile } from "@/hooks/use-mobile";
import { Badge } from "@/components/ui/badge";
import { PartnerPipelineStatus } from "@/data/crm-data";
import { GripVertical } from "lucide-react";

const pipelineStatuses: PartnerPipelineStatus[] = ["Ny partner", "Introduksjon", "Demo / gjennomgang", "Avtale", "Aktiv partner"];

const stageColors: Record<PartnerPipelineStatus, string> = {
  "Ny partner": "bg-stage-new-lead",
  "Introduksjon": "bg-stage-contacted",
  "Demo / gjennomgang": "bg-stage-demo",
  "Avtale": "bg-stage-proposal",
  "Aktiv partner": "bg-stage-won",
};

export default function PartnerPipeline() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { partnere, updatePartnere } = useCrmStore();
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const handleDrop = (e: React.DragEvent, stage: PartnerPipelineStatus) => {
    e.preventDefault();
    if (!draggedId) return;
    const today = new Date().toISOString().split("T")[0];
    updatePartnere(prev => prev.map(p =>
      p.id === draggedId ? {
        ...p,
        pipeline_status: stage,
        partnerstatus: stage === "Aktiv partner" ? "Aktiv" as const : p.partnerstatus,
        sist_aktivitet: today,
      } : p
    ));
    setDraggedId(null);
  };

  return (
    <PageShell title="Partner Pipeline" subtitle="Rekruttering av nye partnere">
      <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-4 scrollbar-thin">
        {pipelineStatuses.map(stage => {
          const stagePartners = partnere.filter(p => p.pipeline_status === stage);
          return (
            <div key={stage} className={`${isMobile ? "min-w-[240px] w-[240px]" : "min-w-[280px] w-[280px]"} flex-shrink-0`}
              onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
              onDrop={e => handleDrop(e, stage)}>
              <div className="mb-3 flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${stageColors[stage]}`} />
                <h3 className="font-semibold text-xs sm:text-sm">{stage}</h3>
                <span className="text-xs text-muted-foreground ml-auto">{stagePartners.length}</span>
              </div>
              <div className="space-y-2.5">
                {stagePartners.map(partner => (
                  <div key={partner.id} draggable onDragStart={e => { setDraggedId(partner.id); e.dataTransfer.effectAllowed = "move"; }}
                    onClick={() => navigate(`/partnere/${partner.id}`)}
                    className="bg-card border rounded-lg p-3 sm:p-3.5 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow group">
                    <div className="flex items-start gap-2">
                      {!isMobile && <GripVertical className="w-4 h-4 text-muted-foreground/40 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{partner.partnernavn}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{partner.kontaktperson}</p>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <Badge variant="secondary" className="text-[10px]">{partner.partnertype}</Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {stagePartners.length === 0 && (
                  <div className="border-2 border-dashed rounded-lg p-6 text-center text-xs text-muted-foreground">Dra hit</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </PageShell>
  );
}
