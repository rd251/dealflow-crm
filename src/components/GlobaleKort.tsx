import { useKort } from "@/hooks/use-kort";
import KundeKort from "@/components/KundeKort";
import SelskapKort from "@/components/SelskapKort";

/** Ett kort om gangen for hele appen, styrt av ?kunde= / ?selskap= i URL-en. */
export default function GlobaleKort() {
  const { kunde, selskapId, fra, openKunde, openSelskap, lukk } = useKort();
  if (kunde) {
    return <KundeKort key={`${kunde.type}:${kunde.id}`} r={kunde} onClose={lukk} onSelskap={openSelskap} onTilbake={fra ? () => openSelskap(fra) : undefined} />;
  }
  if (selskapId) return <SelskapKort key={selskapId} id={selskapId} onClose={lukk} onKunde={r => openKunde(r, selskapId)} />;
  return null;
}
