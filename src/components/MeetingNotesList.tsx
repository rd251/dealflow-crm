import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Users, Clock, FileText, Save, ChevronDown, ChevronUp, NotebookPen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const API_URL = import.meta.env.VITE_SUPABASE_URL + '/rest/v1';
const API_HEADERS = {
  'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
  'Content-Type': 'application/json',
};

interface MeetingNote {
  id: string;
  tittel: string | null;
  beskrivelse: string;
  moetenotater: string | null;
  dato: string;
  start_tid: string | null;
}

interface MeetingNotesListProps {
  salgsmulighet_id?: string;
  selskap_id?: string;
  lead_id?: string;
  partner_id?: string;
}

export default function MeetingNotesList({ salgsmulighet_id, selskap_id, lead_id, partner_id }: MeetingNotesListProps) {
  const [meetings, setMeetings] = useState<MeetingNote[]>([]);
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingNote | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchMeetings = useCallback(async () => {
    const filters: string[] = ["type=eq.Møte"];
    if (salgsmulighet_id) filters.push(`salgsmulighet_id=eq.${salgsmulighet_id}`);
    else if (selskap_id) filters.push(`selskap_id=eq.${selskap_id}`);
    else if (lead_id) filters.push(`lead_id=eq.${lead_id}`);
    else if (partner_id) filters.push(`partner_id=eq.${partner_id}`);
    else return;

    try {
      const res = await fetch(
        `${API_URL}/aktiviteter?${filters.join("&")}&order=dato.desc&select=id,tittel,beskrivelse,moetenotater,dato,start_tid`,
        { headers: API_HEADERS }
      );
      if (res.ok) setMeetings(await res.json());
    } catch (e) {
      console.error("Error fetching meeting notes:", e);
    }
  }, [salgsmulighet_id, selskap_id, lead_id, partner_id]);

  useEffect(() => { fetchMeetings(); }, [fetchMeetings]);

  const saveNotes = async () => {
    if (!selectedMeeting) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/aktiviteter?id=eq.${selectedMeeting.id}`, {
        method: 'PATCH',
        headers: { ...API_HEADERS, 'Prefer': 'return=minimal' },
        body: JSON.stringify({ moetenotater: notes }),
      });
      if (res.ok) {
        toast.success("Møtenotater lagret");
        setMeetings(prev => prev.map(m => m.id === selectedMeeting.id ? { ...m, moetenotater: notes } : m));
        setSelectedMeeting(null);
      }
    } catch {
      toast.error("Kunne ikke lagre notater");
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString("no-NO", { day: "numeric", month: "short" });
  const formatTime = (d: string | null) => d ? new Date(d).toLocaleTimeString("no-NO", { hour: "2-digit", minute: "2-digit" }) : null;

  if (meetings.length === 0) return null;

  return (
    <div className="border-t pt-3 space-y-2">
      <div className="flex items-center gap-2">
        <NotebookPen className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Møtenotater</span>
      </div>

      <div className="space-y-1.5">
        {meetings.map(m => {
          const hasNotes = !!m.moetenotater?.trim();
          const isExpanded = expandedId === m.id;
          return (
            <div key={m.id} className="rounded-md border bg-card">
              <div className="px-3 py-2 flex items-center gap-2">
                <Users className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span className="text-xs font-medium truncate">{m.tittel || "Møte"}</span>
                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 shrink-0">
                  <Clock className="w-2.5 h-2.5" />{formatDate(m.dato)}
                  {m.start_tid && ` ${formatTime(m.start_tid)}`}
                </span>
                {hasNotes ? (
                  <Badge variant="default" className="text-[9px] px-1 py-0 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-0 ml-auto shrink-0">
                    <FileText className="w-2.5 h-2.5" />
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[9px] px-1 py-0 text-muted-foreground ml-auto shrink-0">—</Badge>
                )}
                {hasNotes && (
                  <button className="p-0.5 rounded hover:bg-muted shrink-0" onClick={() => setExpandedId(isExpanded ? null : m.id)}>
                    {isExpanded ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
                  </button>
                )}
                <button className="text-[10px] text-primary hover:underline shrink-0" onClick={() => { setSelectedMeeting(m); setNotes(m.moetenotater || ""); }}>
                  {hasNotes ? "Rediger" : "+ Notat"}
                </button>
              </div>
              {isExpanded && hasNotes && (
                <div className="px-3 pb-2">
                  <p className="text-xs text-muted-foreground whitespace-pre-line bg-muted/50 rounded p-2">{m.moetenotater}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Dialog open={!!selectedMeeting} onOpenChange={open => !open && setSelectedMeeting(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">Møtenotater – {selectedMeeting?.tittel || "Møte"}</DialogTitle>
            <DialogDescription className="text-xs">
              {selectedMeeting && formatDate(selectedMeeting.dato)}
              {selectedMeeting?.start_tid && ` kl. ${formatTime(selectedMeeting.start_tid)}`}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Skriv detaljerte møtenotater..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={8}
            autoFocus
          />
          <Button onClick={saveNotes} className="w-full gap-2" size="sm" disabled={saving}>
            <Save className="w-3.5 h-3.5" />
            {saving ? "Lagrer..." : "Lagre"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
