import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { oppgaveFraLogg } from "@/lib/logg-utfall";

const loggAktivitet = vi.fn();
const updateOppgaver = vi.fn();
const updateLeads = vi.fn();
const lead = { id: "lead-1", firmanavn: "Fjordkafé AS", kontaktperson: "Lars", status: "Kontaktet", ansvarlig: "u1", neste_oppfolging: "", senere_til: "" };

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: vi.fn(), auth: { getSession: vi.fn() } } }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("@/lib/activity-logging", async (orig) => ({ ...(await orig<typeof import("@/lib/activity-logging")>()), loggAktivitet: (...a: unknown[]) => loggAktivitet(...a) }));
vi.mock("@/hooks/use-crm-store", () => ({
  useCrmStore: () => ({
    leads: [lead], salgsmuligheter: [], kontakter: [], selskaper: [], oppgaver: [],
    updateLeads, updateOppgaver, updateSalgsmuligheter: vi.fn(), konverterLead: vi.fn(),
  }),
}));

import LoggUtfall from "@/components/LoggUtfall";
import { nesteStegOppgaveRad } from "@/lib/activity-logging";

/** Oppgaver som ble lagt til (ikke bare endret) via updateOppgaver. */
const nyeOppgaver = () => updateOppgaver.mock.calls.flatMap(([fn]) => {
  const etter = (fn as (p: unknown[]) => { id: string }[])([]);
  return etter;
});

describe("oppgaver lages bare manuelt", () => {
  beforeEach(() => { loggAktivitet.mockReset().mockResolvedValue({ id: "a1", nesteOppfolging: "", ikkeAktuelt: false }); updateOppgaver.mockReset(); updateLeads.mockReset(); });

  it("neste steg alene lager ingen oppgave ved aktivitetslogging", () => {
    expect(nesteStegOppgaveRad({ target: { lead_id: "lead-1" }, nesteSteg: "Send tilbud", nesteStegDato: "2026-12-01" }, "u1")).toBeNull();
  });

  it("eksplisitt valgt oppgave ved aktivitetslogging gir én oppgave med neste steg", () => {
    const rad = nesteStegOppgaveRad({ target: { lead_id: "lead-1" }, nesteSteg: "Send tilbud", nesteStegDato: "2026-12-01", opprettOppgave: true }, "u1");
    expect(rad).toMatchObject({ oppgave: "Send tilbud", frist: "2026-12-01", lead_id: "lead-1" });
  });

  it("«Opprett oppgave» av gir ingen oppgave, selv med tittel og dato", () => {
    expect(oppgaveFraLogg({ opprett: false, tittel: "Ring Lars", dato: "2026-12-01" })).toBeNull();
  });

  it("«Opprett oppgave» på krever både tittel og forfallsdato", () => {
    expect(oppgaveFraLogg({ opprett: true, tittel: "Ring Lars", dato: "" })).toBeNull();
    expect(oppgaveFraLogg({ opprett: true, tittel: "  ", dato: "2026-12-01" })).toBeNull();
    expect(oppgaveFraLogg({ opprett: true, tittel: "Ring Lars", dato: "2026-12-01", tid: "09:00" })).toEqual({ oppgave: "Ring Lars", frist: "2026-12-01", frist_tid: "09:00" });
  });

  it("logging av «Snakket med» med forhåndsutfylt oppfølging lager ingen oppgave, men setter oppfølging på leadet", async () => {
    render(<MemoryRouter><LoggUtfall target={{ lead_id: "lead-1" }} /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: /Snakket med/ }));
    const oppfolging = (screen.getByLabelText("Dato for neste oppfølging") as HTMLInputElement).value;
    expect(oppfolging).not.toBe("");
    fireEvent.click(screen.getByRole("button", { name: "Lagre" }));
    await waitFor(() => expect(loggAktivitet).toHaveBeenCalledTimes(1));
    expect(loggAktivitet.mock.calls[0][0]).toMatchObject({ nesteOppfolging: oppfolging });
    await waitFor(() => expect(updateLeads).toHaveBeenCalled());
    expect(nyeOppgaver()).toHaveLength(0);
  });

  it("med «Opprett oppgave» slått på lagres nøyaktig én oppgave med valgt tittel, dato og kobling", async () => {
    render(<MemoryRouter><LoggUtfall target={{ lead_id: "lead-1" }} /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: /Snakket med/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Opprett oppgave" }));
    fireEvent.change(screen.getByLabelText("Tittel på oppgaven"), { target: { value: "Send tilbud til Lars" } });
    fireEvent.change(screen.getByLabelText("Forfallsdato for oppgaven"), { target: { value: "2026-12-03" } });
    fireEvent.click(screen.getByRole("button", { name: "Lagre" }));
    await waitFor(() => expect(nyeOppgaver()).toHaveLength(1));
    expect(nyeOppgaver()[0]).toMatchObject({ oppgave: "Send tilbud til Lars", frist: "2026-12-03", lead_id: "lead-1", status: "Åpen" });
  });
});
