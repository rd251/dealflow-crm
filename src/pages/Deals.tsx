import { useState } from "react";
import PageShell from "@/components/PageShell";
import { useCrmStore } from "@/hooks/use-crm-store";
import DealCard from "@/components/DealCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { Deal, DealStage, Segment } from "@/data/crm-data";

const stages: DealStage[] = ["New Lead", "Contacted", "Proposal Sent", "Won", "Lost"];

const stageHeaderColors: Record<DealStage, string> = {
  "New Lead": "bg-stage-new-lead",
  "Contacted": "bg-stage-contacted",
  "Proposal Sent": "bg-stage-proposal",
  "Won": "bg-stage-won",
  "Lost": "bg-stage-lost",
};

export default function Deals() {
  const { deals, companies, moveDealStage, updateDeals } = useCrmStore();
  const [draggedDeal, setDraggedDeal] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [form, setForm] = useState({ companyId: "", useCase: "", segment: "SMB" as Segment, expectedMRR: 0, probability: 50 });

  const handleDragStart = (e: React.DragEvent, dealId: string) => {
    setDraggedDeal(dealId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, stage: DealStage) => {
    e.preventDefault();
    if (draggedDeal) {
      moveDealStage(draggedDeal, stage);
      setDraggedDeal(null);
    }
  };

  const addDeal = () => {
    const company = companies.find(c => c.id === form.companyId);
    if (!company) return;
    const id = `DEAL-${String(deals.length + 1).padStart(4, "0")}`;
    const newDeal: Deal = {
      id, companyId: form.companyId, companyName: company.name, useCase: form.useCase,
      segment: form.segment, stage: "New Lead", probability: form.probability,
      expectedMRR: form.expectedMRR, weightedMRR: Math.round(form.expectedMRR * form.probability / 100),
      expectedCloseDate: "", status: "Open", priority: "Normal",
      lastUpdated: new Date().toISOString().split("T")[0], notes: "",
    };
    updateDeals(prev => [...prev, newDeal]);
    setDialogOpen(false);
    setForm({ companyId: "", useCase: "", segment: "SMB", expectedMRR: 0, probability: 50 });
  };

  return (
    <PageShell
      title="Deal Pipeline"
      subtitle={`${deals.filter(d => d.status === "Open").length} open deals`}
      actions={
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" />New Deal</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Deal</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <select className="w-full border rounded-lg px-3 py-2 text-sm bg-background" value={form.companyId} onChange={e => setForm(f => ({ ...f, companyId: e.target.value }))}>
                <option value="">Select company</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <Input placeholder="Use case" value={form.useCase} onChange={e => setForm(f => ({ ...f, useCase: e.target.value }))} />
              <div className="grid grid-cols-2 gap-3">
                <Input type="number" placeholder="Expected MRR" value={form.expectedMRR || ""} onChange={e => setForm(f => ({ ...f, expectedMRR: Number(e.target.value) }))} />
                <Input type="number" placeholder="Probability %" value={form.probability || ""} onChange={e => setForm(f => ({ ...f, probability: Number(e.target.value) }))} />
              </div>
              <Button onClick={addDeal} className="w-full" disabled={!form.companyId}>Create Deal</Button>
            </div>
          </DialogContent>
        </Dialog>
      }
    >
      {/* Deal detail dialog */}
      <Dialog open={!!selectedDeal} onOpenChange={(open) => !open && setSelectedDeal(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{selectedDeal?.companyName}</DialogTitle></DialogHeader>
          {selectedDeal && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground">Use Case:</span> {selectedDeal.useCase}</div>
                <div><span className="text-muted-foreground">Segment:</span> {selectedDeal.segment}</div>
                <div><span className="text-muted-foreground">Stage:</span> {selectedDeal.stage}</div>
                <div><span className="text-muted-foreground">Probability:</span> {selectedDeal.probability}%</div>
                <div><span className="text-muted-foreground">Expected MRR:</span> {selectedDeal.expectedMRR.toLocaleString("no-NO")} NOK</div>
                <div><span className="text-muted-foreground">Weighted MRR:</span> {selectedDeal.weightedMRR.toLocaleString("no-NO")} NOK</div>
              </div>
              {selectedDeal.notes && <p className="text-muted-foreground italic">{selectedDeal.notes}</p>}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin">
        {stages.map(stage => {
          const stageDeals = deals.filter(d => d.stage === stage);
          const stageValue = stageDeals.reduce((s, d) => s + d.expectedMRR, 0);
          return (
            <div
              key={stage}
              className="min-w-[280px] w-[280px] flex-shrink-0"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, stage)}
            >
              <div className="mb-3 flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${stageHeaderColors[stage]}`} />
                <h3 className="font-semibold text-sm">{stage}</h3>
                <span className="text-xs text-muted-foreground ml-auto">{stageDeals.length}</span>
              </div>
              <p className="text-xs text-muted-foreground mb-3 font-mono">{stageValue.toLocaleString("no-NO")} NOK</p>
              <div className="space-y-2.5">
                {stageDeals.map(deal => (
                  <DealCard key={deal.id} deal={deal} onDragStart={handleDragStart} onClick={() => setSelectedDeal(deal)} />
                ))}
                {stageDeals.length === 0 && (
                  <div className="border-2 border-dashed rounded-lg p-6 text-center text-xs text-muted-foreground">
                    Drop deals here
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </PageShell>
  );
}
