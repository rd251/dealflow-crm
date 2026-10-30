import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import ActivityLog from "@/components/ActivityLog";
import { TooltipProvider } from "@/components/ui/tooltip";

vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: { id: "test-user" } }) }));
vi.mock("@/components/LogActivityDialog", () => ({
  default: ({ onLogged }: { onLogged: (res: unknown) => void }) =>
    <button onClick={() => onLogged({ id: "activity-test", nesteOppfolging: "", ikkeAktuelt: true })}>Submit outcome</button>,
}));

afterEach(() => vi.unstubAllGlobals());

it("forwards the saved not-interested outcome from the dialog to the lead detail callback", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
  const onActivityLogged = vi.fn();
  render(<TooltipProvider><ActivityLog lead_id="lead-test" onActivityLogged={onActivityLogged} /></TooltipProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Submit outcome" }));
  await waitFor(() => expect(onActivityLogged).toHaveBeenCalledWith({
    id: "activity-test", nesteOppfolging: "", ikkeAktuelt: true,
  }));
});