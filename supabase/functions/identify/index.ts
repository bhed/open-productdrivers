/**
 * ProductDrivers Identify Edge Function
 * Endpoint: /v1/identify
 * 
 * Links a session to a user and updates user traits
 * Idempotent operation
 * 
 * Security:
 * - Frontend: domain_restriction + rate limiting
 * - Backend: HMAC-SHA256 signature + replay attack prevention
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { validateRequest } from '../_shared/auth.ts';

interface IdentifyPayload {
  projectKey: string;
  signature?: string; // HMAC signature for server-side requests
  timestamp?: number; // Request timestamp for replay attack prevention
  nonce?: string; // Optional nonce for additional security
  userId: string;
  sessionId: string;
  traits?: Record<string, any>;
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
    const payload: IdentifyPayload = JSON.parse(bodyText);

    // Validate required fields
    if (!payload.projectKey || !payload.userId || !payload.sessionId) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'projectKey, userId, and sessionId are required' 
        }),
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
        JSON.stringify({ success: false, error: 'Invalid project key' }),
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

    // Get or create user
    let userId: string;
    const { data: existingUser } = await supabase
      .from('users')
      .select('id, traits')
      .eq('project_id', projectId)
      .eq('user_ref', payload.userId)
      .single();

    if (existingUser) {
      userId = existingUser.id;

      // Merge traits if provided
      if (payload.traits) {
        const mergedTraits = {
          ...existingUser.traits,
          ...payload.traits,
        };

        await supabase
          .from('users')
          .update({
            traits: mergedTraits,
            last_seen: new Date().toISOString(),
          })
          .eq('id', userId);
      } else {
        // Just update last_seen
        await supabase
          .from('users')
          .update({ last_seen: new Date().toISOString() })
          .eq('id', userId);
      }
    } else {
      // Create new user
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          project_id: projectId,
          user_ref: payload.userId,
          traits: payload.traits || {},
        })
        .select('id')
        .single();

      if (createError || !newUser) {
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to create user' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      userId = newUser.id;
    }

    // Link session to user
    const { data: existingSession } = await supabase
      .from('sessions')
      .select('id, user_id')
      .eq('project_id', projectId)
      .eq('session_ref', payload.sessionId)
      .single();

    if (existingSession) {
      // Update session to link user if not already linked
      if (!existingSession.user_id || existingSession.user_id !== userId) {
        await supabase
          .from('sessions')
          .update({
            user_id: userId,
            last_activity: new Date().toISOString(),
          })
          .eq('id', existingSession.id);
      } else {
        // Just update last_activity
        await supabase
          .from('sessions')
          .update({ last_activity: new Date().toISOString() })
          .eq('id', existingSession.id);
      }
    } else {
      // Create new session linked to user
      await supabase
        .from('sessions')
        .insert({
          project_id: projectId,
          session_ref: payload.sessionId,
          user_id: userId,
        });
    }

    // Success response
    return new Response(
      JSON.stringify({ 
        success: true,
        userId: payload.userId,
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

