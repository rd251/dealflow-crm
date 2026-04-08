import { useState, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { CheckCircle, Upload, X, ArrowRight, ArrowLeft } from "lucide-react";

const BRAND_RED = "#c0392b";
const TOTAL_STEPS = 11; // 10 questions + contact info

interface QuestionConfig {
  id: string;
  title: string;
  subtitle: string;
  type: "textarea-lg" | "textarea-md" | "radio-text" | "file-links" | "contact";
  placeholder?: string;
  required: boolean;
  radioOptions?: string[];
  radioPlaceholder?: string;
}

const questions: QuestionConfig[] = [
  {
    id: "q1",
    title: "Hvem er du og hva tilbyr dere?",
    subtitle: "Start med å forklare hvem dere er og hva dere gjør. Dette gir oss konteksten AI-agenten trenger.",
    type: "textarea-lg",
    placeholder: "Vi er en bilforhandler i Stavanger som selger brukte og nye biler. Vi tilbyr... Vi hjelper kunder med...",
    required: true,
  },
  {
    id: "q2",
    title: "Hva skal AI-agenten gjøre?",
    subtitle: "Beskriv hvilke oppgaver agenten skal utføre. Jo mer konkret, jo bedre.",
    type: "textarea-lg",
    placeholder: "Agenten skal booke, endre og kansellere timer. Besvare vanlige spørsmål. Koble kundene til riktig person...",
    required: true,
  },
  {
    id: "q3",
    title: "Hva sier kundene dine?",
    subtitle: "Vi trenger ekte setninger og vanlige spørsmål fra kundene dine. Dette gir oss materiale til å trene agenten.",
    type: "textarea-lg",
    placeholder: '"Hei, jeg vil bestille time." "Hva koster det?" "Når har dere åpent?"',
    required: true,
  },
  {
    id: "q4",
    title: "Hva skal skje i samtalen?",
    subtitle: "Forklar hvordan agenten skal løse oppgaver — skal den gi svar selv, sende e-post, booke time eller koble videre?",
    type: "textarea-lg",
    placeholder: "Ved spørsmål om X skal agenten svare direkte. Ved booking skal agenten booke i systemet...",
    required: true,
  },
  {
    id: "q5",
    title: "Åpningstider og unntak",
    subtitle: "Hvilke tider gjelder for kundeservice? Skal agenten håndtere ting annerledes utenom åpningstid?",
    type: "textarea-md",
    placeholder: "Mandag–fredag: 08–16. Utenom åpningstid: Informer om åpningstider og tilby å legge igjen beskjed.",
    required: false,
  },
  {
    id: "q6",
    title: "Hva skal agenten ikke gjøre?",
    subtitle: "Noen ting vil du kanskje at agenten skal holde seg unna.",
    type: "textarea-md",
    placeholder: "Skal ikke gi medisinske råd. Skal ikke håndtere kortinfo. Skal ikke gi juridisk rådgivning.",
    required: true,
  },
  {
    id: "q7",
    title: "Hvilken tone og stil skal agenten ha?",
    subtitle: "Hvordan skal den snakke med kundene dine?",
    type: "radio-text",
    radioOptions: ["Høflig og profesjonell", "Vennlig og uformell", "Selgende og energisk", "Nøytral og informativ"],
    radioPlaceholder: "Agenten skal tiltale kundene med 'du'. Bruk enkelt språk...",
    required: false,
  },
  {
    id: "q8",
    title: "Har du noe vi kan bruke?",
    subtitle: "Vi lærer agenten raskere hvis du har eksisterende innhold.",
    type: "file-links",
    placeholder: "https://www.dinbedrift.no/faq",
    required: false,
  },
  {
    id: "q9",
    title: "Systemer og teknisk",
    subtitle: "Hvis du vil integrere med systemer — f.eks. bookingsystem, CRM eller API-er.",
    type: "textarea-md",
    placeholder: "Bruker HubSpot til leads og TimePlan til booking. Logger sendes til support@firma.no.",
    required: false,
  },
  {
    id: "q10",
    title: "Spesielle hensyn eller regler?",
    subtitle: "Er det noe spesielt vi bør vite? Kundetype, bransjeregler, språk, sikkerhet osv.",
    type: "textarea-md",
    placeholder: "Vi har mange eldre kunder — agenten må snakke rolig. Kundene snakker både norsk og engelsk.",
    required: true,
  },
  {
    id: "contact",
    title: "Til slutt — litt om deg",
    subtitle: "Så vi vet hvem vi snakker med.",
    type: "contact",
    required: true,
  },
];

export default function Onboarding() {
  const [searchParams] = useSearchParams();
  const prosjektId = searchParams.get("prosjekt") || "";
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [radioSelection, setRadioSelection] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [contact, setContact] = useState({ navn: "", epost: "", firma: "" });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const q = questions[step];
  const progress = ((step + 1) / TOTAL_STEPS) * 100;

  const canNext = useCallback(() => {
    if (!q.required) return true;
    if (q.type === "contact") return contact.navn.trim() && contact.epost.trim() && contact.firma.trim();
    if (q.type === "radio-text") return true; // not required
    return (answers[q.id] || "").trim().length > 0;
  }, [q, answers, contact]);

  const goNext = () => {
    if (step < TOTAL_STEPS - 1) {
      setDirection("forward");
      setStep(s => s + 1);
    }
  };
  const goBack = () => {
    if (step > 0) {
      setDirection("back");
      setStep(s => s - 1);
    }
  };

  const handleFileAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files || []);
    setFiles(prev => [...prev, ...newFiles].slice(0, 5));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const newFiles = Array.from(e.dataTransfer.files);
    setFiles(prev => [...prev, ...newFiles].slice(0, 5));
  };

  const removeFile = (idx: number) => setFiles(prev => prev.filter((_, i) => i !== idx));

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      // Upload files
      const filePaths: string[] = [];
      const folder = prosjektId || "unknown";
      for (const file of files) {
        const path = `${folder}/${Date.now()}-${file.name}`;
        const { error } = await supabase.storage.from("projekt-kb").upload(path, file);
        if (!error) filePaths.push(path);
      }

      // Build answers object
      const svar: Record<string, unknown> = {};
      questions.forEach(q => {
        if (q.type === "contact") return;
        if (q.type === "radio-text") {
          svar[q.id] = { choice: radioSelection, text: answers[q.id] || "" };
        } else if (q.type === "file-links") {
          svar[q.id] = { links: answers[q.id] || "" };
        } else {
          svar[q.id] = answers[q.id] || "";
        }
      });

      // Insert answer
      await supabase.from("onboarding_svar" as any).insert({
        prosjekt_id: prosjektId || null,
        svar,
        kontakt_navn: contact.navn,
        kontakt_epost: contact.epost,
        firmanavn: contact.firma,
        filer: filePaths,
      });

      // Update project status if linked
      if (prosjektId) {
        await supabase.from("prosjekter").update({ status: "Skjema mottatt" as any }).eq("id", prosjektId);

        // Get project to find ansvarlig for notification
        const { data: proj } = await supabase.from("prosjekter").select("ansvarlig, selskap_id").eq("id", prosjektId).maybeSingle();
        if (proj?.ansvarlig) {
          // Find user by display_name to send notification
          const { data: profiles } = await supabase.from("profiles").select("user_id").eq("display_name", proj.ansvarlig);
          if (profiles?.[0]) {
            await supabase.from("varsler").insert({
              user_id: profiles[0].user_id,
              tittel: "Onboarding-skjema fylt ut",
              beskrivelse: `${contact.firma} har fylt ut onboarding-skjemaet.`,
              type: "onboarding",
              lenke: `/prosjekter`,
            });
          }
        }
      }

      setSubmitted(true);
    } catch (err) {
      console.error("Submit error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6">
        <div className="text-center max-w-md mx-auto">
          <SnakkLogo />
          <div className="mt-10">
            <CheckCircle className="w-16 h-16 mx-auto mb-6" style={{ color: BRAND_RED }} />
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Takk!</h1>
            <p className="text-lg text-gray-600 leading-relaxed">
              Vi er i gang. Du hører fra oss innen 1–2 virkedager.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <SnakkLogo />
        <span className="text-sm text-gray-400">Spørsmål {step + 1} av {TOTAL_STEPS}</span>
      </header>

      {/* Progress */}
      <div className="w-full h-1 bg-gray-100">
        <div className="h-full transition-all duration-500 ease-out" style={{ width: `${progress}%`, backgroundColor: BRAND_RED }} />
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <div
          key={step}
          className="w-full max-w-2xl animate-fade-in"
          style={{ animation: `${direction === "forward" ? "slideInRight" : "slideInLeft"} 0.35s ease-out` }}
        >
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">{q.title}</h2>
          <p className="text-gray-500 mb-8 text-base sm:text-lg">{q.subtitle}</p>

          {/* Question body */}
          {q.type === "textarea-lg" && (
            <Textarea
              className="min-h-[180px] text-base border-gray-200 focus:border-red-400 focus:ring-red-400/20 resize-none"
              placeholder={q.placeholder}
              value={answers[q.id] || ""}
              onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))}
              autoFocus
            />
          )}

          {q.type === "textarea-md" && (
            <Textarea
              className="min-h-[120px] text-base border-gray-200 focus:border-red-400 focus:ring-red-400/20 resize-none"
              placeholder={q.placeholder}
              value={answers[q.id] || ""}
              onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))}
              autoFocus
            />
          )}

          {q.type === "radio-text" && (
            <div className="space-y-6">
              <RadioGroup value={radioSelection} onValueChange={setRadioSelection} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {q.radioOptions!.map(opt => (
                  <Label
                    key={opt}
                    htmlFor={opt}
                    className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      radioSelection === opt ? "border-red-500 bg-red-50" : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <RadioGroupItem value={opt} id={opt} />
                    <span className="text-sm font-medium">{opt}</span>
                  </Label>
                ))}
              </RadioGroup>
              <Textarea
                className="min-h-[80px] text-base border-gray-200 focus:border-red-400 focus:ring-red-400/20 resize-none"
                placeholder={q.radioPlaceholder}
                value={answers[q.id] || ""}
                onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))}
              />
            </div>
          )}

          {q.type === "file-links" && (
            <div className="space-y-6">
              {/* Drop zone */}
              <div
                className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-red-300 transition-colors cursor-pointer"
                onDragOver={e => e.preventDefault()}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-8 h-8 mx-auto mb-3 text-gray-400" />
                <p className="text-sm text-gray-600 font-medium">Dra og slipp filer her, eller klikk for å velge</p>
                <p className="text-xs text-gray-400 mt-1">PDF, Word, TXT, MP3 — maks 5 filer, 100 MB per fil</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  multiple
                  accept=".pdf,.doc,.docx,.txt,.mp3"
                  onChange={handleFileAdd}
                />
              </div>
              {files.length > 0 && (
                <div className="space-y-2">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-lg px-4 py-2.5">
                      <span className="text-sm truncate flex-1">{f.name}</span>
                      <span className="text-xs text-gray-400">{(f.size / 1024 / 1024).toFixed(1)} MB</span>
                      <button onClick={() => removeFile(i)} className="text-gray-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
              )}
              <div>
                <Label className="text-sm text-gray-600 mb-1.5 block">Lenker til nettside, FAQ e.l.</Label>
                <Textarea
                  className="min-h-[60px] text-base border-gray-200 focus:border-red-400 focus:ring-red-400/20 resize-none"
                  placeholder={q.placeholder}
                  value={answers[q.id] || ""}
                  onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))}
                />
              </div>
            </div>
          )}

          {q.type === "contact" && (
            <div className="space-y-5">
              <div>
                <Label className="text-sm font-medium text-gray-700 mb-1.5 block">Navn *</Label>
                <Input
                  className="h-12 text-base border-gray-200 focus:border-red-400 focus:ring-red-400/20"
                  placeholder="Ola Nordmann"
                  value={contact.navn}
                  onChange={e => setContact(c => ({ ...c, navn: e.target.value }))}
                  autoFocus
                />
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-700 mb-1.5 block">E-post *</Label>
                <Input
                  type="email"
                  className="h-12 text-base border-gray-200 focus:border-red-400 focus:ring-red-400/20"
                  placeholder="ola@firma.no"
                  value={contact.epost}
                  onChange={e => setContact(c => ({ ...c, epost: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-700 mb-1.5 block">Firmanavn *</Label>
                <Input
                  className="h-12 text-base border-gray-200 focus:border-red-400 focus:ring-red-400/20"
                  placeholder="Firma AS"
                  value={contact.firma}
                  onChange={e => setContact(c => ({ ...c, firma: e.target.value }))}
                />
              </div>
            </div>
          )}

          {/* Required indicator */}
          {q.required && q.type !== "contact" && (
            <p className="text-xs text-gray-400 mt-3">* Obligatorisk</p>
          )}
        </div>
      </div>

      {/* Footer navigation */}
      <footer className="border-t border-gray-100 px-6 py-4 flex items-center justify-between">
        <Button variant="ghost" onClick={goBack} disabled={step === 0} className="text-gray-500">
          <ArrowLeft className="w-4 h-4 mr-1" /> Tilbake
        </Button>
        {step < TOTAL_STEPS - 1 ? (
          <Button
            onClick={goNext}
            disabled={!canNext()}
            className="text-white px-6"
            style={{ backgroundColor: BRAND_RED }}
          >
            Neste <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={submitting || !canNext()}
            className="text-white px-8"
            style={{ backgroundColor: BRAND_RED }}
          >
            {submitting ? "Sender..." : "Send inn"}
          </Button>
        )}
      </footer>

      {/* Animation styles */}
      <style>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(40px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideInLeft {
          from { opacity: 0; transform: translateX(-40px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}

function SnakkLogo() {
  return (
    <div className="flex items-center gap-2">
      <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
        <path d="M16 2L19.5 11.5L29 16L19.5 20.5L16 30L12.5 20.5L3 16L12.5 11.5L16 2Z" fill={BRAND_RED} />
      </svg>
      <span className="text-xl font-bold tracking-tight text-gray-900">SNAKK</span>
    </div>
  );
}
