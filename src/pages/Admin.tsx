import { useState, useEffect } from "react";
import PageShell from "@/components/PageShell";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Shield, User, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TeamMember {
  user_id: string;
  display_name: string;
  email: string;
  role: "admin" | "user";
}

export default function Admin() {
  const { isAdmin, inviteUser } = useAuth();
  const { toast } = useToast();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", displayName: "" });
  const [loading, setLoading] = useState(false);

  const fetchMembers = async () => {
    const { data: profiles } = await supabase.from("profiles").select("user_id, display_name, email");
    const { data: roles } = await supabase.from("user_roles").select("user_id, role");
    if (profiles && roles) {
      const roleMap = new Map(roles.map(r => [r.user_id, r.role as "admin" | "user"]));
      setMembers(profiles.map(p => ({
        user_id: p.user_id,
        display_name: p.display_name,
        email: p.email,
        role: roleMap.get(p.user_id) || "user",
      })));
    }
  };

  useEffect(() => { fetchMembers(); }, []);

  const handleInvite = async () => {
    setLoading(true);
    const { error } = await inviteUser(form.email, form.password, form.displayName);
    if (error) {
      toast({ title: "Feil", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Bruker opprettet", description: `${form.email} har blitt lagt til.` });
      setDialogOpen(false);
      setForm({ email: "", password: "", displayName: "" });
      setTimeout(fetchMembers, 1000);
    }
    setLoading(false);
  };

  const toggleRole = async (userId: string, currentRole: "admin" | "user") => {
    const newRole = currentRole === "admin" ? "user" : "admin";
    await supabase.from("user_roles").update({ role: newRole }).eq("user_id", userId);
    fetchMembers();
  };

  if (!isAdmin) {
    return <PageShell title="Ingen tilgang" subtitle="Du har ikke tilgang til denne siden." />;
  }

  return (
    <PageShell
      title="Teamadministrasjon"
      subtitle={`${members.length} teammedlemmer`}
      actions={
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" />Inviter bruker</Button>
          </DialogTrigger>
          <DialogContent className="max-w-[95vw] sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Inviter bruker</DialogTitle>
              <DialogDescription>Opprett en ny bruker i teamet.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Visningsnavn" value={form.displayName} onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))} />
              <Input type="email" placeholder="E-post" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              <Input type="password" placeholder="Midlertidig passord" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
              <Button onClick={handleInvite} className="w-full" disabled={loading || !form.email || !form.password}>
                {loading ? "Oppretter..." : "Opprett bruker"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="space-y-2">
        {members.map(m => (
          <div key={m.user_id} className="bg-card border rounded-xl p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
              {m.role === "admin" ? <Shield className="w-4 h-4 text-primary" /> : <User className="w-4 h-4 text-muted-foreground" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{m.display_name}</p>
              <p className="text-xs text-muted-foreground truncate">{m.email}</p>
            </div>
            <Badge variant={m.role === "admin" ? "default" : "secondary"} className="text-xs cursor-pointer" onClick={() => toggleRole(m.user_id, m.role)}>
              {m.role === "admin" ? "Admin" : "Bruker"}
            </Badge>
          </div>
        ))}
      </div>
    </PageShell>
  );
}
