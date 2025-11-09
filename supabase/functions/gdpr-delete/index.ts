/**
 * GDPR Delete Edge Function
 * Endpoint: /v1/gdpr-delete
 *
 * Deletes all user data for GDPR compliance (Right to be Forgotten)
 *
 * Security:
 * - API key validation required
 * - Explicit confirmation ("DELETE") required
 * - Project key validation
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { validateSupabaseApiKey } from '../_shared/auth.ts';

interface DeletePayload {
  projectKey: string;
  userId: string;
  confirmation: string; // Must be "DELETE"
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
    const payload: DeletePayload = await req.json();

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

    // Require explicit confirmation
    if (payload.confirmation !== 'DELETE') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Confirmation required: must send confirmation="DELETE"' 
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

    // Get user data (to confirm existence and get internal ID)
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, user_ref')
      .eq('project_id', projectId)
      .eq('user_ref', payload.userId)
      .single();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'User not found',
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Count data before deletion
    const { count: eventsCount } = await supabase
      .from('events')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    const { count: sessionsCount } = await supabase
      .from('sessions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    const { count: responsesCount } = await supabase
      .from('survey_responses')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    // Delete user (CASCADE will handle related data)
    // Note: Make sure your DB has ON DELETE CASCADE set up properly
    const { error: deleteError } = await supabase
      .from('users')
      .delete()
      .eq('id', user.id);

    if (deleteError) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to delete user data'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Return success
    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'User data successfully deleted',
        deletedRecords: {
          user: 1,
          events: eventsCount || 0,
          sessions: sessionsCount || 0,
          surveyResponses: responsesCount || 0,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

