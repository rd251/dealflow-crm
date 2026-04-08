import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { RefreshCw, FileText, CheckCircle2, AlertTriangle } from "lucide-react";

interface UnmatchedDoc {
  id: string;
  title: string;
  status: string;
  createdDate: string;
  signatoryEmail: string | null;
  signatoryCompany: string | null;
}

interface SyncResult {
  total: number;
  matched: number;
  unmatched: number;
  unmatchedDocuments: UnmatchedDoc[];
}

export default function DealBuilderSyncCard() {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);

  const runSync = async () => {
    setSyncing(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("dealbuilder-sync-all");
      if (error) throw error;
      setResult(data as SyncResult);
      toast.success(`${data.matched} kontrakter synket, ${data.unmatched} ikke matchet`);
    } catch (e: any) {
      toast.error("Synkronisering feilet: " + e.message);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <FileText className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-lg">DealBuilder-kontrakter</CardTitle>
            <CardDescription>
              Synkroniser alle kontrakter fra DealBuilder og match mot selskaper i CRM
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={runSync} disabled={syncing} variant="outline" size="sm" className="gap-2">
          <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Synkroniserer..." : "Synk DealBuilder-kontrakter"}
        </Button>

        {syncing && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Henter dokumenter fra DealBuilder...</p>
            <Progress value={undefined} className="h-2" />
          </div>
        )}

        {result && !syncing && (
          <div className="space-y-3">
            <div className="flex gap-3 flex-wrap">
              <Badge variant="secondary" className="gap-1">
                Totalt: {result.total}
              </Badge>
              <Badge className="gap-1 bg-success/10 text-success border-0">
                <CheckCircle2 className="w-3 h-3" />
                Matchet: {result.matched}
              </Badge>
              {result.unmatched > 0 && (
                <Badge className="gap-1 bg-warning/10 text-warning border-0">
                  <AlertTriangle className="w-3 h-3" />
                  Ikke matchet: {result.unmatched}
                </Badge>
              )}
            </div>

            {result.unmatchedDocuments.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Ikke-matchede dokumenter
                </h4>
                <div className="max-h-64 overflow-y-auto space-y-1.5">
                  {result.unmatchedDocuments.map(doc => (
                    <div key={doc.id} className="p-2.5 bg-muted/30 rounded-lg border text-xs space-y-1">
                      <p className="font-medium">{doc.title}</p>
                      <div className="flex gap-3 text-muted-foreground">
                        {doc.signatoryEmail && <span>E-post: {doc.signatoryEmail}</span>}
                        {doc.signatoryCompany && <span>Firma: {doc.signatoryCompany}</span>}
                        <span>Status: {doc.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
