import ReactMarkdown from "react-markdown";
import { Badge } from "@/components/ui/badge";
import { Mic } from "lucide-react";

interface MeetingNotesRendererProps {
  notes: string;
  source?: string | null;
  className?: string;
}

export default function MeetingNotesRenderer({ notes, source, className = "" }: MeetingNotesRendererProps) {
  // Split notes into summary and transcript sections
  const transcriptSeparator = "---\n**Transkripsjon:**";
  const hasTranscript = notes.includes(transcriptSeparator);
  const summaryPart = hasTranscript ? notes.split(transcriptSeparator)[0] : notes;
  const transcriptPart = hasTranscript ? notes.split(transcriptSeparator)[1] : null;

  return (
    <div className={`space-y-3 ${className}`}>
      {source === "trale" && (
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="text-[10px] gap-1 bg-violet-500/10 text-violet-600 border-violet-200">
            <Mic className="w-3 h-3" />
            Trale
          </Badge>
        </div>
      )}

      <div className="prose prose-sm max-w-none dark:prose-invert
        prose-headings:text-xs prose-headings:font-semibold prose-headings:mt-3 prose-headings:mb-1
        prose-p:text-xs prose-p:my-1 prose-p:leading-relaxed
        prose-li:text-xs prose-li:my-0.5
        prose-ul:my-1 prose-ol:my-1
        prose-strong:text-foreground
        prose-hr:my-2 prose-hr:border-border
      ">
        <ReactMarkdown>{summaryPart.trim()}</ReactMarkdown>
      </div>

      {transcriptPart && (
        <details className="group">
          <summary className="text-[11px] font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors flex items-center gap-1.5">
            <Mic className="w-3 h-3" />
            Vis full transkripsjon
          </summary>
          <div className="mt-2 p-3 bg-muted/40 rounded-md max-h-[300px] overflow-y-auto">
            <pre className="text-[11px] whitespace-pre-wrap font-mono text-muted-foreground leading-relaxed">
              {transcriptPart.trim()}
            </pre>
          </div>
        </details>
      )}
    </div>
  );
}
