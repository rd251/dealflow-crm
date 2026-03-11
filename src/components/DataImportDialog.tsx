import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

export type ImportTarget = "leads" | "selskaper" | "kontakter";

interface FieldMapping {
  dbField: string;
  label: string;
  required?: boolean;
}

const fieldMappings: Record<ImportTarget, FieldMapping[]> = {
  leads: [
    { dbField: "firmanavn", label: "Firmanavn", required: true },
    { dbField: "kontaktperson", label: "Kontaktperson" },
    { dbField: "e_post", label: "E-post" },
    { dbField: "telefon", label: "Telefon" },
    { dbField: "kilde", label: "Kilde" },
    { dbField: "ansvarlig", label: "Ansvarlig" },
    { dbField: "neste_steg", label: "Neste steg" },
    { dbField: "notater", label: "Notater" },
  ],
  selskaper: [
    { dbField: "firmanavn", label: "Firmanavn", required: true },
    { dbField: "bransje", label: "Bransje" },
    { dbField: "kundeansvarlig", label: "Kundeansvarlig" },
    { dbField: "mrr", label: "MRR" },
    { dbField: "arr", label: "ARR" },
    { dbField: "notater", label: "Notater" },
  ],
  kontakter: [
    { dbField: "navn", label: "Navn", required: true },
    { dbField: "rolle", label: "Rolle" },
    { dbField: "e_post", label: "E-post" },
    { dbField: "telefon", label: "Telefon" },
    { dbField: "linkedin", label: "LinkedIn" },
    { dbField: "notater", label: "Notater" },
  ],
};

const targetLabels: Record<ImportTarget, string> = {
  leads: "leads",
  selskaper: "selskaper",
  kontakter: "kontakter",
};

interface DataImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: ImportTarget;
  onImport: (rows: Record<string, any>[]) => Promise<{ success: number; errors: number }>;
}

export default function DataImportDialog({ open, onOpenChange, target, onImport }: DataImportDialogProps) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsedRows, setParsedRows] = useState<Record<string, any>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [step, setStep] = useState<"upload" | "map" | "preview" | "done">("upload");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ success: number; errors: number } | null>(null);

  const fields = fieldMappings[target];

  const reset = () => {
    setParsedRows([]);
    setHeaders([]);
    setColumnMapping({});
    setStep("upload");
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });

      if (json.length === 0) {
        toast({ title: "Tom fil", description: "Filen inneholder ingen rader.", variant: "destructive" });
        return;
      }

      const fileHeaders = Object.keys(json[0]);
      setHeaders(fileHeaders);
      setParsedRows(json);

      // Auto-map columns by fuzzy matching
      const mapping: Record<string, string> = {};
      for (const field of fields) {
        const match = fileHeaders.find(h => {
          const lower = h.toLowerCase().replace(/[_\-\s]/g, "");
          const fieldLower = field.dbField.toLowerCase().replace(/[_\-\s]/g, "");
          const labelLower = field.label.toLowerCase().replace(/[_\-\s]/g, "");
          return lower === fieldLower || lower === labelLower || lower.includes(fieldLower) || lower.includes(labelLower);
        });
        if (match) mapping[field.dbField] = match;
      }
      setColumnMapping(mapping);
      setStep("map");
    } catch (err) {
      toast({ title: "Feil ved lesing", description: "Kunne ikke lese filen. Sjekk format.", variant: "destructive" });
    }
  };

  const mappedRows = parsedRows.map(row => {
    const mapped: Record<string, any> = {};
    for (const field of fields) {
      const sourceCol = columnMapping[field.dbField];
      if (sourceCol) {
        mapped[field.dbField] = row[sourceCol];
      }
    }
    return mapped;
  });

  const requiredFields = fields.filter(f => f.required);
  const validRows = mappedRows.filter(row =>
    requiredFields.every(f => row[f.dbField] && String(row[f.dbField]).trim() !== "")
  );

  const handleImport = async () => {
    setImporting(true);
    try {
      const res = await onImport(validRows);
      setResult(res);
      setStep("done");
      if (res.success > 0) {
        toast({ title: "Import fullført", description: `${res.success} ${targetLabels[target]} importert.` });
      }
      if (res.errors > 0) {
        toast({ title: "Noen rader feilet", description: `${res.errors} rader kunne ikke importeres.`, variant: "destructive" });
      }
    } catch {
      toast({ title: "Feil", description: "Noe gikk galt under importen.", variant: "destructive" });
    }
    setImporting(false);
  };

  const handleClose = (open: boolean) => {
    if (!open) reset();
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            Importer {targetLabels[target]}
          </DialogTitle>
          <DialogDescription>
            Last opp en CSV- eller Excel-fil for å importere {targetLabels[target]} i bulk.
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4">
            <div
              className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-accent/30 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
              <p className="font-medium text-sm">Klikk for å velge fil</p>
              <p className="text-xs text-muted-foreground mt-1">CSV eller Excel (.xlsx, .xls)</p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={handleFile}
            />
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs font-medium mb-1.5">Forventede kolonner:</p>
              <div className="flex flex-wrap gap-1.5">
                {fields.map(f => (
                  <Badge key={f.dbField} variant={f.required ? "default" : "secondary"} className="text-xs">
                    {f.label}{f.required ? " *" : ""}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === "map" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Koble kolonnene i filen til de riktige feltene. {parsedRows.length} rader funnet.
            </p>
            <div className="space-y-2">
              {fields.map(field => (
                <div key={field.dbField} className="flex items-center gap-3">
                  <label className="text-sm w-32 shrink-0">
                    {field.label}{field.required && <span className="text-destructive"> *</span>}
                  </label>
                  <select
                    className="flex-1 border rounded-md px-3 py-1.5 text-sm bg-background"
                    value={columnMapping[field.dbField] || ""}
                    onChange={e => setColumnMapping(prev => ({ ...prev, [field.dbField]: e.target.value }))}
                  >
                    <option value="">– Ikke koble –</option>
                    {headers.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div className="flex justify-between items-center pt-2">
              <Button variant="outline" size="sm" onClick={reset}>Tilbake</Button>
              <div className="flex items-center gap-2">
                {validRows.length < parsedRows.length && (
                  <span className="text-xs text-warning flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {parsedRows.length - validRows.length} rader mangler påkrevde felter
                  </span>
                )}
                <Button
                  size="sm"
                  disabled={validRows.length === 0}
                  onClick={() => setStep("preview")}
                >
                  Forhåndsvis ({validRows.length} rader)
                </Button>
              </div>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{validRows.length} rader klare for import.</p>
            <div className="border rounded-lg overflow-auto max-h-60">
              <table className="w-full text-xs">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    {fields.filter(f => columnMapping[f.dbField]).map(f => (
                      <th key={f.dbField} className="text-left px-2 py-1.5 font-medium">{f.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {validRows.slice(0, 20).map((row, i) => (
                    <tr key={i} className="border-t">
                      {fields.filter(f => columnMapping[f.dbField]).map(f => (
                        <td key={f.dbField} className="px-2 py-1 truncate max-w-[200px]">
                          {String(row[f.dbField] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {validRows.length > 20 && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  ... og {validRows.length - 20} rader til
                </p>
              )}
            </div>
            <div className="flex justify-between pt-2">
              <Button variant="outline" size="sm" onClick={() => setStep("map")}>Tilbake</Button>
              <Button size="sm" onClick={handleImport} disabled={importing}>
                {importing ? "Importerer..." : `Importer ${validRows.length} rader`}
              </Button>
            </div>
          </div>
        )}

        {step === "done" && result && (
          <div className="text-center py-6 space-y-3">
            <CheckCircle2 className="w-12 h-12 mx-auto text-success" />
            <p className="font-medium">{result.success} {targetLabels[target]} importert</p>
            {result.errors > 0 && (
              <p className="text-sm text-destructive">{result.errors} rader feilet</p>
            )}
            <Button variant="outline" size="sm" onClick={() => handleClose(false)}>Lukk</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
