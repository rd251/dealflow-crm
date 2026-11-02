import { describe, it, expect } from "vitest";
import { erSenere, ikkeNaaDato, forslagOppfolging, ringTilbakeTid, oppfolgingTittel, leadStatusEtterValg, erGjeldendeOppfolging, lukkerOppgave } from "@/lib/logg-utfall";

const naa = new Date(2026, 10, 2, 12, 3); // man 2. nov 12:03

describe("felles logg – Hva skjedde?", () => {
  it("Svarte ikke → ny ring om 2 dager", () => expect(forslagOppfolging("svarte_ikke", naa)).toEqual({ dato: "2026-11-04", tid: "" }));
  it("Ikke nå → standard 3 mnd", () => expect(forslagOppfolging("ikke_naa", naa).dato).toBe("2027-02-02"));
  it("Ikke nå 1 og 6 mnd", () => { expect(ikkeNaaDato(1, naa).dato).toBe("2026-12-02"); expect(ikkeNaaDato(6, naa).dato).toBe("2027-05-02"); });
  it("Senere avsluttes automatisk når datoen er nådd", () => {
    expect(erSenere("2027-02-02", "2026-11-02")).toBe(true);
    expect(erSenere("2027-02-02", "2027-02-02")).toBe(false);
    expect(erSenere("", "2026-11-02")).toBe(false);
  });
  it("Ikke interessert og Notat → ingen ny oppgave", () => {
    expect(forslagOppfolging("ikke_interessert", naa).dato).toBe("");
    expect(forslagOppfolging("notat", naa).dato).toBe("");
  });
  it("Ring tilbake om 10 min avrundes opp til 5 min", () => expect(ringTilbakeTid("10min", naa)).toEqual({ dato: "2026-11-02", tid: "12:15" }));
  it("Ring tilbake om 1 time", () => expect(ringTilbakeTid("1t", naa)).toEqual({ dato: "2026-11-02", tid: "13:05" }));
  it("Ring tilbake i ettermiddag = 14:00 i dag", () => expect(ringTilbakeTid("ettermiddag", naa)).toEqual({ dato: "2026-11-02", tid: "14:00" }));
  it("Ring tilbake i morgen = 09:00", () => expect(ringTilbakeTid("imorgen", naa)).toEqual({ dato: "2026-11-03", tid: "09:00" }));
  it("Oppfølgingstittel for ring starter med «Ring» (får 📞)", () => expect(oppfolgingTittel("svarte_ikke", "Lars")).toBe("Ring Lars igjen"));
  it("Ikke interessert → Ikke aktuelt", () => expect(leadStatusEtterValg("Kontaktet", "ikke_interessert")).toBe("Ikke aktuelt"));
  it("Notat lukker ikke oppgaven", () => expect(lukkerOppgave("notat")).toBe(false));
  it("Forfalt oppgave regnes som gjeldende, framtidig vanlig oppgave ikke", () => {
    expect(erGjeldendeOppfolging({ oppgave: "Send tilbud", frist: "2026-11-01", status: "Åpen" }, "2026-11-02")).toBe(true);
    expect(erGjeldendeOppfolging({ oppgave: "Send tilbud", frist: "2026-11-10", status: "Åpen" }, "2026-11-02")).toBe(false);
  });
});
