import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const stateRaw = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    if (error || !code || !stateRaw) {
      const state = stateRaw ? JSON.parse(stateRaw) : {};
      const redirect = state.app_redirect || '/';
      return new Response(null, {
        status: 302,
        headers: { Location: `${redirect}?gcal_error=${error || 'missing_code'}` },
      });
    }

    const state = JSON.parse(stateRaw);
    const { user_id, app_redirect } = state;

    const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')!;
    const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!;
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/google-calendar-callback`;

    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await tokenRes.json();
    if (!tokenRes.ok) {
      return new Response(null, {
        status: 302,
        headers: { Location: `${app_redirect}?gcal_error=token_exchange_failed` },
      });
    }

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // Store tokens using service role
    const supabase = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { error: dbError } = await supabase
      .from('google_calendar_connections')
      .upsert({
        user_id,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: expiresAt,
      }, { onConflict: 'user_id' });

    if (dbError) {
      console.error('DB error:', dbError);
      return new Response(null, {
        status: 302,
        headers: { Location: `${app_redirect}?gcal_error=db_error` },
      });
    }

    return new Response(null, {
      status: 302,
      headers: { Location: `${app_redirect}?gcal_connected=true` },
    });
  } catch (e) {
    console.error('Callback error:', e);
    return new Response(`Error: ${e.message}`, { status: 500 });
  }
});
