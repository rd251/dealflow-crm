import { describe, it, expect } from "vitest";
import { forslagDager, leadStatusEtterUtfall, fyllMal, smsLenke } from "@/lib/kundekort";

describe("kundekort", () => {
  it("«Ikke svar» foreslår ny ring om 2 dager", () => expect(forslagDager("ikke_svar")).toBe(2));
  it("«Ikke interessert» og «Booket møte» foreslår ingen ny oppgave", () => {
    expect(forslagDager("ikke_interessert")).toBeNull();
    expect(forslagDager("booket")).toBeNull();
  });
  it("«Ikke interessert» setter lead til Ikke aktuelt", () => expect(leadStatusEtterUtfall("Kontaktet", "ikke_interessert")).toBe("Ikke aktuelt"));
  it("«Ikke svar» på nytt lead gir Svarte ikke telefon", () => expect(leadStatusEtterUtfall("Ny", "ikke_svar")).toBe("Svarte ikke telefon"));
  it("fyller {fornavn} og {firma}", () => expect(fyllMal("Hei {fornavn} i {firma}", { fornavn: "Ajmal", firma: "Auto AS" })).toBe("Hei Ajmal i Auto AS"));
  it("sms-lenke har nummer uten mellomrom og kodet tekst", () => expect(smsLenke("934 38 816", "Hei du")).toBe("sms:93438816?body=Hei%20du"));
});
