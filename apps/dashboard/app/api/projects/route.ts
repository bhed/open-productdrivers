/**
 * API Route for creating projects
 * Uses server-side Supabase client
 */

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get request body
    const body = await request.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Project name is required' },
        { status: 400 }
      );
    }

    // Get user's workspace
    const { data: membership, error: membershipError } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .single();

    if (membershipError || !membership) {
      console.error('Membership error:', membershipError);
      return NextResponse.json(
        { error: 'No workspace found', details: membershipError?.message },
        { status: 404 }
      );
    }

    // Generate project key
    const projectKey = 'proj_' + Math.random().toString(36).substring(2, 15) + 
                       Math.random().toString(36).substring(2, 15);

    // Create project
    const { data: project, error: createError } = await supabase
      .from('projects')
      .insert({
        workspace_id: membership.workspace_id,
        name: name,
        project_key: projectKey,
      })
      .select()
      .single();

    if (createError) {
      console.error('Create project error:', createError);
      return NextResponse.json(
        { error: 'Failed to create project', details: createError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ project });

  } catch (error: unknown) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

