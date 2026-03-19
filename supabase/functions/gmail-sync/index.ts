import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')!;
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number } | null> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) return null;
  return await res.json();
}

async function getValidAccessToken(supabase: any, connection: any): Promise<string | null> {
  const now = new Date();
  const expiresAt = new Date(connection.token_expires_at);

  if (expiresAt > new Date(now.getTime() + 60000)) {
    return connection.access_token;
  }

  const refreshed = await refreshAccessToken(connection.refresh_token);
  if (!refreshed) return null;

  const newExpires = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
  await supabase.from('google_calendar_connections').update({
    access_token: refreshed.access_token,
    token_expires_at: newExpires,
  }).eq('user_id', connection.user_id);

  return refreshed.access_token;
}

interface GmailMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  payload: {
    headers: { name: string; value: string }[];
    mimeType: string;
  };
  internalDate: string;
}

function getHeader(msg: GmailMessage, name: string): string {
  return msg.payload?.headers?.find(
    (h) => h.name.toLowerCase() === name.toLowerCase()
  )?.value || '';
}

function extractEmails(headerValue: string): string[] {
  const emailRegex = /[\w.+-]+@[\w.-]+\.\w+/g;
  return (headerValue.match(emailRegex) || []).map(e => e.toLowerCase());
}

async function fetchGmailMessages(accessToken: string, historyId?: string | null) {
  const allMessages: GmailMessage[] = [];

  if (historyId) {
    // Incremental sync via history
    const historyUrl = `https://gmail.googleapis.com/gmail/v1/users/me/history?startHistoryId=${historyId}&historyTypes=messageAdded&maxResults=100`;
    const res = await fetch(historyUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (res.status === 404) {
      // historyId expired, need full sync
      return { messages: [], newHistoryId: null, needFullSync: true };
    }

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gmail History API error [${res.status}]: ${err}`);
    }

    const data = await res.json();
    const messageIds = new Set<string>();

    for (const h of data.history || []) {
      for (const msg of h.messagesAdded || []) {
        messageIds.add(msg.message.id);
      }
    }

    // Fetch full message details
    for (const msgId of messageIds) {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Date`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (msgRes.ok) {
        allMessages.push(await msgRes.json());
      }
    }

    return { messages: allMessages, newHistoryId: data.historyId, needFullSync: false };
  }

  // Full sync: fetch recent messages (last 30 days)
  const after = Math.floor((Date.now() - 30 * 86400000) / 1000);
  let pageToken: string | undefined;
  const messageIds: string[] = [];

  do {
    const params = new URLSearchParams({
      q: `after:${after}`,
      maxResults: '100',
    });
    if (pageToken) params.set('pageToken', pageToken);

    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gmail List API error [${res.status}]: ${err}`);
    }

    const data = await res.json();
    for (const msg of data.messages || []) {
      messageIds.push(msg.id);
    }
    pageToken = data.nextPageToken;
  } while (pageToken && messageIds.length < 500);

  // Fetch message details in batches
  for (const msgId of messageIds) {
    const msgRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Date`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (msgRes.ok) {
      allMessages.push(await msgRes.json());
    }
  }

  // Get current historyId from profile
  const profileRes = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/profile',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  let newHistoryId: string | null = null;
  if (profileRes.ok) {
    const profile = await profileRes.json();
    newHistoryId = profile.historyId;
  }

  return { messages: allMessages, newHistoryId, needFullSync: false };
}

async function syncGmailForUser(supabase: any, connection: any) {
  if (!connection.gmail_sync_enabled) {
    return { synced: 0, error: null };
  }

  const accessToken = await getValidAccessToken(supabase, connection);
  if (!accessToken) {
    return { synced: 0, error: 'token_refresh_failed' };
  }

  // Get user's own email for direction detection
  const profileRes = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/profile',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  let userEmail = '';
  if (profileRes.ok) {
    const profile = await profileRes.json();
    userEmail = profile.emailAddress?.toLowerCase() || '';
  }

  let result = await fetchGmailMessages(accessToken, connection.gmail_history_id);

  if (result.needFullSync) {
    result = await fetchGmailMessages(accessToken, null);
  }

  // Get all kontakter for matching
  const { data: kontakter } = await supabase
    .from('kontakter')
    .select('id, e_post, selskap_id');

  const emailToKontakt = new Map<string, { id: string; selskap_id: string | null }>();
  for (const k of kontakter || []) {
    if (k.e_post) emailToKontakt.set(k.e_post.toLowerCase(), { id: k.id, selskap_id: k.selskap_id });
  }

  // Also get leads for matching
  const { data: leads } = await supabase
    .from('leads')
    .select('id, e_post');

  const emailToLead = new Map<string, string>();
  for (const l of leads || []) {
    if (l.e_post) emailToLead.set(l.e_post.toLowerCase(), l.id);
  }

  // Get salgsmuligheter for matching
  const { data: salgsmuligheter } = await supabase
    .from('salgsmuligheter')
    .select('id, e_post, kontakt_id');

  const kontaktToSalgsmulighet = new Map<string, string>();
  for (const s of salgsmuligheter || []) {
    if (s.kontakt_id) kontaktToSalgsmulighet.set(s.kontakt_id, s.id);
    if (s.e_post) {
      const kontakt = emailToKontakt.get(s.e_post.toLowerCase());
      if (kontakt) kontaktToSalgsmulighet.set(kontakt.id, s.id);
    }
  }

  let synced = 0;

  for (const msg of result.messages) {
    const eksternId = msg.id;
    const subject = getHeader(msg, 'Subject') || '(Uten emne)';
    const from = getHeader(msg, 'From');
    const to = getHeader(msg, 'To');
    const dateStr = getHeader(msg, 'Date');
    const snippet = msg.snippet || '';

    const fromEmails = extractEmails(from);
    const toEmails = extractEmails(to);

    // Determine direction
    const isSent = fromEmails.some(e => e === userEmail) || (msg.labelIds || []).includes('SENT');
    const direction = isSent ? 'gmail_sendt' : 'gmail_mottatt';

    // Find matching kontakt
    const relevantEmails = isSent ? toEmails : fromEmails;
    let kontaktId: string | null = null;
    let selskapId: string | null = null;
    let leadId: string | null = null;
    let salgsmulighetId: string | null = null;

    for (const email of relevantEmails) {
      const kontakt = emailToKontakt.get(email);
      if (kontakt) {
        kontaktId = kontakt.id;
        selskapId = kontakt.selskap_id;
        salgsmulighetId = kontaktToSalgsmulighet.get(kontakt.id) || null;
        break;
      }
      const lead = emailToLead.get(email);
      if (lead) {
        leadId = lead;
        break;
      }
    }

    // Skip emails that don't match any CRM entity
    if (!kontaktId && !leadId) continue;

    const dato = dateStr ? new Date(dateStr).toISOString() : new Date(parseInt(msg.internalDate)).toISOString();

    const aktivitetData: Record<string, any> = {
      type: 'E-post',
      tittel: `${isSent ? '→' : '←'} ${subject}`,
      beskrivelse: snippet,
      dato,
      ekstern_id: eksternId,
      ekstern_provider: 'gmail',
      aktivitet_kilde: direction,
      kontakt_id: kontaktId,
      selskap_id: selskapId,
      lead_id: leadId,
      salgsmulighet_id: salgsmulighetId,
    };

    // Upsert
    const { data: existing } = await supabase
      .from('aktiviteter')
      .select('id')
      .eq('ekstern_id', eksternId)
      .eq('ekstern_provider', 'gmail')
      .maybeSingle();

    if (existing) {
      await supabase.from('aktiviteter').update(aktivitetData).eq('id', existing.id);
    } else {
      await supabase.from('aktiviteter').insert(aktivitetData);
    }
    synced++;
  }

  // Update connection
  const updateData: Record<string, any> = { gmail_last_synced_at: new Date().toISOString() };
  if (result.newHistoryId) updateData.gmail_history_id = result.newHistoryId;

  await supabase
    .from('google_calendar_connections')
    .update(updateData)
    .eq('user_id', connection.user_id);

  return { synced, error: null };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    let userId: string | null = null;

    const authHeader = req.headers.get('Authorization');
    if (authHeader && !authHeader.includes(Deno.env.get('SUPABASE_ANON_KEY')!)) {
      const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (user) userId = user.id;
    }

    let query = supabase.from('google_calendar_connections').select('*');
    if (userId) query = query.eq('user_id', userId);
    const { data: connections, error } = await query;

    if (error || !connections || connections.length === 0) {
      return new Response(JSON.stringify({ error: 'No connections found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results = [];
    for (const conn of connections) {
      const syncResult = await syncGmailForUser(supabase, conn);
      results.push({
        user_id: conn.user_id,
        synced: syncResult.synced,
        error: syncResult.error,
      });
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('Gmail sync error:', e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
