import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')!;
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const MAX_MESSAGES = 1000;
const SYNC_MONTHS_BACK = 6;

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

// Fetch message details in parallel batches
async function fetchMessageDetails(accessToken: string, messageIds: string[], batchSize = 20): Promise<GmailMessage[]> {
  const results: GmailMessage[] = [];
  
  for (let i = 0; i < messageIds.length; i += batchSize) {
    const batch = messageIds.slice(i, i + batchSize);
    const promises = batch.map(async (msgId) => {
      const res = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Date`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (res.ok) return await res.json() as GmailMessage;
      return null;
    });
    const batchResults = await Promise.all(promises);
    for (const r of batchResults) {
      if (r) results.push(r);
    }
  }
  
  return results;
}

async function fetchGmailMessages(accessToken: string, historyId?: string | null) {
  const allMessages: GmailMessage[] = [];

  if (historyId) {
    // Incremental sync via history - paginate through all history
    let pageToken: string | undefined;
    const messageIds = new Set<string>();

    do {
      const params = new URLSearchParams({
        startHistoryId: historyId,
        historyTypes: 'messageAdded',
        maxResults: '500',
      });
      if (pageToken) params.set('pageToken', pageToken);

      const res = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/history?${params.toString()}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (res.status === 404) {
        return { messages: [], newHistoryId: null, needFullSync: true };
      }

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Gmail History API error [${res.status}]: ${err}`);
      }

      const data = await res.json();
      for (const h of data.history || []) {
        for (const msg of h.messagesAdded || []) {
          messageIds.add(msg.message.id);
        }
      }
      pageToken = data.nextPageToken;
    } while (pageToken && messageIds.size < MAX_MESSAGES);

    // Fetch full message details in parallel batches
    const details = await fetchMessageDetails(accessToken, Array.from(messageIds));
    allMessages.push(...details);

    // Get historyId
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

  // Full sync: fetch messages going back SYNC_MONTHS_BACK months
  const afterDate = new Date();
  afterDate.setMonth(afterDate.getMonth() - SYNC_MONTHS_BACK);
  const after = Math.floor(afterDate.getTime() / 1000);
  
  let pageToken: string | undefined;
  const messageIds: string[] = [];

  do {
    const params = new URLSearchParams({
      q: `after:${after}`,
      maxResults: '500',
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
    console.log(`Fetched ${messageIds.length} message IDs so far...`);
  } while (pageToken && messageIds.length < MAX_MESSAGES);

  console.log(`Total message IDs to fetch: ${messageIds.length}`);

  // Fetch message details in parallel batches
  const details = await fetchMessageDetails(accessToken, messageIds);
  allMessages.push(...details);
  console.log(`Fetched ${allMessages.length} message details`);

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
  // Auto-create kontakter from partners that have e_post but no matching kontakt
  const { data: allPartnere } = await supabase
    .from('partnere')
    .select('id, partnernavn, kontaktperson, e_post, selskap_id')
    .neq('e_post', '')
    .not('e_post', 'is', null);

  if (allPartnere && allPartnere.length > 0) {
    const { data: eksisterendeKontakter } = await supabase
      .from('kontakter')
      .select('e_post');

    const eksisterendeEmails = new Set(
      (eksisterendeKontakter || [])
        .filter((k: any) => k.e_post)
        .map((k: any) => k.e_post.toLowerCase())
    );

    for (const partner of allPartnere) {
      if (partner.e_post && !eksisterendeEmails.has(partner.e_post.toLowerCase())) {
        const kontaktNavn = partner.kontaktperson || partner.partnernavn;
        await supabase.from('kontakter').insert({
          navn: kontaktNavn,
          e_post: partner.e_post,
          selskap_id: partner.selskap_id || null,
          notater: `Auto-opprettet fra partner: ${partner.partnernavn}`,
        });
        eksisterendeEmails.add(partner.e_post.toLowerCase());
        console.log(`Auto-created kontakt for partner ${partner.partnernavn} (${partner.e_post})`);
      }
    }
  }

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

  // Get existing ekstern_ids to skip already-synced messages
  const { data: existingAktiviteter } = await supabase
    .from('aktiviteter')
    .select('ekstern_id')
    .eq('ekstern_provider', 'gmail')
    .not('ekstern_id', 'is', null);
  
  const existingIds = new Set((existingAktiviteter || []).map((a: any) => a.ekstern_id));

  let synced = 0;
  const insertBatch: any[] = [];

  for (const msg of result.messages) {
    const eksternId = msg.id;
    
    // Skip already synced
    if (existingIds.has(eksternId)) continue;

    const subject = getHeader(msg, 'Subject') || '(Uten emne)';
    const from = getHeader(msg, 'From');
    const to = getHeader(msg, 'To');
    const cc = getHeader(msg, 'Cc');
    const dateStr = getHeader(msg, 'Date');
    const snippet = msg.snippet || '';

    const fromEmails = extractEmails(from);
    const toEmails = extractEmails(to);
    const ccEmails = extractEmails(cc);

    // Determine direction
    const isSent = fromEmails.some(e => e === userEmail) || (msg.labelIds || []).includes('SENT');
    const direction = isSent ? 'gmail_sendt' : 'gmail_mottatt';

    // Collect ALL external emails from from, to, and cc
    const allEmails = new Set<string>();
    for (const e of fromEmails) { if (e !== userEmail) allEmails.add(e); }
    for (const e of toEmails) { if (e !== userEmail) allEmails.add(e); }
    for (const e of ccEmails) { if (e !== userEmail) allEmails.add(e); }

    // Find matching kontakt (primary match for linking)
    let kontaktId: string | null = null;
    let selskapId: string | null = null;
    let leadId: string | null = null;
    let salgsmulighetId: string | null = null;

    for (const email of allEmails) {
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

    // Store ALL external emails in beskrivelse so Kontaktstrøm can extract them
    const emailList = Array.from(allEmails);
    const emailTags = emailList.map(e => `[${e}]`).join('');
    const dato = dateStr ? new Date(dateStr).toISOString() : new Date(parseInt(msg.internalDate)).toISOString();

    const aktivitetData: Record<string, any> = {
      type: 'E-post',
      tittel: `${isSent ? '→' : '←'} ${subject}`,
      beskrivelse: emailTags ? `${emailTags} ${snippet}` : snippet,
      dato,
      ekstern_id: eksternId,
      ekstern_provider: 'gmail',
      aktivitet_kilde: direction,
      kontakt_id: kontaktId,
      selskap_id: selskapId,
      lead_id: leadId,
      salgsmulighet_id: salgsmulighetId,
    };

    insertBatch.push(aktivitetData);
    synced++;
  }

  // Batch insert new aktiviteter
  if (insertBatch.length > 0) {
    // Insert in chunks of 100
    for (let i = 0; i < insertBatch.length; i += 100) {
      const chunk = insertBatch.slice(i, i + 100);
      const { error: insertError } = await supabase.from('aktiviteter').insert(chunk);
      if (insertError) {
        console.error(`Insert batch error at ${i}:`, insertError);
      }
    }
    console.log(`Inserted ${insertBatch.length} new aktiviteter`);
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
