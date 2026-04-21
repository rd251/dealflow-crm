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

async function fetchCalendarEvents(accessToken: string, syncToken?: string | null) {
  const params = new URLSearchParams({
    maxResults: '250',
    singleEvents: 'true',
    orderBy: 'startTime',
  });

  if (syncToken) {
    params.set('syncToken', syncToken);
  } else {
    // Initial sync: fetch events from 30 days ago to 90 days ahead
    const timeMin = new Date(Date.now() - 30 * 86400000).toISOString();
    const timeMax = new Date(Date.now() + 90 * 86400000).toISOString();
    params.set('timeMin', timeMin);
    params.set('timeMax', timeMax);
  }

  const allEvents: any[] = [];
  let nextPageToken: string | undefined;
  let newSyncToken: string | undefined;

  do {
    if (nextPageToken) params.set('pageToken', nextPageToken);

    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (res.status === 410) {
      // Sync token expired, need full sync
      return { events: [], syncToken: null, needFullSync: true };
    }

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Google Calendar API error [${res.status}]: ${errorText}`);
    }

    const data = await res.json();
    allEvents.push(...(data.items || []));
    nextPageToken = data.nextPageToken;
    newSyncToken = data.nextSyncToken;
  } while (nextPageToken);

  return { events: allEvents, syncToken: newSyncToken, needFullSync: false };
}

// Domains considered internal (own organization) — never used for selskap-matching
const INTERNAL_DOMAINS = new Set<string>(['snakk.ai', 'snakk.no']);

function isInternalEmail(email?: string | null): boolean {
  if (!email) return true;
  const domain = email.toLowerCase().split('@')[1] || '';
  return INTERNAL_DOMAINS.has(domain);
}

function getExternalAttendees(attendees: any[] | undefined): any[] {
  if (!attendees) return [];
  return attendees.filter((a: any) => !a.self && !isInternalEmail(a.email) && !a.organizer);
}

async function matchDeltakere(supabase: any, attendees: any[]): Promise<string[]> {
  if (!attendees || attendees.length === 0) return [];

  // Include both internal and external participants in deltakere (as kontakter),
  // but matching of selskap/kontakt for the meeting itself uses external only.
  const emails = attendees
    .filter((a: any) => !a.self)
    .map((a: any) => a.email?.toLowerCase())
    .filter(Boolean);

  if (emails.length === 0) return [];

  const { data: kontakter } = await supabase
    .from('kontakter')
    .select('id, e_post')
    .in('e_post', emails);

  return (kontakter || []).map((k: any) => k.id);
}

async function matchLeadByEmail(supabase: any, attendees: any[]): Promise<string | null> {
  const externals = getExternalAttendees(attendees);
  if (externals.length === 0) return null;
  const emails = externals.map((a: any) => a.email?.toLowerCase()).filter(Boolean);
  if (emails.length === 0) return null;
  const { data } = await supabase
    .from('leads')
    .select('id, e_post, status, updated_at')
    .in('e_post', emails)
    .not('status', 'in', '("Konvertert til salg","Konvertert til partner","Ikke aktuelt")')
    .order('updated_at', { ascending: false })
    .limit(1);
  return data && data.length > 0 ? data[0].id : null;
}

async function findOpenSalgsmulighetForSelskap(supabase: any, selskapId: string): Promise<string | null> {
  const { data } = await supabase
    .from('salgsmuligheter')
    .select('id, status, updated_at')
    .eq('selskap_id', selskapId)
    .not('status', 'in', '("Vunnet","Tapt")')
    .order('updated_at', { ascending: false })
    .limit(1);
  return data && data.length > 0 ? data[0].id : null;
}

async function matchSelskapByEmailDomain(supabase: any, attendees: any[]): Promise<{ selskapId: string | null; kontaktId: string | null }> {
  const externals = getExternalAttendees(attendees);
  if (externals.length === 0) return { selskapId: null, kontaktId: null };

  // 1) Try to match a kontakt directly by email
  for (const a of externals) {
    const email = a.email?.toLowerCase();
    if (!email) continue;
    const { data: kontakt } = await supabase
      .from('kontakter')
      .select('id, selskap_id')
      .eq('e_post', email)
      .maybeSingle();
    if (kontakt) {
      return { selskapId: kontakt.selskap_id || null, kontaktId: kontakt.id };
    }
  }

  // 2) Match by company domain
  const domains = Array.from(new Set(externals.map((a: any) => (a.email || '').toLowerCase().split('@')[1]).filter(Boolean)));
  if (domains.length > 0) {
    const { data: selskaper } = await supabase
      .from('selskaper')
      .select('id, domene')
      .in('domene', domains);
    if (selskaper && selskaper.length > 0) return { selskapId: selskaper[0].id, kontaktId: null };
  }

  return { selskapId: null, kontaktId: null };
}

async function matchSelskapByTitle(supabase: any, title: string): Promise<string | null> {
  if (!title || title.length < 3) return null;
  const titleLower = title.toLowerCase();

  // Skip generic/personal titles
  const skipPatterns = ['hjemme', 'ferie', 'lunsj', 'lunch', 'privat', 'ledig', 'busy'];
  if (skipPatterns.some(p => titleLower === p)) return null;

  const { data: selskaper } = await supabase
    .from('selskaper')
    .select('id, firmanavn');

  if (!selskaper || selskaper.length === 0) return null;

  // Sort by name length descending to match longest (most specific) name first
  const sorted = selskaper.sort((a: any, b: any) => b.firmanavn.length - a.firmanavn.length);

  // Company names to skip (too generic, cause false positives)
  const skipNames = ['test', 'recharge', 'gmail'];

  for (const s of sorted) {
    const nameLower = s.firmanavn.toLowerCase();
    if (s.firmanavn.length < 5) continue; // skip very short names
    if (skipNames.includes(nameLower)) continue;

    // Use word boundary matching to avoid partial matches
    // Check the name appears as a distinct segment in the title
    if (titleLower.includes(nameLower)) {
      return s.id;
    }
  }

  return null;
}

async function syncForUser(supabase: any, connection: any) {
  const accessToken = await getValidAccessToken(supabase, connection);
  if (!accessToken) {
    console.error(`Failed to get access token for user ${connection.user_id}`);
    return { synced: 0, error: 'token_refresh_failed' };
  }

  let result = await fetchCalendarEvents(accessToken, connection.sync_token);

  if (result.needFullSync) {
    result = await fetchCalendarEvents(accessToken, null);
  }

  let synced = 0;

  for (const event of result.events) {
    const eksternId = event.id;
    const cancelled = event.status === 'cancelled';

    if (cancelled) {
      await supabase
        .from('aktiviteter')
        .delete()
        .eq('ekstern_id', eksternId)
        .eq('ekstern_provider', 'google_calendar');
      synced++;
      continue;
    }

    // Skip personal/non-business calendar entries
    const summary = (event.summary || '').trim().toLowerCase();
    const skipTitles = ['hjemme', 'ferie', 'privat', 'ledig', 'busy', 'lunch', 'lunsj'];
    if (skipTitles.includes(summary)) continue;

    const startDt = event.start?.dateTime || event.start?.date;
    const endDt = event.end?.dateTime || event.end?.date;
    if (!startDt) continue;

    const deltakere = await matchDeltakere(supabase, event.attendees || []);

    // Match company/contact ONLY using external attendees (not own employees)
    const { selskapId: selskapIdFromExt, kontaktId: kontaktIdFromExt } =
      await matchSelskapByEmailDomain(supabase, event.attendees || []);

    // Fallback: title match (still skip if no external participants)
    const meetingTitle = event.summary || '';
    const externalCount = getExternalAttendees(event.attendees || []).length;
    let selskapId = selskapIdFromExt;
    if (!selskapId && externalCount > 0) {
      selskapId = await matchSelskapByTitle(supabase, meetingTitle);
    }

    // Auto-link to open sales opportunity if company matched
    let salgsmulighetId: string | null = null;
    if (selskapId) {
      salgsmulighetId = await findOpenSalgsmulighetForSelskap(supabase, selskapId);
    }

    // Auto-link to lead if no company/deal matched but external email matches a lead
    let leadId: string | null = null;
    if (!selskapId && !salgsmulighetId) {
      leadId = await matchLeadByEmail(supabase, event.attendees || []);
    }

    const aktivitetData: any = {
      type: 'Møte' as const,
      tittel: meetingTitle || 'Google Calendar-møte',
      beskrivelse: event.description || '',
      dato: new Date(startDt).toISOString(),
      start_tid: new Date(startDt).toISOString(),
      slutt_tid: endDt ? new Date(endDt).toISOString() : null,
      ekstern_id: eksternId,
      ekstern_provider: 'google_calendar',
      aktivitet_kilde: 'google_calendar',
      deltakere: deltakere.length > 0 ? deltakere : [],
      kontakt_id: kontaktIdFromExt,
      selskap_id: selskapId,
      salgsmulighet_id: salgsmulighetId,
      lead_id: leadId,
    };

    // Upsert: check if exists
    const { data: existing } = await supabase
      .from('aktiviteter')
      .select('id')
      .eq('ekstern_id', eksternId)
      .eq('ekstern_provider', 'google_calendar')
      .maybeSingle();

    if (existing) {
      // Fetch current record to avoid overwriting manually-set links
      const { data: current } = await supabase
        .from('aktiviteter')
        .select('kontakt_id, selskap_id, salgsmulighet_id, lead_id')
        .eq('id', existing.id)
        .maybeSingle();

      // Don't overwrite manually-set links
      const updateData = { ...aktivitetData };
      if (current?.kontakt_id) updateData.kontakt_id = current.kontakt_id;
      if (current?.selskap_id) updateData.selskap_id = current.selskap_id;
      if (current?.salgsmulighet_id) updateData.salgsmulighet_id = current.salgsmulighet_id;
      if (current?.lead_id) updateData.lead_id = current.lead_id;

      await supabase
        .from('aktiviteter')
        .update(updateData)
        .eq('id', existing.id);
    } else {
      await supabase
        .from('aktiviteter')
        .insert(aktivitetData);
    }
    synced++;
  }

  // Update sync token and last_synced_at
  const updateData: any = { last_synced_at: new Date().toISOString() };
  if (result.syncToken) updateData.sync_token = result.syncToken;

  await supabase
    .from('google_calendar_connections')
    .update(updateData)
    .eq('user_id', connection.user_id);

  return { synced, error: null };
}

// Push CRM meetings to Google Calendar
async function pushToGoogle(supabase: any, connection: any, accessToken: string) {
  // Find CRM meetings without ekstern_id that were created manually
  const { data: localMeetings } = await supabase
    .from('aktiviteter')
    .select('*')
    .eq('type', 'Møte')
    .is('ekstern_id', null)
    .in('aktivitet_kilde', ['manuell', 'ai-assistent'])
    .not('start_tid', 'is', null);

  if (!localMeetings || localMeetings.length === 0) return 0;

  let pushed = 0;

  // Get kontakt emails for attendees
  const allDeltakere = localMeetings.flatMap((m: any) => m.deltakere || []);
  const { data: kontaktEmails } = await supabase
    .from('kontakter')
    .select('id, e_post')
    .in('id', allDeltakere.length > 0 ? allDeltakere : ['__none__']);

  const emailMap = new Map((kontaktEmails || []).map((k: any) => [k.id, k.e_post]));

  for (const meeting of localMeetings) {
    const attendees = (meeting.deltakere || [])
      .map((id: string) => emailMap.get(id))
      .filter(Boolean)
      .map((email: string) => ({ email }));

    const gcalEvent = {
      summary: meeting.tittel || meeting.beskrivelse || 'CRM-møte',
      description: meeting.beskrivelse || '',
      start: { dateTime: meeting.start_tid, timeZone: 'Europe/Oslo' },
      end: { dateTime: meeting.slutt_tid || meeting.start_tid, timeZone: 'Europe/Oslo' },
      attendees: attendees.length > 0 ? attendees : undefined,
    };

    const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(gcalEvent),
    });

    if (res.ok) {
      const created = await res.json();
      await supabase
        .from('aktiviteter')
        .update({ ekstern_id: created.id, ekstern_provider: 'google_calendar', aktivitet_kilde: 'manuell' })
        .eq('id', meeting.id);
      pushed++;
    } else {
      const errText = await res.text();
      console.error(`Failed to push meeting ${meeting.id}: ${errText}`);
    }
  }

  return pushed;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    let userId: string | null = null;

    // If called with auth header, sync only that user
    const authHeader = req.headers.get('Authorization');
    if (authHeader && !authHeader.includes(Deno.env.get('SUPABASE_ANON_KEY')!)) {
      const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (user) userId = user.id;
    }

    // Fetch connections to sync
    let query = supabase.from('google_calendar_connections').select('*');
    if (userId) query = query.eq('user_id', userId);
    const { data: connections, error } = await query;

    if (error || !connections) {
      return new Response(JSON.stringify({ error: 'No connections found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results = [];
    for (const conn of connections) {
      const accessToken = await getValidAccessToken(supabase, conn);

      // Pull from Google
      const syncResult = await syncForUser(supabase, conn);

      // Push to Google (two-way sync)
      let pushed = 0;
      if (accessToken) {
        pushed = await pushToGoogle(supabase, conn, accessToken);
      }

      results.push({
        user_id: conn.user_id,
        synced: syncResult.synced,
        pushed,
        error: syncResult.error,
      });
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('Sync error:', e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
