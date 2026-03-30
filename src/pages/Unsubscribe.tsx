import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

type Status = "loading" | "valid" | "already_unsubscribed" | "invalid" | "success" | "error";

export default function Unsubscribe() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<Status>("loading");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      return;
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    fetch(`${supabaseUrl}/functions/v1/handle-email-unsubscribe?token=${token}`, {
      headers: { apikey: anonKey },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.valid === true) setStatus("valid");
        else if (data.reason === "already_unsubscribed") setStatus("already_unsubscribed");
        else setStatus("invalid");
      })
      .catch(() => setStatus("error"));
  }, [token]);

  const handleUnsubscribe = async () => {
    if (!token) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke("handle-email-unsubscribe", {
        body: { token },
      });
      if (error) throw error;
      setStatus("success");
    } catch {
      setStatus("error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <h1 className="text-2xl font-bold text-foreground">E-post innstillinger</h1>

        {status === "loading" && (
          <p className="text-muted-foreground">Laster...</p>
        )}

        {status === "valid" && (
          <div className="space-y-4">
            <p className="text-muted-foreground">
              Vil du stoppe å motta automatiske e-poster fra Snakk?
            </p>
            <button
              onClick={handleUnsubscribe}
              disabled={submitting}
              className="w-full bg-destructive text-destructive-foreground py-3 px-6 rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50"
            >
              {submitting ? "Avmelder..." : "Bekreft avmelding"}
            </button>
          </div>
        )}

        {status === "success" && (
          <p className="text-muted-foreground">
            Du er nå avmeldt. Du vil ikke motta flere automatiske e-poster.
          </p>
        )}

        {status === "already_unsubscribed" && (
          <p className="text-muted-foreground">
            Du er allerede avmeldt fra e-poster.
          </p>
        )}

        {status === "invalid" && (
          <p className="text-destructive">
            Ugyldig eller utløpt avmeldingslenke.
          </p>
        )}

        {status === "error" && (
          <p className="text-destructive">
            Noe gikk galt. Prøv igjen senere.
          </p>
        )}
      </div>
    </div>
  );
}
