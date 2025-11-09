/**
 * ProductDrivers Track Edge Function
 * Endpoint: /v1/track
 * 
 * Accepts single or batch tracking events
 * Validates, processes, and stores events in database
 * 
 * Security:
 * - Frontend: domain_restriction + rate limiting
 * - Backend: HMAC-SHA256 signature + replay attack prevention
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { validateRequest } from '../_shared/auth.ts';

interface TrackEvent {
  userId?: string;
  sessionId?: string;
  event: string;
  journey?: string;
  step?: string;
  feature?: string;
  name?: string; // For CUSTOM events
  behaviorType?: string; // For USER_BEHAVIOR events
  elementSelector?: string; // For USER_BEHAVIOR events
  elementText?: string; // For USER_BEHAVIOR events
  pageUrl?: string; // For USER_BEHAVIOR events
  value?: number;
  ts?: number;
  meta?: Record<string, any>;
}

interface TrackPayload {
  projectKey: string;
  signature?: string; // HMAC signature for server-side requests
  timestamp?: number; // Request timestamp for replay attack prevention
  nonce?: string; // Optional nonce for additional security
  userId?: string;
  sessionId?: string;
  event?: string;
  journey?: string;
  step?: string;
  feature?: string;
  name?: string; // For CUSTOM events
  behaviorType?: string; // For USER_BEHAVIOR events
  elementSelector?: string; // For USER_BEHAVIOR events
  elementText?: string; // For USER_BEHAVIOR events
  pageUrl?: string; // For USER_BEHAVIOR events
  value?: number;
  ts?: number;
  meta?: Record<string, any>;
  events?: TrackEvent[]; // For batch requests
}

serve(async (req) => {
  // CORS headers - support credentials by using the request origin
  const origin = req.headers.get('origin') || '*';
  const corsHeaders = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
  };

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Parse request body
    const bodyText = await req.text();
    const payload: TrackPayload = JSON.parse(bodyText);

    // Validate required fields
    if (!payload.projectKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'projectKey is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Get project info (id, secret_key, and domain_restriction)
    const { data: projectData, error: projectError } = await supabase
      .from('projects')
      .select('id, secret_key, domain_restriction')
      .eq('project_key', payload.projectKey)
      .single();

    if (projectError || !projectData) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid project key'
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Authorization header for API key validation
    const authHeader = req.headers.get('authorization');

    // Validate request (frontend or backend mode)
    const validation = await validateRequest(
      payload,
      projectData,
      origin,
      supabase,
      bodyText,
      authHeader
    );

    if (!validation.valid) {
      return new Response(
        JSON.stringify({
          success: false,
          error: validation.error
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const projectId = projectData.id;

    // Determine if this is a batch or single event
    const isBatch = Array.isArray(payload.events);
    const events = isBatch ? payload.events! : [payload];

    // Process each event
    const processedEvents = [];
    const skippedEvents: { event?: string; reason: string }[] = [];

    for (const event of events) {
      // Validate event type
      const validEvents = ['JOURNEY_START', 'JOURNEY_COMPLETE', 'STEP_VIEW', 'FEATURE_USED', 'JOURNEY_SATISFACTION', 'USER_BEHAVIOR', 'CUSTOM'];
      if (!event.event || !validEvents.includes(event.event)) {
        skippedEvents.push({ event: event.event, reason: 'Invalid event type' });
        continue;
      }

      // Validate CUSTOM events have name
      if (event.event === 'CUSTOM' && !event.name) {
        skippedEvents.push({ event: event.event, reason: 'CUSTOM events require a name field' });
        continue;
      }

      // Get or create user
      let userId: string | null = null;
      if (event.userId || payload.userId) {
        const userRef = event.userId || payload.userId!;
        const { data: existingUser } = await supabase
          .from('users')
          .select('id')
          .eq('project_id', projectId)
          .eq('user_ref', userRef)
          .single();

        if (existingUser) {
          userId = existingUser.id;
          // Update last_seen
          await supabase
            .from('users')
            .update({ last_seen: new Date().toISOString() })
            .eq('id', userId);
        } else {
          // Create new user
          const { data: newUser } = await supabase
            .from('users')
            .insert({
              project_id: projectId,
              user_ref: userRef,
              traits: {},
            })
            .select('id')
            .single();

          if (newUser) {
            userId = newUser.id;
          }
        }
      }

      // Get or create session
      let sessionId: string | null = null;
      if (event.sessionId || payload.sessionId) {
        const sessionRef = event.sessionId || payload.sessionId!;
        const { data: existingSession } = await supabase
          .from('sessions')
          .select('id')
          .eq('project_id', projectId)
          .eq('session_ref', sessionRef)
          .single();

        if (existingSession) {
          sessionId = existingSession.id;
          // Update last_activity
          await supabase
            .from('sessions')
            .update({ last_activity: new Date().toISOString() })
            .eq('id', sessionId);
        } else {
          // Create new session
          const { data: newSession } = await supabase
            .from('sessions')
            .insert({
              project_id: projectId,
              session_ref: sessionRef,
              user_id: userId,
            })
            .select('id')
            .single();

          if (newSession) {
            sessionId = newSession.id;
          }
        }
      }

      // Prepare meta object with behavior-specific fields for USER_BEHAVIOR events
      let metaData = event.meta || {};
      if (event.event === 'USER_BEHAVIOR') {
        metaData = {
          ...metaData,
          behaviorType: event.behaviorType,
          elementSelector: event.elementSelector,
          elementText: event.elementText,
          pageUrl: event.pageUrl,
        };
      }

      // Prepare event for insertion
      const eventData = {
        project_id: projectId,
        user_id: userId,
        session_id: sessionId,
        event: event.event,
        journey: event.journey || null,
        step: event.step || null,
        feature: event.feature || null,
        name: event.name || null, // For CUSTOM events
        value: event.value || null,
        meta: metaData,
        created_at: event.ts ? new Date(event.ts).toISOString() : new Date().toISOString(),
      };

      processedEvents.push(eventData);
    }

    // Bulk insert events
    if (processedEvents.length > 0) {
      const { error: insertError } = await supabase
        .from('events')
        .insert(processedEvents);

      if (insertError) {
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to insert events' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Also insert USER_BEHAVIOR events to user_behaviors table
      const userBehaviorEvents = processedEvents.filter(e => e.event === 'USER_BEHAVIOR');
      if (userBehaviorEvents.length > 0) {
        const behaviorData = userBehaviorEvents.map(e => ({
          project_id: e.project_id,
          session_id: e.session_id,
          user_id: e.user_id,
          behavior_type: e.meta?.behaviorType || null,
          journey: e.journey,
          step: e.step,
          feature: e.feature,
          element_selector: e.meta?.elementSelector || null,
          element_text: e.meta?.elementText || null,
          page_url: e.meta?.pageUrl || null,
          value: e.value,
          metadata: e.meta,
          occurred_at: e.created_at,
        }));

        const { error: behaviorError } = await supabase
          .from('user_behaviors')
          .insert(behaviorData);

        if (behaviorError) {
          // Don't fail the request, events were successfully inserted
        }
      }
    }

    // Success response
    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: processedEvents.length,
        skipped: skippedEvents.length,
        errors: skippedEvents.length > 0 ? skippedEvents : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

