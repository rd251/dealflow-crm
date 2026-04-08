import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, ExternalLink } from "lucide-react";

interface OnboardingSvar {
  id: string;
  svar: Record<string, any>;
  kontakt_navn: string;
  kontakt_epost: string;
  firmanavn: string;
  filer: string[];
  created_at: string;
}

const questionLabels: Record<string, string> = {
  q1: "Hvem er du og hva tilbyr dere?",
  q2: "Hva skal AI-agenten gjøre?",
  q3: "Hva sier kundene dine?",
  q4: "Hva skal skje i samtalen?",
  q5: "Åpningstider og unntak",
  q6: "Hva skal agenten ikke gjøre?",
  q7: "Tone og stil",
  q8: "Eksisterende innhold",
  q9: "Systemer og teknisk",
  q10: "Spesielle hensyn eller regler",
};

export default function OnboardingAnswers({ prosjektId }: { prosjektId: string }) {
  const [data, setData] = useState<OnboardingSvar | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!prosjektId) return;
    supabase
      .from("onboarding_svar" as any)
      .select("*")
      .eq("prosjekt_id", prosjektId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data: d }) => {
        setData(d as any);
        setLoading(false);
      });
  }, [prosjektId]);

  if (loading) return <p className="text-xs text-muted-foreground p-4">Laster...</p>;
  if (!data) return <p className="text-xs text-muted-foreground p-4">Ingen onboarding-svar mottatt ennå.</p>;

  const renderAnswer = (key: string, value: any) => {
    if (typeof value === "string") return <p className="text-sm whitespace-pre-wrap">{value || "–"}</p>;
    if (value?.choice) {
      return (
        <div>
          <Badge variant="secondary" className="mb-1">{value.choice}</Badge>
          {value.text && <p className="text-sm mt-1">{value.text}</p>}
        </div>
      );
    }
    if (value?.links !== undefined) {
      return <p className="text-sm whitespace-pre-wrap">{value.links || "Ingen lenker oppgitt"}</p>;
    }
    return <p className="text-sm">{JSON.stringify(value)}</p>;
  };

  const handleDownload = async (path: string) => {
    const { data: blob } = await supabase.storage.from("projekt-kb").download(path);
    if (blob) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = path.split("/").pop() || "file";
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="space-y-4 p-1">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Onboarding-svar</h3>
        <span className="text-xs text-muted-foreground">
          Mottatt {new Date(data.created_at).toLocaleDateString("no-NO")}
        </span>
      </div>

      <div className="bg-muted/50 rounded-lg p-3 text-xs space-y-1">
        <p><span className="text-muted-foreground">Kontakt:</span> {data.kontakt_navn} ({data.kontakt_epost})</p>
        <p><span className="text-muted-foreground">Firma:</span> {data.firmanavn}</p>
      </div>

      <div className="space-y-4">
        {Object.entries(data.svar).map(([key, value]) => (
          <div key={key} className="border-b pb-3 last:border-0">
            <p className="text-xs font-medium text-muted-foreground mb-1">{questionLabels[key] || key}</p>
            {renderAnswer(key, value)}
          </div>
        ))}
      </div>

      {data.filer.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Opplastede filer</p>
          <div className="space-y-1.5">
            {data.filer.map((f, i) => (
              <div key={i} className="flex items-center gap-2 bg-muted/50 rounded px-3 py-2">
                <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-sm truncate flex-1">{f.split("/").pop()}</span>
                <Badge variant="outline" className="text-[10px] shrink-0">Lastet opp av kunde</Badge>
                <button onClick={() => handleDownload(f)} className="text-muted-foreground hover:text-primary">
                  <Download className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
