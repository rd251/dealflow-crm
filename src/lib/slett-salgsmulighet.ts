import { supabase } from "@/integrations/supabase/client";

/**
 * Flytter koblede aktiviteter (e-post, møter, notater) over til selskapet før
 * salgsmuligheten slettes, slik at historikken ikke forsvinner. Selve slettingen
 * (med arkiv i papirkurven) gjøres av CRM-storet etterpå.
 */
export async function slettSalgsmulighetTrygt(salgsmulighetId: string, selskapId: string | null) {
  if (selskapId) {
    const { error } = await supabase.from("aktiviteter")
      .update({ selskap_id: selskapId })
      .eq("salgsmulighet_id", salgsmulighetId)
      .is("selskap_id", null);
    if (error) throw error;
  }
  const { error } = await supabase.from("aktiviteter")
    .update({ salgsmulighet_id: null })
    .eq("salgsmulighet_id", salgsmulighetId);
  if (error) throw error;
}
