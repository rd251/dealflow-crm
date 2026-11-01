import { describe, it, expect } from "vitest";
import { leadKvalitet, erGyldigNorskTelefon, komInnTekst, nesteTekst, ekteOnske } from "@/lib/lead-kort";

const now = new Date("2026-11-01T12:00:00");

describe("datakvalitet", () => {
  it("firmanavn på 1–2 tegn er uklart", () => {
    expect(leadKvalitet({ firmanavn: "AS", kontaktperson: "Ola Hansen" }).firmaUklart).toBe(true);
  });
  it("firmanavn lengre enn 40 tegn er uklart", () => {
    expect(leadKvalitet({ firmanavn: "x".repeat(41), kontaktperson: "Ola" }).firmaUklart).toBe(true);
  });
  it("firmanavn lik kontaktpersonens fornavn er uklart", () => {
    expect(leadKvalitet({ firmanavn: "Ola", kontaktperson: "Ola Hansen" }).firmaUklart).toBe(true);
  });
  it("vanlig firmanavn er OK", () => {
    expect(leadKvalitet({ firmanavn: "Auto Vest AS", kontaktperson: "Ola Hansen" }).firmaUklart).toBe(false);
  });
  it("+1-nummer er ugyldig", () => {
    expect(erGyldigNorskTelefon("+1 555 123 4567")).toBe(false);
  });
  it("mer enn 12 sifre er ugyldig", () => {
    expect(erGyldigNorskTelefon("4793438816123")).toBe(false);
  });
  it("norske mobil- og fastnummer er gyldige", () => {
    expect(erGyldigNorskTelefon("+47 934 38 816")).toBe(true);
    expect(erGyldigNorskTelefon("22 33 44 55")).toBe(true);
  });
});

describe("kortlinjer", () => {
  it("I dag / I går / dato", () => {
    expect(komInnTekst("2026-11-01", now)).toBe("I dag");
    expect(komInnTekst("2026-10-31", now)).toBe("I går");
    expect(komInnTekst("2026-10-29", now)).toBe("29. okt");
  });
  it("forfalt oppfølging haster", () => {
    expect(nesteTekst("2026-10-30", "Kontaktet", now)).toEqual({ tekst: "Neste: Ring i dag", haster: true });
    expect(nesteTekst("2026-11-03", "Kontaktet", now)).toEqual({ tekst: "Ring igjen 3. nov", haster: false });
  });
  it("fylltekst gir ingen «Ønsker»", () => {
    expect(ekteOnske("Leadet har ikke oppgitt hva de ønsker hjelp med")).toBeNull();
    expect(ekteOnske("Det fremgår ikke hva leadet ønsker hjelp med.")).toBeNull();
    expect(ekteOnske("AI på telefon")).toBe("AI på telefon");
  });
});
