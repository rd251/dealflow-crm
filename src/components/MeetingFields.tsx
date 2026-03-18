import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface MeetingFieldsProps {
  tittel: string;
  startTid: string;
  sluttTid: string;
  dato: string;
  onTittelChange: (v: string) => void;
  onStartTidChange: (v: string) => void;
  onSluttTidChange: (v: string) => void;
  onDatoChange: (v: string) => void;
}

export default function MeetingFields({
  tittel, startTid, sluttTid, dato,
  onTittelChange, onStartTidChange, onSluttTidChange, onDatoChange,
}: MeetingFieldsProps) {
  return (
    <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
      <div>
        <Label className="text-xs">Tittel</Label>
        <Input
          value={tittel}
          onChange={e => onTittelChange(e.target.value)}
          placeholder="Møtetittel..."
          className="h-8 text-sm mt-1"
        />
      </div>
      <div>
        <Label className="text-xs">Dato</Label>
        <Input
          type="date"
          value={dato}
          onChange={e => onDatoChange(e.target.value)}
          className="h-8 text-sm mt-1"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Starttid</Label>
          <Input
            type="time"
            value={startTid}
            onChange={e => onStartTidChange(e.target.value)}
            className="h-8 text-sm mt-1"
          />
        </div>
        <div>
          <Label className="text-xs">Sluttid</Label>
          <Input
            type="time"
            value={sluttTid}
            onChange={e => onSluttTidChange(e.target.value)}
            className="h-8 text-sm mt-1"
          />
        </div>
      </div>
    </div>
  );
}
