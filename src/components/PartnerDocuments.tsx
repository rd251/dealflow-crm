import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Download, FileText, Loader2 } from "lucide-react";

interface PartnerDoc {
  id: string;
  title: string;
  status: string;
  sentAt: string | null;
  signedAt: string | null;
  appUrl: string | null;
  downloadUrl: string | null;
}

const statusColors: Record<string, string> = {
  "Sendt": "bg-stage-contacted/10 text-stage-contacted",
  "Åpnet": "bg-stage-qualified/10 text-stage-qualified",
  "Signert": "bg-success/10 text-success",
  "Utløpt": "bg-destructive/10 text-destructive",
  "Ikke sendt": "bg-muted text-muted-foreground",
};

function formatDate(d: string | null) {
  if (!d) return "–";
  try {
    return new Date(d).toLocaleDateString("no-NO", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return d;
  }
}

export default function PartnerDocuments({ partnerId }: { partnerId: string }) {
  const [docs, setDocs] = useState<PartnerDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDocs = async () => {
      setLoading(true);
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const session = (await supabase.auth.getSession()).data.session;

        const res = await fetch(
          `${supabaseUrl}/functions/v1/dealbuilder-partner-documents?partner_id=${encodeURIComponent(partnerId)}`,
          {
            headers: {
              Authorization: `Bearer ${session?.access_token || anonKey}`,
              apikey: anonKey,
            },
          }
        );

        if (res.ok) {
          const json = await res.json();
          setDocs(json.documents || []);
        }
      } catch (err) {
        console.error("Failed to fetch partner docs:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchDocs();
  }, [partnerId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (docs.length === 0) {
    return (
      <div className="text-center py-8">
        <FileText className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
        <p className="text-sm text-muted-foreground">Ingen samarbeidsavtaler sendt ennå</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Samarbeidsavtaler ({docs.length})
      </h3>
      {docs.map(doc => (
        <div key={doc.id} className="p-3 bg-muted/30 rounded-lg border space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{doc.title}</p>
            </div>
            <Badge className={`text-[10px] shrink-0 ${statusColors[doc.status] || "bg-muted text-muted-foreground"}`}>
              {doc.status}
            </Badge>
          </div>
          <div className="flex gap-4 text-[11px] text-muted-foreground">
            <span>Sendt: {formatDate(doc.sentAt)}</span>
            {doc.signedAt && <span>Signert: {formatDate(doc.signedAt)}</span>}
          </div>
          <div className="flex gap-2">
            {doc.appUrl && (
              <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1" asChild>
                <a href={doc.appUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-3 h-3" /> Åpne i DealBuilder
                </a>
              </Button>
            )}
            {doc.downloadUrl && (
              <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1" asChild>
                <a href={doc.downloadUrl} target="_blank" rel="noopener noreferrer">
                  <Download className="w-3 h-3" /> Last ned PDF
                </a>
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
