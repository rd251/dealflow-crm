import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Phone, Mail, MessageSquare, MessageCircle, Users, FileText, Plus, Clock, MoreHorizontal, Pencil, Trash2, X, Reply, Sparkles, FileSearch, PenLine, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import MeetingFields from "@/components/MeetingFields";
import SendEmailDialog from "@/components/SendEmailDialog";
import { useAuth } from "@/hooks/use-auth";

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
  tittel?: string;
  aktivitet_kilde?: string;
  ekstern_provider?: string;
  user_id?: string;
}

interface UserProfile {
  user_id: string;
  display_name: string;
}

const USER_COLORS = [
  "bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500",
  "bg-violet-500", "bg-cyan-500", "bg-pink-500", "bg-indigo-500",
];
const getUserColor = (userId: string) => {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length];
};

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

interface KontaktOption {
  id: string;
  navn: string;
}

interface ActivityLogProps {
  lead_id?: string;
  salgsmulighet_id?: string;
  selskap_id?: string;
  partner_id?: string;
  prosjekt_id?: string;
  kontakt_id?: string;
  email?: string;
  onActivityLogged?: () => void;
  kontaktListe?: KontaktOption[];
  entityName?: string;
  kontaktperson?: string;
}

export default function ActivityLog(props: ActivityLogProps) {
  const { user } = useAuth();
  const [aktiviteter, setAktiviteter] = useState<Aktivitet[]>([]);
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [type, setType] = useState<AktivitetType>("Telefonsamtale");
  const [beskrivelse, setBeskrivelse] = useState("");
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewingEmail, setViewingEmail] = useState<Aktivitet | null>(null);
  const [meetingTittel, setMeetingTittel] = useState("");
  const [meetingDato, setMeetingDato] = useState("");
  const [meetingStartTid, setMeetingStartTid] = useState("");
  const [meetingSluttTid, setMeetingSluttTid] = useState("");
  const [meetingDeltakere, setMeetingDeltakere] = useState<string[]>([]);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyTo, setReplyTo] = useState("");
  const [replySubject, setReplySubject] = useState("");
  const [replyDefaultBody, setReplyDefaultBody] = useState("");
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<{ type: string; content: string } | null>(null);

  const buildFilter = useCallback(() => {
    const filters: string[] = [];
    if (props.lead_id) filters.push(`lead_id=eq.${props.lead_id}`);
    if (props.salgsmulighet_id) filters.push(`salgsmulighet_id=eq.${props.salgsmulighet_id}`);
    if (props.selskap_id) filters.push(`selskap_id=eq.${props.selskap_id}`);
    if (props.partner_id) filters.push(`partner_id=eq.${props.partner_id}`);
    if (props.prosjekt_id) filters.push(`prosjekt_id=eq.${props.prosjekt_id}`);
    if (props.kontakt_id) filters.push(`kontakt_id=eq.${props.kontakt_id}`);
    if (props.email) filters.push(`beskrivelse=ilike.*${encodeURIComponent(props.email)}*`);
    return filters.join("&");
  }, [props.lead_id, props.salgsmulighet_id, props.selskap_id, props.partner_id, props.prosjekt_id, props.kontakt_id, props.email]);

  const fetchAktiviteter = useCallback(async () => {
    const filter = buildFilter();
    if (!filter) return;
    try {
      const res = await fetch(`${API_URL}/aktiviteter?${filter}&order=dato.desc&select=id,type,beskrivelse,dato,tittel,aktivitet_kilde,ekstern_provider,user_id`, { headers: API_HEADERS });
      if (res.ok) setAktiviteter(await res.json());
    } catch (e) {
      console.error("Error fetching aktiviteter:", e);
    }
  }, [buildFilter]);

  useEffect(() => { fetchAktiviteter(); }, [fetchAktiviteter]);

  useEffect(() => {
    fetch(`${API_URL}/profiles?select=user_id,display_name`, { headers: API_HEADERS })
      .then(r => r.ok ? r.json() : [])
      .then((data: UserProfile[]) => {
        const map: Record<string, UserProfile> = {};
        data.forEach(p => { map[p.user_id] = p; });
        setProfiles(map);
      })
      .catch(() => {});
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setType("Telefonsamtale");
    setBeskrivelse("");
    setMeetingTittel("");
    setMeetingDato(new Date().toISOString().split("T")[0]);
    setMeetingStartTid("09:00");
    setMeetingSluttTid("10:00");
    setMeetingDeltakere([]);
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
      const meetingData: Record<string, any> = {};
      if (type === "Møte") {
        meetingData.tittel = meetingTittel.trim();
        if (meetingDato && meetingStartTid) {
          meetingData.start_tid = `${meetingDato}T${meetingStartTid}:00`;
        }
        if (meetingDato && meetingSluttTid) {
          meetingData.slutt_tid = `${meetingDato}T${meetingSluttTid}:00`;
        }
        if (meetingDeltakere.length > 0) {
          meetingData.deltakere = meetingDeltakere;
        }
      }

      if (editingId) {
        await fetch(`${API_URL}/aktiviteter?id=eq.${editingId}`, {
          method: 'PATCH',
          headers: { ...API_HEADERS, 'Prefer': 'return=minimal' },
          body: JSON.stringify({ type, beskrivelse: beskrivelse.trim(), ...meetingData }),
        });
      } else {
        const body: Record<string, any> = { type, beskrivelse: beskrivelse.trim(), ...meetingData, user_id: user?.id || null };
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

  const handleThreadAi = async (action: "summarize" | "extract" | "draft") => {
    if (!viewingEmail) return;
    // Extract threadId from beskrivelse — gmail-sync stores it as [threadId:xxx]
    const threadMatch = viewingEmail.beskrivelse.match(/\[threadId:([^\]]+)\]/);
    // Fallback: use ekstern_id
    const threadId = threadMatch?.[1] || viewingEmail.id;

    // For draft, we need the ekstern_id which is the Gmail message id
    // The threadId for Gmail is typically the first message id in the thread
    // We'll try ekstern_id first as it's more reliable
    const gmailThreadId = threadMatch?.[1];
    if (!gmailThreadId) {
      toast.error("Kunne ikke finne tråd-ID for denne e-posten. Tråd-AI krever en synkronisert Gmail-melding.");
      return;
    }

    setAiLoading(action);
    setAiResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("gmail-thread-ai", {
        body: { threadId: gmailThreadId, action },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (action === "draft") {
        const subject = viewingEmail.tittel || '';
        setReplyTo(props.email || '');
        setReplySubject(subject.startsWith('Re: ') ? subject : `Re: ${subject}`);
        setReplyDefaultBody(data.result);
        setViewingEmail(null);
        setReplyOpen(true);
      } else {
        setAiResult({ type: action, content: data.result });
      }
    } catch (e: any) {
      toast.error(e?.message || "AI-analyse feilet");
    } finally {
      setAiLoading(null);
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
            const isGmail = a.ekstern_provider === 'gmail';
            const isSent = a.aktivitet_kilde === 'gmail_sendt';
            const isExternal = a.ekstern_provider === 'gmail' || a.ekstern_provider === 'google_calendar';
            const displayTitle = a.tittel || a.type;
            return (
              <div
                key={a.id}
                className={`flex items-start gap-2.5 py-1.5 group ${isGmail ? 'cursor-pointer rounded-md hover:bg-muted/50 px-1 -mx-1 transition-colors' : ''}`}
                onClick={() => { if (isGmail) setViewingEmail(a); }}
              >
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${typeColors[a.type]}`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium">{displayTitle}</span>
                    {isGmail && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isSent ? 'bg-blue-500/10 text-blue-600' : 'bg-emerald-500/10 text-emerald-600'}`}>
                        {isSent ? 'Sendt' : 'Mottatt'}
                      </span>
                    )}
                    {isExternal && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                        {a.ekstern_provider === 'gmail' ? 'Gmail' : 'GCal'}
                      </span>
                    )}
                    {a.user_id && profiles[a.user_id] && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-bold text-white shrink-0 ${getUserColor(a.user_id)}`}>
                            {profiles[a.user_id].display_name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase()}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">
                          {profiles[a.user_id].display_name}
                        </TooltipContent>
                      </Tooltip>
                    )}
                    <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />{formatDato(a.dato)}</span>
                    {!isExternal && (
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
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-line line-clamp-2">{a.beskrivelse}</p>
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
            {type === "Møte" && (
              <MeetingFields
                tittel={meetingTittel}
                dato={meetingDato}
                startTid={meetingStartTid}
                sluttTid={meetingSluttTid}
                onTittelChange={setMeetingTittel}
                onDatoChange={setMeetingDato}
                onStartTidChange={setMeetingStartTid}
                onSluttTidChange={setMeetingSluttTid}
                deltakere={meetingDeltakere}
                onDeltakereChange={setMeetingDeltakere}
                kontaktListe={props.kontaktListe}
              />
            )}
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

      {/* Email Viewer Dialog */}
      <Dialog open={!!viewingEmail} onOpenChange={open => { if (!open) { setViewingEmail(null); setAiResult(null); } }}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl p-0 gap-0 max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader className="sr-only">
            <DialogTitle>Vis e-post</DialogTitle>
            <DialogDescription>E-postvisning</DialogDescription>
          </DialogHeader>
          {(() => {
            if (!viewingEmail) return null;
            const isSent = viewingEmail.aktivitet_kilde === 'gmail_sendt';
            const rawDesc = viewingEmail.beskrivelse || '';
            // Extract email addresses from [xxx@yyy.zz] tags
            const emailTags = rawDesc.match(/\[[^\]]+@[^\]]+\]/g) || [];
            const addresses = emailTags.map(t => t.slice(1, -1));
            // Clean body: remove [threadId:...] and [email] tags
            const cleanBody = rawDesc
              .replace(/\[threadId:[^\]]+\]\s*/g, '')
              .replace(/\[[^\]]+@[^\]]+\]\s*/g, '')
              .trim();
            const subject = viewingEmail.tittel || 'E-post';
            const dateStr = new Date(viewingEmail.dato).toLocaleDateString("no-NO", {
              day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
            });

            return (
              <>
                {/* Header */}
                <div className="px-5 pt-5 pb-3 border-b space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-base font-semibold leading-snug flex-1">{subject}</h2>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 ${isSent ? 'bg-blue-500/10 text-blue-600' : 'bg-emerald-500/10 text-emerald-600'}`}>
                      {isSent ? 'Sendt' : 'Mottatt'}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Mail className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      {addresses.length > 0 ? (
                        <div className="space-y-0.5">
                          <p className="text-sm font-medium truncate">{addresses[0]}</p>
                          {addresses.length > 1 && (
                            <p className="text-xs text-muted-foreground truncate">
                              {isSent ? 'Til' : 'Til'}: {addresses.slice(1).join(', ')}
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm font-medium">
                          {isSent ? 'Sendt e-post' : 'Mottatt e-post'}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{dateStr}</span>
                  </div>
                </div>

                {/* Body */}
                <ScrollArea className="flex-1 min-h-0 px-5 py-4">
                  <p className="text-sm whitespace-pre-line leading-relaxed">{cleanBody}</p>
                </ScrollArea>

                {/* AI Result */}
                {aiResult && (
                  <div className="mx-5 border rounded-lg p-3 bg-muted/30 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        {aiResult.type === 'summarize' ? '✨ AI-oppsummering' : '🔍 Viktig informasjon'}
                      </span>
                      <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => setAiResult(null)}>
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                    <ScrollArea className="max-h-[20vh]">
                      <p className="text-xs whitespace-pre-line leading-relaxed">{aiResult.content}</p>
                    </ScrollArea>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-1.5 px-5 py-3 border-t flex-wrap">
                  <Button size="sm" variant="outline" className="gap-1.5 text-xs" disabled={!!aiLoading} onClick={() => handleThreadAi("summarize")}>
                    {aiLoading === "summarize" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    Oppsummer
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5 text-xs" disabled={!!aiLoading} onClick={() => handleThreadAi("extract")}>
                    {aiLoading === "extract" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSearch className="w-3.5 h-3.5" />}
                    Viktig info
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5 text-xs" disabled={!!aiLoading} onClick={() => handleThreadAi("draft")}>
                    {aiLoading === "draft" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PenLine className="w-3.5 h-3.5" />}
                    Skriv utkast
                  </Button>
                  <div className="flex-1" />
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => {
                    const s = viewingEmail?.tittel || '';
                    setReplyTo(props.email || '');
                    setReplySubject(s.startsWith('Re: ') ? s : `Re: ${s}`);
                    setReplyDefaultBody("");
                    setViewingEmail(null);
                    setReplyOpen(true);
                  }}>
                    <Reply className="w-3.5 h-3.5" /> Svar
                  </Button>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Reply Email Dialog */}
      {replyOpen && (
        <SendEmailDialog
          open={replyOpen}
          onOpenChange={setReplyOpen}
          defaultTo={replyTo}
          defaultSubject={replySubject}
          defaultBody={replyDefaultBody}
          context={{
            entityType: props.lead_id ? "lead" : props.salgsmulighet_id ? "salgsmulighet" : "lead",
            entityId: props.lead_id || props.salgsmulighet_id || props.selskap_id || '',
            selskapNavn: props.entityName || '',
            kontaktperson: props.kontaktperson,
            selskapId: props.selskap_id,
            kontaktId: props.kontakt_id,
          }}
          onSent={() => {
            setReplyOpen(false);
            fetchAktiviteter();
            props.onActivityLogged?.();
          }}
        />
      )}

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
