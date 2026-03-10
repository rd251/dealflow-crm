import { useState } from "react";
import PageShell from "@/components/PageShell";
import { useCrmStore } from "@/hooks/use-crm-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Search } from "lucide-react";
import { Company, Segment, CustomerStatus } from "@/data/crm-data";

const statusStyles: Record<CustomerStatus, string> = {
  Lead: "bg-stage-new-lead/10 text-stage-new-lead",
  Prospect: "bg-stage-contacted/10 text-stage-contacted",
  "Not Live": "bg-muted text-muted-foreground",
  Live: "bg-success/10 text-success",
  Cancelled: "bg-destructive/10 text-destructive",
};

export default function Companies() {
  const { companies, updateCompanies } = useCrmStore();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: "", useCase: "", segment: "SMB" as Segment, status: "Not Live" as CustomerStatus, pricePerMonth: 0, setupFee: 0 });

  const filtered = companies.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) || c.useCase.toLowerCase().includes(search.toLowerCase())
  );

  const addCompany = () => {
    const id = `ACC-${String(companies.length + 1).padStart(4, "0")}`;
    const newCompany: Company = {
      id, ...form, contactCount: 0, baseMRR: form.pricePerMonth,
      liveMRR: form.status === "Live" ? form.pricePerMonth : 0,
      arr: form.status === "Live" ? form.pricePerMonth * 12 : 0, notes: "",
    };
    updateCompanies(prev => [...prev, newCompany]);
    setDialogOpen(false);
    setForm({ name: "", useCase: "", segment: "SMB", status: "Not Live", pricePerMonth: 0, setupFee: 0 });
  };

  return (
    <PageShell
      title="Companies"
      subtitle={`${companies.length} companies`}
      actions={
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" />Add Company</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Company</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Company name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              <Input placeholder="Use case" value={form.useCase} onChange={e => setForm(f => ({ ...f, useCase: e.target.value }))} />
              <div className="grid grid-cols-2 gap-3">
                <select className="border rounded-lg px-3 py-2 text-sm bg-background" value={form.segment} onChange={e => setForm(f => ({ ...f, segment: e.target.value as Segment }))}>
                  {(["SMB", "Enterprise", "Partner", "Restaurant", "Helse", "Kommune"] as Segment[]).map(s => <option key={s}>{s}</option>)}
                </select>
                <select className="border rounded-lg px-3 py-2 text-sm bg-background" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as CustomerStatus }))}>
                  {(["Lead", "Prospect", "Not Live", "Live", "Cancelled"] as CustomerStatus[]).map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input type="number" placeholder="MRR (NOK)" value={form.pricePerMonth || ""} onChange={e => setForm(f => ({ ...f, pricePerMonth: Number(e.target.value) }))} />
                <Input type="number" placeholder="Setup fee" value={form.setupFee || ""} onChange={e => setForm(f => ({ ...f, setupFee: Number(e.target.value) }))} />
              </div>
              <Button onClick={addCompany} className="w-full" disabled={!form.name}>Create Company</Button>
            </div>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="mb-4 relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search companies..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div className="bg-card border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-4 py-3 font-medium">Company</th>
              <th className="text-left px-4 py-3 font-medium">Use Case</th>
              <th className="text-left px-4 py-3 font-medium">Segment</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-right px-4 py-3 font-medium">MRR</th>
              <th className="text-right px-4 py-3 font-medium">ARR</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => (
              <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 font-medium">{c.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{c.useCase}</td>
                <td className="px-4 py-3"><span className="text-xs bg-secondary px-2 py-0.5 rounded-full">{c.segment}</span></td>
                <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusStyles[c.status]}`}>{c.status}</span></td>
                <td className="px-4 py-3 text-right font-mono">{c.liveMRR.toLocaleString("no-NO")}</td>
                <td className="px-4 py-3 text-right font-mono">{c.arr.toLocaleString("no-NO")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}
