/**
 * GDPR Export Edge Function
 * Endpoint: /v1/gdpr-export
 *
 * Exports all user data for GDPR compliance (Right to Access)
 *
 * Security:
 * - API key validation required
 * - Project key validation
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { validateSupabaseApiKey } from '../_shared/auth.ts';

interface ExportPayload {
  projectKey: string;
  userId: string;
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
    const payload: ExportPayload = await req.json();

    // Validate required fields
    if (!payload.projectKey || !payload.userId) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'projectKey and userId are required' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get project_id from project_key
    const { data: projectData, error: projectError } = await supabase
      .rpc('get_project_id_from_key', { key: payload.projectKey });

    if (projectError || !projectData) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid project key' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate API key (required for all requests)
    const authHeader = req.headers.get('authorization');
    if (!validateSupabaseApiKey(authHeader)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid or missing Supabase API key in Authorization header'
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const projectId = projectData;

    // Get user data
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('project_id', projectId)
      .eq('user_ref', payload.userId)
      .single();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'User not found',
          details: userError?.message 
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get all sessions for this user
    const { data: sessions } = await supabase
      .from('sessions')
      .select('*')
      .eq('user_id', user.id);

    // Get all events for this user
    const { data: events } = await supabase
      .from('events')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    // Get survey responses
    const { data: surveyResponses } = await supabase
      .from('survey_responses')
      .select('*')
      .eq('user_id', user.id);

    // Compile export data
    const exportData = {
      exportDate: new Date().toISOString(),
      projectId: projectId,
      user: {
        id: user.id,
        userRef: user.user_ref,
        traits: user.traits,
        firstSeen: user.first_seen,
        lastSeen: user.last_seen,
      },
      sessions: sessions?.map(s => ({
        id: s.id,
        sessionRef: s.session_ref,
        startedAt: s.started_at,
        lastActivity: s.last_activity,
      })) || [],
      events: events?.map(e => ({
        id: e.id,
        event: e.event,
        journey: e.journey,
        step: e.step,
        feature: e.feature,
        value: e.value,
        meta: e.meta,
        createdAt: e.created_at,
      })) || [],
      surveyResponses: surveyResponses?.map(sr => ({
        surveyId: sr.survey_id,
        journey: sr.journey,
        score: sr.score,
        feedback: sr.feedback,
        createdAt: sr.created_at,
      })) || [],
      summary: {
        totalSessions: sessions?.length || 0,
        totalEvents: events?.length || 0,
        totalSurveyResponses: surveyResponses?.length || 0,
      },
    };

    // Log the export action
    // User data exported successfully

    // Return export data
    return new Response(
      JSON.stringify({ 
        success: true,
        data: exportData,
      }),
      { 
        status: 200, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="user_data_${payload.userId}_${Date.now()}.json"`,
        } 
      }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

