import { describe, it, expect } from "vitest";
import {
  epostAdresser, epostKontaktTekst, epostTraadId, harEpostTraad, renAktivitetstekst,
} from "@/lib/aktivitet-visning";

const EKSEMPEL = "[threadId:1a178580a1570447] [jr@utvendigrenhold.no] Hei Jonathan, takk for sist. Ser fram til møtet.";

describe("Aktivitetsvisning", () => {
  it("fjerner threadId og adressetaggar frå brødteksten", () => {
    expect(renAktivitetstekst(EKSEMPEL)).toBe("Hei Jonathan, takk for sist. Ser fram til møtet.");
  });

  it("fjerner fleire adressetaggar og fleire threadId-taggar", () => {
    expect(renAktivitetstekst("[threadId:abc] [a@x.no][b@y.no] Hei [threadId:abc] på deg")).toBe("Hei på deg");
  });

  it("tekst utan taggar blirståande som han er", () => {
    expect(renAktivitetstekst("  Ringte ikkje oppatt  ")).toBe("Ringte ikkje oppatt");
    expect(renAktivitetstekst("")).toBe("");
    expect(renAktivitetstekst(null)).toBe("");
  });

  it("les threadId og adresser", () => {
    expect(epostTraadId(EKSEMPEL)).toBe("1a178580a1570447");
    expect(epostAdresser(EKSEMPEL)).toEqual(["jr@utvendigrenhold.no"]);
    expect(harEpostTraad(EKSEMPEL)).toBe(true);
    expect(harEpostTraad("Vanleg notat")).toBe(false);
    expect(epostTraadId("Vanleg notat")).toBeNull();
  });

  it("skriv ut HTML-eintetar frå Gmail-snippets", () => {
    expect(renAktivitetstekst("Robin &lt;rd@snakk.ai&gt; &amp; Kari &#39;en&#39;")).toBe("Robin <rd@snakk.ai> & Kari 'en'");
  });

  it("kontaktlinje seier til for utgåande og fra for innkommande", () => {
    expect(epostKontaktTekst(EKSEMPEL, true)).toBe("til jr@utvendigrenhold.no");
    expect(epostKontaktTekst(EKSEMPEL, false)).toBe("fra jr@utvendigrenhold.no");
    expect(epostKontaktTekst("Vanleg notat", true)).toBeNull();
  });
});
