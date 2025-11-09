/**
 * GDPR Anonymize Edge Function
 * Endpoint: /v1/gdpr-anonymize
 *
 * Anonymizes user data for GDPR compliance
 * Keeps analytics data but removes personally identifiable information
 *
 * Security:
 * - API key validation required
 * - Explicit confirmation ("ANONYMIZE") required
 * - Project key validation
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { validateSupabaseApiKey } from '../_shared/auth.ts';

interface AnonymizePayload {
  projectKey: string;
  userId: string;
  confirmation: string; // Must be "ANONYMIZE"
}

// Simple hash function for anonymization
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `anon_${Math.abs(hash).toString(36)}`;
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
    const payload: AnonymizePayload = await req.json();

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
    if (payload.confirmation !== 'ANONYMIZE') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Confirmation required: must send confirmation="ANONYMIZE"' 
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
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate anonymized user_ref
    const anonymizedUserId = hashString(payload.userId + Date.now());

    // Update user record: anonymize user_ref and clear traits
    const { error: updateError } = await supabase
      .from('users')
      .update({
        user_ref: anonymizedUserId,
        traits: {}, // Clear all traits
      })
      .eq('id', user.id);

    if (updateError) {
      // Error updating traits
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to anonymize user data',
          details: updateError.message,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Anonymize meta fields in events that might contain PII
    // (Optional: only if you store PII in meta)
    const { data: events } = await supabase
      .from('events')
      .select('id, meta')
      .eq('user_id', user.id);

    if (events && events.length > 0) {
      for (const event of events) {
        // Clear potentially sensitive meta fields
        const cleanedMeta: Record<string, any> = {};
        
        // Only keep non-sensitive data (example logic)
        if (event.meta) {
          for (const [key, value] of Object.entries(event.meta)) {
            // Remove fields that might contain PII
            const sensitiveFields = ['email', 'name', 'phone', 'address', 'ip'];
            if (!sensitiveFields.includes(key.toLowerCase())) {
              cleanedMeta[key] = value;
            }
          }
        }

        await supabase
          .from('events')
          .update({ meta: cleanedMeta })
          .eq('id', event.id);
      }
    }

    // Clear feedback text from survey responses (might contain PII)
    const { error: surveyError } = await supabase
      .from('survey_responses')
      .update({ feedback: null })
      .eq('user_id', user.id)
      .not('feedback', 'is', null);

    if (surveyError) {
      // Warning: survey feedback anonymization failed
    }

    // Log the anonymization action
    // User anonymized successfully

    // Return success
    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'User data successfully anonymized',
        anonymizedUserId: anonymizedUserId,
        details: {
          originalUserId: payload.userId,
          traitsCleared: Object.keys(user.traits || {}).length,
          eventsProcessed: events?.length || 0,
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

