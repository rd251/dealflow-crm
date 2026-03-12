import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Phone, Mail, MessageSquare, MessageCircle, Users, FileText, Plus, Clock, MoreHorizontal, Pencil, Trash2 } from "lucide-react";

const API_URL = import.meta.env.VITE_SUPABASE_URL + '/rest/v1';
const API_HEADERS = {
  'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
  'Content-Type': 'application/json',
};

export type AktivitetType = "Telefonsamtale" | "E-post" | "LinkedIn-melding" | "SMS" | "Møte" | "Notat";

interface Aktivitet {
  id: string;
  type: AktivitetType;
  beskrivelse: string;
  dato: string;
}

export const typeIcons: Record<AktivitetType, typeof Phone> = {
  "Telefonsamtale": Phone,
  "E-post": Mail,
  "LinkedIn-melding": MessageSquare,
  "SMS": MessageCircle,
  "Møte": Users,
  "Notat": FileText,
};

export const typeColors: Record<AktivitetType, string> = {
  "Telefonsamtale": "text-emerald-600 bg-emerald-500/10",
  "E-post": "text-blue-600 bg-blue-500/10",
  "LinkedIn-melding": "text-sky-600 bg-sky-500/10",
  "SMS": "text-violet-600 bg-violet-500/10",
  "Møte": "text-amber-600 bg-amber-500/10",
  "Notat": "text-muted-foreground bg-muted",
};

export const typeOptions: AktivitetType[] = ["Telefonsamtale", "E-post", "LinkedIn-melding", "SMS", "Møte", "Notat"];

interface ActivityLogProps {
  lead_id?: string;
  salgsmulighet_id?: string;
  selskap_id?: string;
  partner_id?: string;
  prosjekt_id?: string;
  kontakt_id?: string;
  onActivityLogged?: () => void;
}

export default function ActivityLog(props: ActivityLogProps) {
  const [aktiviteter, setAktiviteter] = useState<Aktivitet[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [type, setType] = useState<AktivitetType>("Telefonsamtale");
  const [beskrivelse, setBeskrivelse] = useState("");
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const buildFilter = useCallback(() => {
    const filters: string[] = [];
    if (props.lead_id) filters.push(`lead_id=eq.${props.lead_id}`);
    if (props.salgsmulighet_id) filters.push(`salgsmulighet_id=eq.${props.salgsmulighet_id}`);
    if (props.selskap_id) filters.push(`selskap_id=eq.${props.selskap_id}`);
    if (props.partner_id) filters.push(`partner_id=eq.${props.partner_id}`);
    if (props.prosjekt_id) filters.push(`prosjekt_id=eq.${props.prosjekt_id}`);
    if (props.kontakt_id) filters.push(`kontakt_id=eq.${props.kontakt_id}`);
    return filters.join("&");
  }, [props.lead_id, props.salgsmulighet_id, props.selskap_id, props.partner_id, props.prosjekt_id, props.kontakt_id]);

  const fetchAktiviteter = useCallback(async () => {
    const filter = buildFilter();
    if (!filter) return;
    try {
      const res = await fetch(`${API_URL}/aktiviteter?${filter}&order=dato.desc&select=id,type,beskrivelse,dato`, { headers: API_HEADERS });
      if (res.ok) setAktiviteter(await res.json());
    } catch (e) {
      console.error("Error fetching aktiviteter:", e);
    }
  }, [buildFilter]);

  useEffect(() => { fetchAktiviteter(); }, [fetchAktiviteter]);

  const openCreate = () => {
    setEditingId(null);
    setType("Telefonsamtale");
    setBeskrivelse("");
    setDialogOpen(true);
  };

  const openEdit = (a: Aktivitet) => {
    setEditingId(a.id);
    setType(a.type);
    setBeskrivelse(a.beskrivelse);
    setDialogOpen(true);
  };

  const saveAktivitet = async () => {
    if (!beskrivelse.trim()) return;
    setLoading(true);
    try {
      if (editingId) {
        await fetch(`${API_URL}/aktiviteter?id=eq.${editingId}`, {
          method: 'PATCH',
          headers: { ...API_HEADERS, 'Prefer': 'return=minimal' },
          body: JSON.stringify({ type, beskrivelse: beskrivelse.trim() }),
        });
      } else {
        const body: Record<string, any> = { type, beskrivelse: beskrivelse.trim() };
        if (props.lead_id) body.lead_id = props.lead_id;
        if (props.salgsmulighet_id) body.salgsmulighet_id = props.salgsmulighet_id;
        if (props.selskap_id) body.selskap_id = props.selskap_id;
        if (props.partner_id) body.partner_id = props.partner_id;
        if (props.prosjekt_id) body.prosjekt_id = props.prosjekt_id;
        if (props.kontakt_id) body.kontakt_id = props.kontakt_id;
        await fetch(`${API_URL}/aktiviteter`, {
          method: 'POST',
          headers: { ...API_HEADERS, 'Prefer': 'return=minimal' },
          body: JSON.stringify(body),
        });
        props.onActivityLogged?.();
      }
      await fetchAktiviteter();
      setBeskrivelse("");
      setType("Telefonsamtale");
      setEditingId(null);
      setDialogOpen(false);
    } catch (e) {
      console.error("Error saving aktivitet:", e);
    } finally {
      setLoading(false);
    }
  };

  const deleteAktivitet = async () => {
    if (!deleteId) return;
    try {
      await fetch(`${API_URL}/aktiviteter?id=eq.${deleteId}`, {
        method: 'DELETE',
        headers: { ...API_HEADERS, 'Prefer': 'return=minimal' },
      });
      await fetchAktiviteter();
      setDeleteId(null);
    } catch (e) {
      console.error("Error deleting aktivitet:", e);
    }
  };

  const formatDato = (d: string) => {
    const date = new Date(d);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "Nå";
    if (diffMin < 60) return `${diffMin} min siden`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}t siden`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return `${diffD}d siden`;
    return date.toLocaleDateString("no-NO", { day: "numeric", month: "short" });
  };

  return (
    <div className="border-t pt-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Aktivitetslogg</span>
        <Button size="sm" variant="outline" className="text-xs h-7 gap-1" onClick={openCreate}>
          <Plus className="w-3 h-3" /> Logg aktivitet
        </Button>
      </div>

      {aktiviteter.length === 0 ? (
        <p className="text-xs text-muted-foreground italic py-2">Ingen aktiviteter registrert</p>
      ) : (
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {aktiviteter.map(a => {
            const Icon = typeIcons[a.type] || FileText;
            return (
              <div key={a.id} className="flex items-start gap-2.5 py-1.5 group">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${typeColors[a.type]}`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium">{a.type}</span>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />{formatDato(a.dato)}</span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted">
                          <MoreHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-32">
                        <DropdownMenuItem onClick={() => openEdit(a)} className="text-xs gap-2">
                          <Pencil className="w-3 h-3" /> Rediger
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setDeleteId(a.id)} className="text-xs gap-2 text-destructive focus:text-destructive">
                          <Trash2 className="w-3 h-3" /> Slett
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-line">{a.beskrivelse}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Rediger aktivitet" : "Logg aktivitet"}</DialogTitle>
            <DialogDescription>{editingId ? "Endre type eller beskrivelse" : "Registrer en ny aktivitet"}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-1.5">
              {typeOptions.map(t => {
                const TIcon = typeIcons[t];
                return (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-xs transition-colors ${
                      type === t ? "border-primary bg-primary/5 text-primary font-medium" : "border-border hover:bg-muted/50 text-muted-foreground"
                    }`}
                  >
                    <TIcon className="w-4 h-4" />
                    <span className="text-[10px] leading-tight text-center">{t}</span>
                  </button>
                );
              })}
            </div>
            <Textarea
              placeholder="Beskriv aktiviteten..."
              value={beskrivelse}
              onChange={e => setBeskrivelse(e.target.value)}
              rows={3}
              autoFocus
            />
            <Button onClick={saveAktivitet} className="w-full" disabled={!beskrivelse.trim() || loading}>
              {loading ? "Lagrer..." : editingId ? "Lagre endringer" : "Logg aktivitet"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slett aktivitet</AlertDialogTitle>
            <AlertDialogDescription>Er du sikker på at du vil slette denne aktiviteten? Dette kan ikke angres.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={deleteAktivitet} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Slett</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
