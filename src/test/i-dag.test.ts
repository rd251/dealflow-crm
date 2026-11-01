import { describe, it, expect } from "vitest";
import { folgOppNa, filtrerVenter, erMin } from "@/lib/i-dag";

const now = new Date("2026-11-02T10:00:00");

describe("Følg opp nå", () => {
  it("slår sammen forfalte oppgaver og leads, eldst først, og hopper over fremtid/ferdig/lukket", () => {
    const rader = folgOppNa(
      [
        { id: "o1", oppgave: "Send tilbud", frist: "2026-10-30", status: "Åpen", ansvarlig: "" },
        { id: "o2", oppgave: "Framtid", frist: "2026-11-05", status: "Åpen", ansvarlig: "" },
        { id: "o3", oppgave: "Ferdig", frist: "2026-10-01", status: "Ferdig", ansvarlig: "" },
      ],
      [
        { id: "l1", kontaktperson: "Kari", firmanavn: "A AS", telefon: "", status: "Kontaktet", neste_oppfolging: "2026-10-28", ansvarlig: "" },
        { id: "l2", kontaktperson: "Ola", firmanavn: "B AS", telefon: "", status: "Ny", neste_oppfolging: "2026-11-02", ansvarlig: "" },
        { id: "l3", kontaktperson: "Nei", firmanavn: "C", telefon: "", status: "Ikke aktuelt", neste_oppfolging: "2026-10-01", ansvarlig: "" },
      ],
      now,
    );
    expect(rader.map(r => r.key)).toEqual(["l-l1", "o-o1", "l-l2"]);
    expect(rader[0].dagerForfalt).toBe(5);
    expect(rader[0].hva).toBe("Ring igjen");
    expect(rader[2].dagerForfalt).toBe(0);
  });
});

describe("Venter på svar", () => {
  it("viser ikke besvart eller avsluttet, og sorterer eldst først", () => {
    const r = filtrerVenter([
      { id: "a", status: "varslet", sendt_dato: "2026-10-20", user_id: "u" },
      { id: "b", status: "besvart", sendt_dato: "2026-10-01", user_id: "u" },
      { id: "c", status: "venter", sendt_dato: "2026-10-10", user_id: "u" },
      { id: "d", status: "avsluttet", sendt_dato: "2026-10-05", user_id: "u" },
    ]);
    expect(r.map(x => x.id)).toEqual(["c", "a"]);
  });
});

describe("Mine / Teamet", () => {
  const meg = { userId: "me-1", navn: ["Robin Sæter Diallo", "rd@snakk.ai"] };
  it("Teamet viser alt", () => expect(erMin("teamet", meg, { ansvarlig: "Joakim" })).toBe(true));
  it("Mine matcher ansvarlig-navn, eier_id og user_id", () => {
    expect(erMin("mine", meg, { ansvarlig: "Robin Sæter Diallo" })).toBe(true);
    expect(erMin("mine", meg, { eier_id: "me-1" })).toBe(true);
    expect(erMin("mine", meg, { user_id: "me-1" })).toBe(true);
    expect(erMin("mine", meg, { ansvarlig: "me-1" })).toBe(true);
  });
  it("Mine skjuler andres og tomme", () => {
    expect(erMin("mine", meg, { ansvarlig: "Joakim", user_id: "x" })).toBe(false);
    expect(erMin("mine", meg, { ansvarlig: "" })).toBe(false);
  });
});
