import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Sparkles, Send, Loader2, ListChecks,
  ExternalLink, CheckCircle2, ArrowUp, PhoneCall,
  Mail, Pencil, SkipForward, Clock, ListTodo, X,
  CalendarDays, User, Building2,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

interface AiItem {
  navn: string;
  selskap: string;
  handling: string;
  prioritet: "høy" | "medium" | "lav";
  type: "deal" | "lead" | "meeting" | "task" | "general";
  entityId?: string;
  entityType?: "salgsmulighet" | "lead" | "selskap" | "oppgave";
}

interface SuggestedTask {
  oppgave: string;
  frist?: string;
  prioritet: "Høy" | "Medium" | "Lav";
  salgsmulighet_id?: string;
  selskap_id?: string;
  lead_id?: string;
  auto_create?: boolean;
}

interface SuggestedActivity {
  type: "Telefonsamtale" | "E-post" | "LinkedIn-melding" | "SMS" | "Møte" | "Notat";
  tittel: string;
  beskrivelse: string;
  salgsmulighet_id?: string;
  selskap_id?: string;
  lead_id?: string;
  kontakt_id?: string;
  auto_create?: boolean;
}

interface SuggestedEmail {
  to?: string;
  to_name: string;
  subject: string;
  body: string;
  reason: string;
  entity_id?: string;
  entity_type?: "salgsmulighet" | "lead";
  entity_name?: string;
  selskap_id?: string;
  selskap_navn?: string;
  kontakt_id?: string;
  prioritet: "høy" | "medium" | "lav";
}

interface SuggestedLead {
  firmanavn: string;
  kontaktperson: string;
  e_post?: string;
  telefon?: string;
  kilde?: string;
  notater?: string;
  use_case?: string;
  rolle_i_firma?: string;
  auto_create?: boolean;
}

interface SuggestedMeeting {
  tittel: string;
  deltaker_navn: string;
  deltaker_epost?: string;
  dato: string;
  start_tid: string;
  slutt_tid: string;
  beskrivelse?: string;
  kontakt_id?: string;
  selskap_id?: string;
  salgsmulighet_id?: string;
}

interface SuggestedStatusUpdate {
  entity_type: "salgsmulighet" | "lead";
  entity_id: string;
  entity_name: string;
  new_status: string;
  neste_steg?: string;
  auto_apply?: boolean;
}

interface SuggestedConversion {
  lead_id: string;
  lead_name: string;
  navn: string;
  forventet_mrr?: number;
  kontaktperson?: string;
  e_post?: string;
  telefon?: string;
  use_case?: string;
  auto_apply?: boolean;
}

interface SuggestedCompany {
  firmanavn: string;
  bransje?: string;
  notater?: string;
  auto_create?: boolean;
}

interface SuggestedContact {
  navn: string;
  e_post?: string;
  telefon?: string;
  rolle?: string;
  selskap_id?: string;
  selskap_navn?: string;
  linkedin?: string;
  notater?: string;
  auto_create?: boolean;
}

interface SuggestedRingelisteKontakt {
  navn: string;
  selskap?: string;
  e_post?: string;
  telefon?: string;
  rolle?: string;
  prioritet: "Høy" | "Medium" | "Lav";
  kontakt_id?: string;
  selskap_id?: string;
  salgsmulighet_id?: string;
  lead_id?: string;
  dialog_status: string;
  grunn: string;
}

interface SuggestedRingeliste {
  navn: string;
  segment: string;
  kanal: string;
  kilde_segment: string;
  underkilde?: string;
  notater?: string;
  signal: string;
  kontakter: SuggestedRingelisteKontakt[];
  auto_create?: boolean;
}

interface AiResponse {
  summary: string;
  items: AiItem[];
  suggested_tasks: SuggestedTask[];
  suggested_activities: SuggestedActivity[];
  suggested_emails: SuggestedEmail[];
  suggested_leads?: SuggestedLead[];
  suggested_meeting?: SuggestedMeeting;
  suggested_status_updates?: SuggestedStatusUpdate[];
  suggested_conversions?: SuggestedConversion[];
  suggested_companies?: SuggestedCompany[];
  suggested_contacts?: SuggestedContact[];
  suggested_ringeliste?: SuggestedRingeliste;
}

interface AiCommandBarProps {
  context: any;
  userName?: string;
}

const QUICK_PROMPTS = [
  { icon: "📅", label: "Book møte", prefill: "Møte med [navn] [dato] kl [tid], [e-post], emne [tema]" },
  { icon: "📝", label: "Ny oppgave", prefill: "Opprett oppgave: [beskrivelse], frist [dato], prioritet [høy/medium/lav]" },
  { icon: "📧", label: "Skriv e-post", prefill: "Skriv e-post til [navn/selskap] om [tema]" },
  { icon: "📊", label: "Ukesrapport" },
  { icon: "📋", label: "Prep neste møte" },
  { icon: "🎯", label: "Top 5 prioriteringer" },
  { icon: "📞", label: "Deals som trenger oppfølging" },
  { icon: "📋", label: "Lag ringeliste", prefill: "Lag ringeliste for leads som trenger oppfølging basert på e-posthistorikk" },
];

const prioritetColor: Record<string, string> = {
  "høy": "bg-destructive/10 text-destructive border-destructive/20",
  "medium": "bg-amber-500/10 text-amber-600 border-amber-200",
  "lav": "bg-muted text-muted-foreground border-border",
};

type EmailState = "pending" | "editing" | "sending" | "sent" | "skipped" | "task_created";
type MeetingState = "pending" | "editing" | "creating" | "created";

export default function AiCommandBar({ context, userName }: AiCommandBarProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<AiResponse | null>(null);
  const [creatingTasks, setCreatingTasks] = useState(false);
  const [createdTaskIds, setCreatedTaskIds] = useState<Set<number>>(new Set());
  const [createdActivityIds, setCreatedActivityIds] = useState<Set<number>>(new Set());
  const [appliedStatusIds, setAppliedStatusIds] = useState<Set<number>>(new Set());
  const [appliedConversionIds, setAppliedConversionIds] = useState<Set<number>>(new Set());
  const [createdCompanyIds, setCreatedCompanyIds] = useState<Set<number>>(new Set());
  const [createdContactIds, setCreatedContactIds] = useState<Set<number>>(new Set());
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Email draft states
  const [emailStates, setEmailStates] = useState<Map<number, EmailState>>(new Map());
  const [editingEmails, setEditingEmails] = useState<Map<number, { subject: string; body: string; to: string }>>(new Map());

  // Meeting states
  const [meetingState, setMeetingState] = useState<MeetingState>("pending");
  const [editingMeeting, setEditingMeeting] = useState<SuggestedMeeting | null>(null);
  const [createdMeetingId, setCreatedMeetingId] = useState<string | null>(null);
  const [createdLeadIds, setCreatedLeadIds] = useState<Set<number>>(new Set());
  const [ringelisteState, setRingelisteState] = useState<"pending" | "creating" | "created">("pending");

  const handleSubmit = async (prompt?: string) => {
    const msg = prompt || input.trim();
    if (!msg || loading) return;
    setInput("");
    setLoading(true);
    setResponse(null);
    setCreatedTaskIds(new Set());
    setCreatedActivityIds(new Set());
    setEmailStates(new Map());
    setEditingEmails(new Map());
    setMeetingState("pending");
    setEditingMeeting(null);
    setCreatedMeetingId(null);
    setCreatedLeadIds(new Set());
    setAppliedStatusIds(new Set());
    setAppliedConversionIds(new Set());
    setCreatedCompanyIds(new Set());
    setCreatedContactIds(new Set());
    setRingelisteState("pending");

    try {
      const { data, error } = await supabase.functions.invoke("ai-command", {
        body: { message: msg, context },
      });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }
      const aiData = data as AiResponse;
      setResponse(aiData);

      // Auto-create leads flagged with auto_create
      // Auto-create tasks flagged with auto_create
      if (aiData.suggested_tasks?.length) {
        for (let i = 0; i < aiData.suggested_tasks.length; i++) {
          const task = aiData.suggested_tasks[i];
          if (task.auto_create) {
            handleCreateTask(task, i);
          }
        }
      }

      // Auto-create leads flagged with auto_create
      if (aiData.suggested_leads?.length) {
        for (let i = 0; i < aiData.suggested_leads.length; i++) {
          const lead = aiData.suggested_leads[i];
          if (lead.auto_create) {
            handleCreateLead(lead, i);
          }
        }
      }

      // Auto-create activities flagged with auto_create
      if (aiData.suggested_activities?.length) {
        for (let i = 0; i < aiData.suggested_activities.length; i++) {
          const activity = aiData.suggested_activities[i];
          if (activity.auto_create) {
            handleLogActivity(activity, i);
          }
        }
      }

      // Auto-apply status updates
      if (aiData.suggested_status_updates?.length) {
        for (let i = 0; i < aiData.suggested_status_updates.length; i++) {
          if (aiData.suggested_status_updates[i].auto_apply) {
            handleApplyStatusUpdate(aiData.suggested_status_updates[i], i);
          }
        }
      }

      // Auto-apply conversions
      if (aiData.suggested_conversions?.length) {
        for (let i = 0; i < aiData.suggested_conversions.length; i++) {
          if (aiData.suggested_conversions[i].auto_apply) {
            handleApplyConversion(aiData.suggested_conversions[i], i);
          }
        }
      }

      // Auto-create companies
      if (aiData.suggested_companies?.length) {
        for (let i = 0; i < aiData.suggested_companies.length; i++) {
          if (aiData.suggested_companies[i].auto_create) {
            handleCreateCompany(aiData.suggested_companies[i], i);
          }
        }
      }

      // Auto-create contacts
      if (aiData.suggested_contacts?.length) {
        for (let i = 0; i < aiData.suggested_contacts.length; i++) {
          if (aiData.suggested_contacts[i].auto_create) {
            handleCreateContact(aiData.suggested_contacts[i], i);
          }
        }
      }

      // Auto-create ringeliste
      if (aiData.suggested_ringeliste?.auto_create) {
        handleCreateRingeliste(aiData.suggested_ringeliste);
      }
    } catch (e: any) {
      console.error("AI command error:", e);
      toast.error("Kunne ikke kontakte AI. Prøv igjen.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async (task: SuggestedTask, index: number) => {
    try {
      const { error } = await supabase.from("oppgaver").insert({
        oppgave: task.oppgave,
        frist: task.frist || null,
        prioritet: task.prioritet,
        status: "Åpen",
        salgsmulighet_id: task.salgsmulighet_id || null,
        selskap_id: task.selskap_id || null,
        lead_id: task.lead_id || null,
      });
      if (error) throw error;
      setCreatedTaskIds((prev) => new Set([...prev, index]));
      toast.success("Oppgave opprettet");
    } catch {
      toast.error("Kunne ikke opprette oppgave");
    }
  };

  const handleCreateAllTasks = async () => {
    if (!response?.suggested_tasks?.length) return;
    setCreatingTasks(true);
    let success = 0;
    for (let i = 0; i < response.suggested_tasks.length; i++) {
      if (createdTaskIds.has(i)) continue;
      try {
        const task = response.suggested_tasks[i];
        const { error } = await supabase.from("oppgaver").insert({
          oppgave: task.oppgave,
          frist: task.frist || null,
          prioritet: task.prioritet,
          status: "Åpen",
          salgsmulighet_id: task.salgsmulighet_id || null,
          selskap_id: task.selskap_id || null,
          lead_id: task.lead_id || null,
        });
        if (!error) {
          success++;
          setCreatedTaskIds((prev) => new Set([...prev, i]));
        }
      } catch {}
    }
    setCreatingTasks(false);
    toast.success(`${success} oppgaver opprettet`);
  };

  const handleLogActivity = async (activity: SuggestedActivity, index: number) => {
    try {
      const { error } = await supabase.from("aktiviteter").insert({
        type: activity.type,
        tittel: activity.tittel,
        beskrivelse: activity.beskrivelse,
        dato: new Date().toISOString(),
        salgsmulighet_id: activity.salgsmulighet_id || null,
        selskap_id: activity.selskap_id || null,
        lead_id: activity.lead_id || null,
        kontakt_id: activity.kontakt_id || null,
        aktivitet_kilde: "ai-assistent",
      });
      if (error) throw error;
      setCreatedActivityIds((prev) => new Set([...prev, index]));
      toast.success("Aktivitet logget");
    } catch {
      toast.error("Kunne ikke logge aktivitet");
    }
  };

  const handleCreateLead = async (lead: SuggestedLead, index: number) => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const validKilder = ["Nettside", "LinkedIn", "Partner", "Referanse", "Kald outbound", "E-post", "Telefon", "Annet"];
      const safeKilde = lead.kilde && validKilder.includes(lead.kilde) ? lead.kilde : "Annet";
      
      const { error } = await supabase.from("leads").insert({
        firmanavn: lead.firmanavn,
        kontaktperson: lead.kontaktperson || "",
        e_post: lead.e_post || "",
        telefon: lead.telefon || "",
        kilde: safeKilde as any,
        notater: lead.notater || "",
        use_case: lead.use_case || "",
        rolle_i_firma: lead.rolle_i_firma || "",
        status: "Ny" as const,
        opprettet_dato: today,
        sist_aktivitet: today,
      });
      if (error) throw error;
      setCreatedLeadIds((prev) => new Set([...prev, index]));
      toast.success(`Lead "${lead.firmanavn}" opprettet`);
    } catch {
      toast.error("Kunne ikke opprette lead");
    }
  };

  const handleApplyStatusUpdate = async (update: SuggestedStatusUpdate, index: number) => {
    try {
      const table = update.entity_type === "salgsmulighet" ? "salgsmuligheter" : "leads";
      const updateData: any = { status: update.new_status };
      if (update.neste_steg) updateData.neste_steg = update.neste_steg;
      if (update.new_status === "Vunnet") updateData.vunnet_dato = new Date().toISOString().split("T")[0];
      if (update.new_status === "Tapt") updateData.tapt_dato = new Date().toISOString().split("T")[0];
      
      const { error } = await supabase.from(table).update(updateData).eq("id", update.entity_id);
      if (error) throw error;
      setAppliedStatusIds((prev) => new Set([...prev, index]));
      toast.success(`Status oppdatert: ${update.entity_name} → ${update.new_status}`);
    } catch {
      toast.error("Kunne ikke oppdatere status");
    }
  };

  const handleApplyConversion = async (conversion: SuggestedConversion, index: number) => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const { error: smError } = await supabase.from("salgsmuligheter").insert({
        navn: conversion.navn,
        kontaktperson: conversion.kontaktperson || "",
        e_post: conversion.e_post || "",
        telefon: conversion.telefon || "",
        use_case: conversion.use_case || "",
        forventet_mrr: conversion.forventet_mrr || 0,
        status: "Ny mulighet",
        opprettet_dato: today,
        sist_aktivitet: today,
      });
      if (smError) throw smError;

      await supabase.from("leads").update({
        status: "Konvertert til salg" as any,
        konvertert_dato: today,
      }).eq("id", conversion.lead_id);

      setAppliedConversionIds((prev) => new Set([...prev, index]));
      toast.success(`Lead "${conversion.lead_name}" konvertert til salgsmulighet`);
    } catch {
      toast.error("Kunne ikke konvertere lead");
    }
  };

  const handleCreateCompany = async (company: SuggestedCompany, index: number) => {
    try {
      const { error } = await supabase.from("selskaper").insert({
        firmanavn: company.firmanavn,
        bransje: company.bransje || "",
        notater: company.notater || "",
        kundestatus: "Ikke kunde",
      });
      if (error) throw error;
      setCreatedCompanyIds((prev) => new Set([...prev, index]));
      toast.success(`Selskap "${company.firmanavn}" opprettet`);
    } catch {
      toast.error("Kunne ikke opprette selskap");
    }
  };

  const handleCreateContact = async (contact: SuggestedContact, index: number) => {
    try {
      const { error } = await supabase.from("kontakter").insert({
        navn: contact.navn,
        e_post: contact.e_post || "",
        telefon: contact.telefon || "",
        rolle: contact.rolle || "",
        selskap_id: contact.selskap_id || null,
        linkedin: contact.linkedin || "",
        notater: contact.notater || "",
      });
      if (error) throw error;
      setCreatedContactIds((prev) => new Set([...prev, index]));
      toast.success(`Kontakt "${contact.navn}" opprettet`);
    } catch {
      toast.error("Kunne ikke opprette kontakt");
    }
  };

  const handleCreateRingeliste = async (rl: SuggestedRingeliste) => {
    setRingelisteState("creating");
    try {
      // 1. Create the ringeliste folder
      const { data: folder, error: folderError } = await supabase
        .from("ringelister")
        .insert({
          navn: rl.navn,
          segment: rl.segment || "Annet",
          kanal: rl.kanal || "Direkte",
          kilde_segment: rl.kilde_segment || "Annet",
          underkilde: rl.underkilde || "AI-generert",
          notater: rl.notater || rl.signal || "",
          user_id: user?.id || null,
        })
        .select("id")
        .single();

      if (folderError) throw folderError;

      // 2. Insert all contacts into the ringeliste
      if (rl.kontakter?.length && folder?.id) {
        const rows = rl.kontakter.map((k) => ({
          ringeliste_id: folder.id,
          navn: k.navn,
          selskap: k.selskap || "",
          e_post: k.e_post || "",
          telefon: k.telefon || "",
          rolle: k.rolle || "",
          prioritet: k.prioritet || "Medium",
          kontakt_id: k.kontakt_id || null,
          selskap_id: k.selskap_id || null,
          salgsmulighet_id: k.salgsmulighet_id || null,
          lead_id: k.lead_id || null,
          notater: `${k.dialog_status}: ${k.grunn}`,
          status: "Ikke ringt",
          segment: rl.segment || "Annet",
          kanal: rl.kanal || "Direkte",
          kilde_segment: rl.kilde_segment || "Annet",
          underkilde: rl.underkilde || "AI-generert",
          user_id: user?.id || null,
        }));

        const { error: contactsError } = await supabase.from("ringeliste").insert(rows);
        if (contactsError) throw contactsError;
      }

      setRingelisteState("created");
      toast.success(`Ringeliste "${rl.navn}" opprettet med ${rl.kontakter?.length || 0} kontakter`);
    } catch (e) {
      console.error("Create ringeliste error:", e);
      toast.error("Kunne ikke opprette ringeliste");
      setRingelisteState("pending");
    }
  };

  const handleNavigate = (item: AiItem) => {
    if (!item.entityId || !item.entityType) return;
    switch (item.entityType) {
      case "salgsmulighet": navigate(`/salgsmuligheter?open=${item.entityId}`); break;
      case "lead": navigate(`/leads`); break;
      case "selskap": navigate(`/selskaper/${item.entityId}`); break;
    }
  };

  // ─── EMAIL ACTIONS ───
  const setEmailState = (index: number, state: EmailState) => {
    setEmailStates((prev) => new Map(prev).set(index, state));
  };

  const handleEditEmail = (index: number, email: SuggestedEmail) => {
    setEditingEmails((prev) => new Map(prev).set(index, {
      subject: email.subject,
      body: email.body,
      to: email.to || "",
    }));
    setEmailState(index, "editing");
  };

  const handleCancelEdit = (index: number) => {
    setEditingEmails((prev) => {
      const next = new Map(prev);
      next.delete(index);
      return next;
    });
    setEmailState(index, "pending");
  };

  const handleSendEmail = async (index: number, email: SuggestedEmail) => {
    const edited = editingEmails.get(index);
    const to = edited?.to || email.to;
    const subject = edited?.subject || email.subject;
    const body = edited?.body || email.body;

    if (!to) {
      toast.error("Mangler e-postadresse. Klikk Rediger for å legge til.");
      return;
    }

    setEmailState(index, "sending");

    try {
      const { data, error } = await supabase.functions.invoke("gmail-send", {
        body: {
          to,
          subject,
          body,
          entity_id: email.entity_id || null,
          entity_type: email.entity_type || null,
          selskap_id: email.selskap_id || null,
          kontakt_id: email.kontakt_id || null,
        },
      });

      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        setEmailState(index, "pending");
        return;
      }

      setEmailState(index, "sent");
      toast.success(`E-post sendt til ${email.to_name}`);
    } catch (e: any) {
      console.error("Send email error:", e);
      toast.error("Kunne ikke sende e-post. Sjekk at Gmail er tilkoblet.");
      setEmailState(index, "pending");
    }
  };

  const handleCreateTaskFromEmail = async (index: number, email: SuggestedEmail) => {
    try {
      const { error } = await supabase.from("oppgaver").insert({
        oppgave: `Følg opp ${email.to_name}: ${email.reason}`,
        frist: new Date(Date.now() + 86400000).toISOString().split("T")[0],
        prioritet: email.prioritet === "høy" ? "Høy" : email.prioritet === "medium" ? "Medium" : "Lav",
        status: "Åpen",
        salgsmulighet_id: email.entity_type === "salgsmulighet" ? email.entity_id : null,
        selskap_id: email.selskap_id || null,
        lead_id: email.entity_type === "lead" ? email.entity_id : null,
      });
      if (error) throw error;
      setEmailState(index, "task_created");
      toast.success("Oppgave opprettet i stedet");
    } catch {
      toast.error("Kunne ikke opprette oppgave");
    }
  };

  // ─── MEETING ACTIONS ───
  const handleCreateMeeting = async () => {
    const meeting = editingMeeting || response?.suggested_meeting;
    if (!meeting) return;

    setMeetingState("creating");

    try {
      // 1. Contact matching / creation
      let kontaktId = meeting.kontakt_id || null;
      let selskapId = meeting.selskap_id || null;

      if (!kontaktId && (meeting.deltaker_epost || meeting.deltaker_navn)) {
        // Try to find existing contact by email
        if (meeting.deltaker_epost) {
          const { data: existingByEmail } = await supabase
            .from("kontakter")
            .select("id, selskap_id")
            .ilike("e_post", meeting.deltaker_epost)
            .limit(1);
          if (existingByEmail?.length) {
            kontaktId = existingByEmail[0].id;
            selskapId = selskapId || existingByEmail[0].selskap_id;
          }
        }

        // Try to find by name if no email match
        if (!kontaktId && meeting.deltaker_navn) {
          const { data: existingByName } = await supabase
            .from("kontakter")
            .select("id, selskap_id")
            .ilike("navn", `%${meeting.deltaker_navn}%`)
            .limit(1);
          if (existingByName?.length) {
            kontaktId = existingByName[0].id;
            selskapId = selskapId || existingByName[0].selskap_id;
          }
        }

        // Create new contact if not found
        if (!kontaktId) {
          const { data: newContact } = await supabase
            .from("kontakter")
            .insert({
              navn: meeting.deltaker_navn,
              e_post: meeting.deltaker_epost || "",
            })
            .select("id")
            .single();
          if (newContact) {
            kontaktId = newContact.id;
          }
        }
      }

      // 2. Create the meeting as aktivitet
      const startDateTime = `${meeting.dato}T${meeting.start_tid}:00`;
      const endDateTime = `${meeting.dato}T${meeting.slutt_tid}:00`;

      const { data: created, error } = await supabase.from("aktiviteter").insert({
        type: "Møte" as const,
        tittel: meeting.tittel,
        beskrivelse: meeting.beskrivelse || "",
        dato: startDateTime,
        start_tid: startDateTime,
        slutt_tid: endDateTime,
        kontakt_id: kontaktId,
        selskap_id: selskapId,
        salgsmulighet_id: meeting.salgsmulighet_id || null,
        deltakere: kontaktId ? [kontaktId] : [],
        user_id: user?.id || null,
        aktivitet_kilde: "ai-assistent",
      }).select("id").single();

      if (error) throw error;

      // 3. Try to create in Google Calendar if connected
      try {
        const { data: gcalConn } = await supabase
          .from("google_calendar_connections")
          .select("id")
          .eq("user_id", user?.id || "")
          .maybeSingle();

        if (gcalConn) {
          // Sync will pick it up, or we could call a dedicated function
          // For now, trigger a sync
          supabase.functions.invoke("google-calendar-sync").catch(() => {});
        }
      } catch {
        // Google Calendar sync is optional
      }

      setCreatedMeetingId(created?.id || null);
      setMeetingState("created");
      toast.success("Møtet er opprettet!");
    } catch (e: any) {
      console.error("Create meeting error:", e);
      toast.error("Kunne ikke opprette møtet. Prøv igjen.");
      setMeetingState("pending");
    }
  };

  const handleEditMeeting = () => {
    const meeting = response?.suggested_meeting;
    if (!meeting) return;
    setEditingMeeting({ ...meeting });
    setMeetingState("editing");
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "God morgen";
    if (hour < 17) return "God ettermiddag";
    return "God kveld";
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const formatMeetingDate = (dato: string) => {
    try {
      const d = new Date(dato + "T00:00:00");
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      if (d.toDateString() === today.toDateString()) return "I dag";
      if (d.toDateString() === tomorrow.toDateString()) return "I morgen";

      return d.toLocaleDateString("no-NO", { weekday: "long", day: "numeric", month: "long" });
    } catch {
      return dato;
    }
  };

  return (
    <div className="mb-8 max-w-3xl mx-auto">
      {/* Greeting */}
      <h1 className="text-2xl sm:text-3xl font-semibold text-foreground mb-6 text-center">
        {getGreeting()}{userName ? `, ${userName}` : ""}.
      </h1>

      {/* Input area */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Spør om noe..."
            rows={2}
            className="w-full px-5 pt-4 pb-2 bg-transparent text-sm placeholder:text-muted-foreground resize-none focus:outline-none"
            disabled={loading}
          />
          <div className="flex items-center justify-end px-4 pb-3 gap-2">
            <span className="text-[11px] text-muted-foreground mr-auto">Auto</span>
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-30 hover:opacity-90 transition-opacity"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-4 h-4" />}
            </button>
          </div>
        </form>

        {/* Quick prompts */}
        {!response && !loading && (
          <div className="flex items-center gap-2 px-5 pb-4 flex-wrap">
            {QUICK_PROMPTS.map((p) => (
              <button
                key={p.label}
                onClick={() => {
                  if (p.prefill) {
                    setInput(p.prefill);
                    setTimeout(() => inputRef.current?.focus(), 50);
                  } else {
                    handleSubmit(p.label);
                  }
                }}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border bg-background text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-all whitespace-nowrap cursor-pointer"
              >
                <span>{p.icon}</span>
                {p.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          Analyserer CRM-data...
        </div>
      )}

      {/* Response */}
      {response && !loading && (
        <div className="mt-4 bg-card border rounded-xl overflow-hidden">
          {/* Summary */}
          <div className="px-5 py-4">
            <div className="prose prose-sm max-w-none text-sm text-foreground [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_p]:leading-relaxed [&_ul]:my-1 [&_li]:my-0.5">
              <ReactMarkdown>{response.summary}</ReactMarkdown>
            </div>
          </div>

          {/* ─── MEETING CONFIRMATION CARD ─── */}
          {response.suggested_meeting && (
            <div className="border-t">
              <div className="px-5 py-3 bg-muted/30 flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-primary" />
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nytt møte</p>
              </div>

              {meetingState === "created" ? (
                <div className="px-5 py-4">
                  <div className="flex items-center gap-3 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg p-4">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                        Møtet er opprettet!
                      </p>
                      <p className="text-xs text-emerald-600/70 dark:text-emerald-500/70 mt-0.5">
                        {response.suggested_meeting.tittel} med {response.suggested_meeting.deltaker_navn}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-7 gap-1"
                        onClick={() => navigate("/kalender")}
                      >
                        <CalendarDays className="w-3 h-3" /> Kalender
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="px-5 py-4">
                  {meetingState === "editing" && editingMeeting ? (
                    <div className="space-y-3">
                      <div>
                        <label className="text-[10px] font-medium text-muted-foreground uppercase">Tittel</label>
                        <Input
                          value={editingMeeting.tittel}
                          onChange={(e) => setEditingMeeting({ ...editingMeeting, tittel: e.target.value })}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-medium text-muted-foreground uppercase">Deltaker</label>
                          <Input
                            value={editingMeeting.deltaker_navn}
                            onChange={(e) => setEditingMeeting({ ...editingMeeting, deltaker_navn: e.target.value })}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-medium text-muted-foreground uppercase">E-post</label>
                          <Input
                            value={editingMeeting.deltaker_epost || ""}
                            onChange={(e) => setEditingMeeting({ ...editingMeeting, deltaker_epost: e.target.value })}
                            placeholder="e-post@eksempel.no"
                            className="h-8 text-sm"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="text-[10px] font-medium text-muted-foreground uppercase">Dato</label>
                          <Input
                            type="date"
                            value={editingMeeting.dato}
                            onChange={(e) => setEditingMeeting({ ...editingMeeting, dato: e.target.value })}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-medium text-muted-foreground uppercase">Start</label>
                          <Input
                            type="time"
                            value={editingMeeting.start_tid}
                            onChange={(e) => setEditingMeeting({ ...editingMeeting, start_tid: e.target.value })}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-medium text-muted-foreground uppercase">Slutt</label>
                          <Input
                            type="time"
                            value={editingMeeting.slutt_tid}
                            onChange={(e) => setEditingMeeting({ ...editingMeeting, slutt_tid: e.target.value })}
                            className="h-8 text-sm"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-medium text-muted-foreground uppercase">Beskrivelse</label>
                        <Textarea
                          value={editingMeeting.beskrivelse || ""}
                          onChange={(e) => setEditingMeeting({ ...editingMeeting, beskrivelse: e.target.value })}
                          rows={2}
                          className="text-sm"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" className="text-xs h-7 gap-1" onClick={handleCreateMeeting}>
                          <CalendarDays className="w-3 h-3" /> Opprett møte
                        </Button>
                        <Button variant="ghost" size="sm" className="text-xs h-7 gap-1" onClick={() => setMeetingState("pending")}>
                          <X className="w-3 h-3" /> Avbryt
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Meeting preview card */}
                      <div className="bg-muted/40 rounded-lg p-4 border mb-3">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <CalendarDays className="w-4 h-4 text-primary shrink-0" />
                            <p className="text-sm font-semibold">{response.suggested_meeting.tittel}</p>
                          </div>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 ml-6">
                            <div className="flex items-center gap-1.5">
                              <User className="w-3 h-3 text-muted-foreground" />
                              <span className="text-xs">{response.suggested_meeting.deltaker_navn}</span>
                            </div>
                            {response.suggested_meeting.deltaker_epost && (
                              <div className="flex items-center gap-1.5">
                                <Mail className="w-3 h-3 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">{response.suggested_meeting.deltaker_epost}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-1.5">
                              <CalendarDays className="w-3 h-3 text-muted-foreground" />
                              <span className="text-xs">{formatMeetingDate(response.suggested_meeting.dato)}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Clock className="w-3 h-3 text-muted-foreground" />
                              <span className="text-xs">{response.suggested_meeting.start_tid} – {response.suggested_meeting.slutt_tid}</span>
                            </div>
                          </div>
                          {response.suggested_meeting.beskrivelse && (
                            <p className="text-xs text-muted-foreground ml-6 mt-1">{response.suggested_meeting.beskrivelse}</p>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          className="text-xs h-7 gap-1"
                          onClick={handleCreateMeeting}
                          disabled={meetingState === "creating"}
                        >
                          {meetingState === "creating" ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <CalendarDays className="w-3 h-3" />
                          )}
                          {meetingState === "creating" ? "Oppretter..." : "Opprett møte"}
                        </Button>
                        <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={handleEditMeeting}>
                          <Pencil className="w-3 h-3" /> Rediger
                        </Button>
                        <Button variant="ghost" size="sm" className="text-xs h-7 gap-1" onClick={() => {
                          setResponse(prev => prev ? { ...prev, suggested_meeting: undefined } : prev);
                        }}>
                          <X className="w-3 h-3" /> Avbryt
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Suggested leads */}
          {response.suggested_leads && response.suggested_leads.length > 0 && (
            <div className="border-t">
              <div className="px-5 py-3 bg-muted/30 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" />
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nye leads å opprette</p>
              </div>
              <div className="divide-y">
                {response.suggested_leads.map((lead, i) => (
                  <div key={i} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition-colors">
                    {createdLeadIds.has(i) ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    ) : (
                      <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{lead.firmanavn}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                        {lead.kontaktperson && <span>{lead.kontaktperson}</span>}
                        {lead.e_post && <span>· {lead.e_post}</span>}
                        {lead.kilde && <Badge variant="outline" className="text-[10px]">{lead.kilde}</Badge>}
                      </div>
                      {lead.notater && <p className="text-xs text-muted-foreground mt-0.5 truncate">{lead.notater}</p>}
                    </div>
                    {createdLeadIds.has(i) ? (
                      <span className="text-xs text-emerald-600 font-medium shrink-0">Opprettet ✓</span>
                    ) : (
                      <Button variant="outline" size="sm" className="text-xs h-7 gap-1 shrink-0" onClick={() => handleCreateLead(lead, i)}>
                        Opprett
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Status updates */}
          {response.suggested_status_updates && response.suggested_status_updates.length > 0 && (
            <div className="border-t">
              <div className="px-5 py-3 bg-muted/30 flex items-center gap-2">
                <ArrowUp className="w-4 h-4 text-primary" />
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Statusoppdateringer</p>
              </div>
              <div className="divide-y">
                {response.suggested_status_updates.map((update, i) => (
                  <div key={i} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition-colors">
                    {appliedStatusIds.has(i) ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    ) : (
                      <ArrowUp className="w-4 h-4 text-muted-foreground shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{update.entity_name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {update.entity_type === "salgsmulighet" ? "Salgsmulighet" : "Lead"} → <span className="font-medium">{update.new_status}</span>
                        {update.neste_steg && <span> · Neste steg: {update.neste_steg}</span>}
                      </p>
                    </div>
                    {appliedStatusIds.has(i) ? (
                      <span className="text-xs text-emerald-600 font-medium shrink-0">Oppdatert ✓</span>
                    ) : (
                      <Button variant="outline" size="sm" className="text-xs h-7 gap-1 shrink-0" onClick={() => handleApplyStatusUpdate(update, i)}>
                        Oppdater
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Conversions */}
          {response.suggested_conversions && response.suggested_conversions.length > 0 && (
            <div className="border-t">
              <div className="px-5 py-3 bg-muted/30 flex items-center gap-2">
                <ExternalLink className="w-4 h-4 text-primary" />
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Konverter leads</p>
              </div>
              <div className="divide-y">
                {response.suggested_conversions.map((conv, i) => (
                  <div key={i} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition-colors">
                    {appliedConversionIds.has(i) ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    ) : (
                      <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{conv.lead_name} → Salgsmulighet</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        {conv.forventet_mrr && <span>MRR: {conv.forventet_mrr} kr</span>}
                        {conv.kontaktperson && <span>· {conv.kontaktperson}</span>}
                      </div>
                    </div>
                    {appliedConversionIds.has(i) ? (
                      <span className="text-xs text-emerald-600 font-medium shrink-0">Konvertert ✓</span>
                    ) : (
                      <Button variant="outline" size="sm" className="text-xs h-7 gap-1 shrink-0" onClick={() => handleApplyConversion(conv, i)}>
                        Konverter
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* New companies */}
          {response.suggested_companies && response.suggested_companies.length > 0 && (
            <div className="border-t">
              <div className="px-5 py-3 bg-muted/30 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" />
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nye selskaper</p>
              </div>
              <div className="divide-y">
                {response.suggested_companies.map((company, i) => (
                  <div key={i} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition-colors">
                    {createdCompanyIds.has(i) ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    ) : (
                      <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{company.firmanavn}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        {company.bransje && <span>{company.bransje}</span>}
                        {company.notater && <span>· {company.notater}</span>}
                      </div>
                    </div>
                    {createdCompanyIds.has(i) ? (
                      <span className="text-xs text-emerald-600 font-medium shrink-0">Opprettet ✓</span>
                    ) : (
                      <Button variant="outline" size="sm" className="text-xs h-7 gap-1 shrink-0" onClick={() => handleCreateCompany(company, i)}>
                        Opprett
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* New contacts */}
          {response.suggested_contacts && response.suggested_contacts.length > 0 && (
            <div className="border-t">
              <div className="px-5 py-3 bg-muted/30 flex items-center gap-2">
                <User className="w-4 h-4 text-primary" />
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nye kontakter</p>
              </div>
              <div className="divide-y">
                {response.suggested_contacts.map((contact, i) => (
                  <div key={i} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition-colors">
                    {createdContactIds.has(i) ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    ) : (
                      <User className="w-4 h-4 text-muted-foreground shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{contact.navn}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                        {contact.selskap_navn && <span className="flex items-center gap-0.5"><Building2 className="w-3 h-3" />{contact.selskap_navn}</span>}
                        {contact.rolle && <span>· {contact.rolle}</span>}
                        {contact.e_post && <span>· {contact.e_post}</span>}
                      </div>
                    </div>
                    {createdContactIds.has(i) ? (
                      <span className="text-xs text-emerald-600 font-medium shrink-0">Opprettet ✓</span>
                    ) : (
                      <Button variant="outline" size="sm" className="text-xs h-7 gap-1 shrink-0" onClick={() => handleCreateContact(contact, i)}>
                        Opprett
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action items */}
          {response.items.length > 0 && (
            <div className="border-t">
              <div className="px-5 py-3 bg-muted/30">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Handlingsliste</p>
              </div>
              <div className="divide-y">
                {response.items.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition-colors group">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${
                      item.prioritet === "høy" ? "bg-destructive" : item.prioritet === "medium" ? "bg-amber-500" : "bg-muted-foreground"
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{item.navn}</p>
                        <Badge variant="outline" className={`text-[10px] shrink-0 ${prioritetColor[item.prioritet]}`}>{item.prioritet}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{item.selskap}</p>
                      <p className="text-xs text-primary mt-0.5 font-medium">{item.handling}</p>
                    </div>
                    {item.entityId && item.entityType && (
                      <Button variant="ghost" size="sm" className="text-xs gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleNavigate(item)}>
                        <ExternalLink className="w-3 h-3" /> Åpne
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Suggested emails */}
          {response.suggested_emails?.length > 0 && (
            <div className="border-t">
              <div className="px-5 py-3 bg-muted/30 flex items-center gap-2">
                <Mail className="w-4 h-4 text-primary" />
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Oppfølgings-e-poster</p>
              </div>
              <div className="divide-y">
                {response.suggested_emails.map((email, i) => {
                  const state = emailStates.get(i) || "pending";
                  const editing = editingEmails.get(i);

                  if (state === "sent") {
                    return (
                      <div key={i} className="flex items-center gap-3 px-5 py-3 bg-emerald-50 dark:bg-emerald-950/20">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                            Sendt til {email.to_name}
                          </p>
                          <p className="text-xs text-emerald-600/70 dark:text-emerald-500/70">{email.subject}</p>
                        </div>
                      </div>
                    );
                  }

                  if (state === "skipped") return null;

                  if (state === "task_created") {
                    return (
                      <div key={i} className="flex items-center gap-3 px-5 py-3 bg-muted/30">
                        <ListTodo className="w-4 h-4 text-primary shrink-0" />
                        <p className="text-sm text-muted-foreground">Oppgave opprettet for {email.to_name}</p>
                      </div>
                    );
                  }

                  return (
                    <div key={i} className="px-5 py-4">
                      {/* Header */}
                      <div className="flex items-start gap-3 mb-3">
                        <div className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${
                          email.prioritet === "høy" ? "bg-destructive" : email.prioritet === "medium" ? "bg-amber-500" : "bg-muted-foreground"
                        }`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium">{email.to_name}</p>
                            {email.selskap_navn && (
                              <span className="text-xs text-muted-foreground">· {email.selskap_navn}</span>
                            )}
                            <Badge variant="outline" className={`text-[10px] ${prioritetColor[email.prioritet]}`}>{email.prioritet}</Badge>
                          </div>
                          <p className="text-xs text-primary mt-0.5">{email.reason}</p>
                        </div>
                      </div>

                      {/* Email content */}
                      {state === "editing" ? (
                        <div className="ml-5 space-y-2 mb-3">
                          <div>
                            <label className="text-[10px] font-medium text-muted-foreground uppercase">Til</label>
                            <Input
                              value={editing?.to || ""}
                              onChange={(e) => setEditingEmails((prev) => {
                                const next = new Map(prev);
                                const cur = next.get(i) || { subject: email.subject, body: email.body, to: email.to || "" };
                                next.set(i, { ...cur, to: e.target.value });
                                return next;
                              })}
                              placeholder="e-post@eksempel.no"
                              className="h-8 text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-medium text-muted-foreground uppercase">Emne</label>
                            <Input
                              value={editing?.subject || ""}
                              onChange={(e) => setEditingEmails((prev) => {
                                const next = new Map(prev);
                                const cur = next.get(i) || { subject: email.subject, body: email.body, to: email.to || "" };
                                next.set(i, { ...cur, subject: e.target.value });
                                return next;
                              })}
                              className="h-8 text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-medium text-muted-foreground uppercase">Innhold</label>
                            <Textarea
                              value={editing?.body || ""}
                              onChange={(e) => setEditingEmails((prev) => {
                                const next = new Map(prev);
                                const cur = next.get(i) || { subject: email.subject, body: email.body, to: email.to || "" };
                                next.set(i, { ...cur, body: e.target.value });
                                return next;
                              })}
                              rows={5}
                              className="text-sm"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="ml-5 mb-3">
                          <div className="bg-muted/40 rounded-lg p-3 border">
                            <p className="text-xs font-medium text-muted-foreground mb-1">
                              {email.to ? `Til: ${email.to}` : "Mangler e-postadresse"}
                            </p>
                            <p className="text-xs font-medium mb-2">Emne: {email.subject}</p>
                            <p className="text-xs text-foreground/80 whitespace-pre-line leading-relaxed">{email.body}</p>
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="ml-5 flex items-center gap-2 flex-wrap">
                        {state === "editing" ? (
                          <>
                            <Button
                              size="sm"
                              className="text-xs h-7 gap-1"
                              onClick={() => handleSendEmail(i, email)}
                              disabled={!editingEmails.get(i)?.to}
                            >
                              <Send className="w-3 h-3" /> Send
                            </Button>
                            <Button variant="ghost" size="sm" className="text-xs h-7 gap-1" onClick={() => handleCancelEdit(i)}>
                              <X className="w-3 h-3" /> Avbryt
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              className="text-xs h-7 gap-1"
                              onClick={() => handleSendEmail(i, email)}
                              disabled={state === "sending" || !email.to}
                            >
                              {state === "sending" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                              {state === "sending" ? "Sender..." : "Send"}
                            </Button>
                            <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={() => handleEditEmail(i, email)}>
                              <Pencil className="w-3 h-3" /> Rediger
                            </Button>
                            <Button variant="ghost" size="sm" className="text-xs h-7 gap-1" onClick={() => setEmailState(i, "skipped")}>
                              <SkipForward className="w-3 h-3" /> Hopp over
                            </Button>
                            <Button variant="ghost" size="sm" className="text-xs h-7 gap-1" onClick={() => handleCreateTaskFromEmail(i, email)}>
                              <ListTodo className="w-3 h-3" /> Oppgave
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Suggested tasks */}
          {response.suggested_tasks.length > 0 && (
            <div className="border-t">
              <div className="px-5 py-3 bg-muted/30 flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Foreslåtte oppgaver</p>
                <Button
                  variant="outline" size="sm" className="text-xs h-7 gap-1"
                  onClick={handleCreateAllTasks}
                  disabled={creatingTasks || createdTaskIds.size === response.suggested_tasks.length}
                >
                  {creatingTasks ? <Loader2 className="w-3 h-3 animate-spin" /> : <ListChecks className="w-3 h-3" />}
                  {createdTaskIds.size === response.suggested_tasks.length ? "Alle opprettet" : "Opprett alle"}
                </Button>
              </div>
              <div className="divide-y">
                {response.suggested_tasks.map((task, i) => (
                  <div key={i} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition-colors">
                    {createdTaskIds.has(i) ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{task.oppgave}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="outline" className={`text-[10px] ${
                          task.prioritet === "Høy" ? prioritetColor["høy"] :
                          task.prioritet === "Medium" ? prioritetColor["medium"] : prioritetColor["lav"]
                        }`}>{task.prioritet}</Badge>
                        {task.frist && <span className="text-[10px] text-muted-foreground">Frist: {task.frist}</span>}
                      </div>
                    </div>
                    {!createdTaskIds.has(i) && (
                      <Button variant="outline" size="sm" className="text-xs h-7 gap-1 shrink-0" onClick={() => handleCreateTask(task, i)}>
                        Opprett
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Suggested activities */}
          {response.suggested_activities?.length > 0 && (
            <div className="border-t">
              <div className="px-5 py-3 bg-muted/30">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Foreslåtte aktiviteter å logge</p>
              </div>
              <div className="divide-y">
                {response.suggested_activities.map((activity, i) => (
                  <div key={i} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition-colors">
                    {createdActivityIds.has(i) ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    ) : (
                      <PhoneCall className="w-4 h-4 text-muted-foreground shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{activity.tittel}</p>
                      <p className="text-xs text-muted-foreground truncate">{activity.beskrivelse}</p>
                      <Badge variant="outline" className="text-[10px] mt-0.5">{activity.type}</Badge>
                    </div>
                    {!createdActivityIds.has(i) && (
                      <Button variant="outline" size="sm" className="text-xs h-7 gap-1 shrink-0" onClick={() => handleLogActivity(activity, i)}>
                        Logg
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reset */}
          <div className="px-5 py-3 border-t bg-muted/20 flex justify-end">
            <button
              onClick={() => { setResponse(null); inputRef.current?.focus(); }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              Nytt spørsmål
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
