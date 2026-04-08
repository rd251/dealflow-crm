import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Upload, ExternalLink, Download, FileText, File, Trash2, Loader2 } from "lucide-react";

interface DealBuilderDoc {
  id: string;
  title: string;
  status: string;
  sentAt: string | null;
  signedAt: string | null;
  appUrl: string | null;
  downloadUrl: string | null;
  dealName: string;
  dealId: string;
}

interface UploadedDoc {
  id: string;
  fil_navn: string;
  fil_type: string;
  fil_sti: string;
  opplastet_av: string;
  created_at: string;
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

export default function CompanyDocuments({ selskapId }: { selskapId: string }) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dealDocs, setDealDocs] = useState<DealBuilderDoc[]>([]);
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDoc[]>([]);
  const [loadingDeal, setLoadingDeal] = useState(true);
  const [loadingUploaded, setLoadingUploaded] = useState(true);
  const [uploading, setUploading] = useState(false);

  // Fetch DealBuilder documents
  useEffect(() => {
    const fetchDealDocs = async () => {
      setLoadingDeal(true);
      try {
        const { data, error } = await supabase.functions.invoke("dealbuilder-documents", {
          body: null,
          method: "GET",
          headers: {},
        });
        // supabase.functions.invoke doesn't support query params well for GET,
        // so we use fetch directly
        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const session = (await supabase.auth.getSession()).data.session;
        
        const res = await fetch(
          `${supabaseUrl}/functions/v1/dealbuilder-documents?selskap_id=${encodeURIComponent(selskapId)}`,
          {
            headers: {
              Authorization: `Bearer ${session?.access_token || anonKey}`,
              apikey: anonKey,
            },
          }
        );
        if (res.ok) {
          const json = await res.json();
          setDealDocs(json.documents || []);
        }
      } catch (err) {
        console.error("Failed to fetch DealBuilder docs:", err);
      } finally {
        setLoadingDeal(false);
      }
    };
    fetchDealDocs();
  }, [selskapId]);

  // Fetch uploaded documents
  useEffect(() => {
    const fetchUploaded = async () => {
      setLoadingUploaded(true);
      const { data, error } = await supabase
        .from("selskap_dokumenter")
        .select("*")
        .eq("selskap_id", selskapId)
        .order("created_at", { ascending: false });
      if (!error && data) {
        setUploadedDocs(data as UploadedDoc[]);
      }
      setLoadingUploaded(false);
    };
    fetchUploaded();
  }, [selskapId]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop() || "";
        const allowed = ["pdf", "doc", "docx"];
        if (!allowed.includes(ext.toLowerCase())) {
          toast.error(`Ugyldig filtype: ${ext}. Kun PDF og Word er tillatt.`);
          continue;
        }

        const filePath = `${selskapId}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("company-documents")
          .upload(filePath, file);

        if (uploadError) {
          toast.error(`Feil ved opplasting av ${file.name}: ${uploadError.message}`);
          continue;
        }

        const { error: metaError } = await supabase.from("selskap_dokumenter").insert({
          selskap_id: selskapId,
          fil_navn: file.name,
          fil_type: ext.toLowerCase(),
          fil_sti: filePath,
          opplastet_av: user?.email || "",
          opplastet_av_user_id: user?.id || null,
        });

        if (metaError) {
          toast.error(`Metadata-feil for ${file.name}`);
          continue;
        }

        toast.success(`${file.name} lastet opp`);
      }

      // Refresh list
      const { data } = await supabase
        .from("selskap_dokumenter")
        .select("*")
        .eq("selskap_id", selskapId)
        .order("created_at", { ascending: false });
      if (data) setUploadedDocs(data as UploadedDoc[]);
    } catch (err) {
      toast.error("Opplasting feilet");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (doc: UploadedDoc) => {
    const { error: storageError } = await supabase.storage
      .from("company-documents")
      .remove([doc.fil_sti]);

    const { error: dbError } = await supabase
      .from("selskap_dokumenter")
      .delete()
      .eq("id", doc.id);

    if (storageError || dbError) {
      toast.error("Kunne ikke slette dokumentet");
      return;
    }

    setUploadedDocs(prev => prev.filter(d => d.id !== doc.id));
    toast.success("Dokument slettet");
  };

  const handleDownloadUploaded = async (doc: UploadedDoc) => {
    const { data } = await supabase.storage
      .from("company-documents")
      .createSignedUrl(doc.fil_sti, 60);
    if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank");
    } else {
      toast.error("Kunne ikke generere nedlastingslenke");
    }
  };

  const isLoading = loadingDeal || loadingUploaded;
  const allEmpty = dealDocs.length === 0 && uploadedDocs.length === 0 && !isLoading;

  return (
    <div className="space-y-4">
      {/* Upload button */}
      <div className="flex justify-between items-center">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Dokumenter</h3>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx"
            multiple
            className="hidden"
            onChange={handleUpload}
          />
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
            Last opp
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {allEmpty && (
        <p className="text-xs text-muted-foreground text-center py-4">Ingen dokumenter</p>
      )}

      {/* DealBuilder documents */}
      {dealDocs.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Kontrakter (DealBuilder)</h4>
          {dealDocs.map(doc => (
            <div key={doc.id} className="p-3 bg-muted/30 rounded-lg border space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{doc.title}</p>
                  <p className="text-[10px] text-muted-foreground">{doc.dealName}</p>
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
      )}

      {/* Uploaded documents */}
      {uploadedDocs.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Opplastede dokumenter</h4>
          {uploadedDocs.map(doc => (
            <div key={doc.id} className="p-3 bg-muted/30 rounded-lg border flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                {doc.fil_type === "pdf" ? (
                  <FileText className="w-4 h-4 text-destructive shrink-0" />
                ) : (
                  <File className="w-4 h-4 text-primary shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{doc.fil_navn}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {doc.fil_type.toUpperCase()} · {formatDate(doc.created_at)}
                    {doc.opplastet_av && ` · ${doc.opplastet_av}`}
                  </p>
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleDownloadUploaded(doc)}>
                  <Download className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => handleDelete(doc)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
