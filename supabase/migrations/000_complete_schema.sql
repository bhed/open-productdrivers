-- =====================================================
-- ProductDrivers Complete Schema
-- 
-- This is a consolidated migration containing the complete
-- database schema for ProductDrivers analytics platform.
-- 
-- Execution order:
-- 1. Extensions
-- 2. Enums
-- 3. Tables (in dependency order)
-- 4. Indexes
-- 5. Helper functions
-- 6. RLS policies
-- 7. Aggregation tables
-- 8. Views
-- 
-- For migration history, see migrations/archive/
-- =====================================================

-- =====================================================
-- STEP 1: EXTENSIONS
-- =====================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- STEP 2: ENUMS
-- =====================================================

CREATE TYPE event_type AS ENUM (
  'JOURNEY_START',
  'JOURNEY_COMPLETE',
  'STEP_VIEW',
  'FEATURE_USED',
  'JOURNEY_SATISFACTION',
  'USER_BEHAVIOR',
  'CUSTOM'
);

-- =====================================================
-- STEP 3: TABLES (in dependency order)
-- =====================================================

-- 3.1: WORKSPACES (no dependencies)
-- =====================================================
CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.2: PROJECTS (depends on workspaces)
-- =====================================================
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  project_key TEXT NOT NULL UNIQUE,
  secret_key TEXT NOT NULL UNIQUE DEFAULT ('sk_' || encode(gen_random_bytes(32), 'base64')),
  domain_restriction TEXT, -- Optional domain restriction for web tracking
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.3: WORKSPACE MEMBERS (depends on workspaces, auth.users)
-- =====================================================
CREATE TABLE workspace_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member', -- 'owner', 'admin', 'member', 'viewer'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workspace_id, user_id)
);

-- 3.4: USERS (analytics users, depends on projects)
-- =====================================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_ref TEXT NOT NULL, -- External user ID from client
  traits JSONB DEFAULT '{}'::JSONB,
  first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, user_ref)
);

-- 3.5: SESSIONS (depends on projects, users)
-- =====================================================
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  session_ref TEXT NOT NULL, -- Session UUID from SDK
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, session_ref)
);

-- 3.6: EVENTS (depends on projects, users, sessions)
-- =====================================================
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  event event_type NOT NULL,
  journey TEXT,
  step TEXT,
  feature TEXT,
  name TEXT, -- For CUSTOM events (required when event = 'CUSTOM')
  value NUMERIC,
  meta JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT check_custom_event_name CHECK (event != 'CUSTOM' OR name IS NOT NULL)
);

-- 3.7: SURVEYS (depends on projects)
-- =====================================================
CREATE TABLE surveys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  question TEXT NOT NULL,
  scale_min INTEGER NOT NULL DEFAULT 1,
  scale_max INTEGER NOT NULL DEFAULT 5,
  trigger_on_journey TEXT, -- Optional: auto-trigger after journey completion
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.8: SURVEY RESPONSES (depends on projects, surveys, sessions, users)
-- =====================================================
CREATE TABLE survey_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  survey_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  journey TEXT,
  score INTEGER NOT NULL,
  feedback TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.9: JOURNEY STATS (aggregation, depends on projects)
-- =====================================================
CREATE TABLE journey_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  journey TEXT NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  total_sessions INTEGER NOT NULL DEFAULT 0,
  completed_sessions INTEGER NOT NULL DEFAULT 0,
  completion_rate NUMERIC(5,2) NOT NULL DEFAULT 0, -- Percentage
  avg_satisfaction NUMERIC(5,2), -- Average satisfaction score
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, journey, period_start)
);

-- 3.10: FEATURE STATS (aggregation, depends on projects)
-- =====================================================
CREATE TABLE feature_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  feature TEXT NOT NULL,
  journey TEXT, -- Optional: feature usage within specific journey
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  usage_count INTEGER NOT NULL DEFAULT 0,
  unique_sessions INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.11: DRIVER STATS (correlation analysis, depends on projects)
-- =====================================================
CREATE TABLE driver_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  feature TEXT NOT NULL,
  journey TEXT, -- Optional: correlation within specific journey
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  sessions_with_feature INTEGER NOT NULL DEFAULT 0,
  sessions_without_feature INTEGER NOT NULL DEFAULT 0,
  avg_satisfaction_with NUMERIC(5,2), -- Avg satisfaction when feature used
  avg_satisfaction_without NUMERIC(5,2), -- Avg satisfaction when feature not used
  satisfaction_delta NUMERIC(5,2), -- Difference (positive = good driver)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.12: USER BEHAVIORS (automatic behavior tracking, depends on projects, sessions, users)
-- =====================================================
CREATE TABLE user_behaviors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  behavior_type TEXT NOT NULL, -- 'rage_click', 'dead_click', 'scroll_depth', etc.
  journey TEXT,
  step TEXT,
  feature TEXT,
  element_selector TEXT, -- CSS selector of element
  element_text TEXT,     -- Text content of element
  page_url TEXT,
  value DECIMAL(10,2),   -- Numeric value (e.g., scroll depth %, time in seconds)
  metadata JSONB,        -- Additional context
  created_at TIMESTAMP DEFAULT NOW(),
  occurred_at TIMESTAMP NOT NULL
);

-- 3.13: BEHAVIOR STATS (aggregation, depends on projects)
-- =====================================================
CREATE TABLE behavior_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  period_start TIMESTAMP NOT NULL,
  period_end TIMESTAMP NOT NULL,
  behavior_type TEXT NOT NULL,
  journey TEXT,
  step TEXT,
  occurrence_count INTEGER DEFAULT 0,
  unique_sessions INTEGER DEFAULT 0,
  avg_value DECIMAL(10,2),
  avg_satisfaction_with_behavior DECIMAL(5,2),
  avg_satisfaction_without_behavior DECIMAL(5,2),
  satisfaction_delta DECIMAL(5,2),
  top_elements JSONB, -- Array of {selector, count}
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 3.14: SESSION QUALITY (aggregated per session, depends on projects, sessions)
-- =====================================================
CREATE TABLE session_quality (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  total_duration_seconds INTEGER,
  active_time_seconds INTEGER,
  idle_time_seconds INTEGER,
  rage_click_count INTEGER DEFAULT 0,
  dead_click_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  form_abandonment_count INTEGER DEFAULT 0,
  max_scroll_depth_percent DECIMAL(5,2),
  avg_scroll_speed INTEGER,
  rapid_scroll_count INTEGER DEFAULT 0,
  back_button_count INTEGER DEFAULT 0,
  tab_switch_count INTEGER DEFAULT 0,
  network_issues_count INTEGER DEFAULT 0,
  slow_load_count INTEGER DEFAULT 0,
  quality_score DECIMAL(5,2),      -- 0-100, higher = better
  frustration_score DECIMAL(5,2),  -- 0-100, higher = more frustrated
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 3.15: HEATMAP DATA (aggregated click/scroll positions, depends on projects)
-- =====================================================
CREATE TABLE heatmap_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  page_url TEXT NOT NULL,
  journey TEXT,
  step TEXT,
  period_start TIMESTAMP NOT NULL,
  period_end TIMESTAMP NOT NULL,
  click_positions JSONB, -- {x, y, count}[]
  scroll_depths JSONB,   -- {depth_percent, count}[]
  hover_positions JSONB, -- {x, y, duration_ms}[]
  session_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 3.16: FRUSTRATION SIGNALS (high-severity behaviors, depends on projects, sessions)
-- =====================================================
CREATE TABLE frustration_signals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  signal_type TEXT NOT NULL, -- 'rage_click', 'form_error', 'back_button_spam', etc.
  severity TEXT NOT NULL,    -- 'low', 'medium', 'high', 'critical'
  journey TEXT,
  step TEXT,
  element TEXT,
  description TEXT,
  metadata JSONB,
  occurred_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 3.17: RATE LIMITS (fallback rate limiting when Redis unavailable)
-- =====================================================
CREATE TABLE rate_limits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_key TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_key, window_start)
);

-- 3.18: REQUEST SIGNATURES (replay attack prevention)
-- =====================================================
CREATE TABLE request_signatures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  signature_hash TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, signature_hash)
);

-- =====================================================
-- STEP 4: INDEXES (in order of table creation)
-- =====================================================

-- Workspaces indexes
CREATE INDEX idx_workspaces_created_at ON workspaces(created_at);

-- Projects indexes
CREATE INDEX idx_projects_workspace_id ON projects(workspace_id);
CREATE INDEX idx_projects_project_key ON projects(project_key);
CREATE INDEX idx_projects_created_at ON projects(created_at);

-- Workspace members indexes
CREATE INDEX idx_workspace_members_workspace_id ON workspace_members(workspace_id);
CREATE INDEX idx_workspace_members_user_id ON workspace_members(user_id);

-- Users indexes
CREATE INDEX idx_users_project_id ON users(project_id);
CREATE INDEX idx_users_user_ref ON users(project_id, user_ref);
CREATE INDEX idx_users_first_seen ON users(first_seen);
CREATE INDEX idx_users_last_seen ON users(last_seen);

-- Sessions indexes
CREATE INDEX idx_sessions_project_id ON sessions(project_id);
CREATE INDEX idx_sessions_session_ref ON sessions(project_id, session_ref);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_started_at ON sessions(started_at);
CREATE INDEX idx_sessions_last_activity ON sessions(last_activity);

-- Events indexes
CREATE INDEX idx_events_project_id ON events(project_id);
CREATE INDEX idx_events_session_id ON events(session_id);
CREATE INDEX idx_events_user_id ON events(user_id);
CREATE INDEX idx_events_event ON events(event);
CREATE INDEX idx_events_journey ON events(journey) WHERE journey IS NOT NULL;
CREATE INDEX idx_events_feature ON events(feature) WHERE feature IS NOT NULL;
CREATE INDEX idx_events_name ON events(name) WHERE name IS NOT NULL;
CREATE INDEX idx_events_created_at ON events(created_at DESC);
CREATE INDEX idx_events_project_created ON events(project_id, created_at DESC);
CREATE INDEX idx_events_journey_analytics ON events(project_id, journey, event, created_at) WHERE journey IS NOT NULL;
CREATE INDEX idx_events_feature_analytics ON events(project_id, feature, created_at) WHERE feature IS NOT NULL;

-- Surveys indexes
CREATE INDEX idx_surveys_project_id ON surveys(project_id);
CREATE INDEX idx_surveys_is_active ON surveys(is_active);

-- Survey responses indexes
CREATE INDEX idx_survey_responses_project_id ON survey_responses(project_id);
CREATE INDEX idx_survey_responses_survey_id ON survey_responses(survey_id);
CREATE INDEX idx_survey_responses_session_id ON survey_responses(session_id);
CREATE INDEX idx_survey_responses_journey ON survey_responses(journey) WHERE journey IS NOT NULL;
CREATE INDEX idx_survey_responses_created_at ON survey_responses(created_at DESC);

-- Journey stats indexes
CREATE INDEX idx_journey_stats_project_id ON journey_stats(project_id);
CREATE INDEX idx_journey_stats_journey ON journey_stats(journey);
CREATE INDEX idx_journey_stats_period ON journey_stats(period_start, period_end);
CREATE INDEX idx_journey_stats_project_period ON journey_stats(project_id, period_start DESC);

-- Feature stats indexes
CREATE INDEX idx_feature_stats_project_id ON feature_stats(project_id);
CREATE INDEX idx_feature_stats_feature ON feature_stats(feature);
CREATE INDEX idx_feature_stats_journey ON feature_stats(journey) WHERE journey IS NOT NULL;
CREATE INDEX idx_feature_stats_period ON feature_stats(period_start, period_end);
CREATE INDEX idx_feature_stats_project_period ON feature_stats(project_id, period_start DESC);
CREATE UNIQUE INDEX idx_feature_stats_unique ON feature_stats(project_id, feature, COALESCE(journey, ''), period_start);

-- Driver stats indexes
CREATE INDEX idx_driver_stats_project_id ON driver_stats(project_id);
CREATE INDEX idx_driver_stats_feature ON driver_stats(feature);
CREATE INDEX idx_driver_stats_journey ON driver_stats(journey) WHERE journey IS NOT NULL;
CREATE INDEX idx_driver_stats_delta ON driver_stats(satisfaction_delta DESC NULLS LAST);
CREATE INDEX idx_driver_stats_period ON driver_stats(period_start, period_end);
CREATE INDEX idx_driver_stats_project_period ON driver_stats(project_id, period_start DESC);
CREATE UNIQUE INDEX idx_driver_stats_unique ON driver_stats(project_id, feature, COALESCE(journey, ''), period_start);

-- User behaviors indexes
CREATE INDEX idx_user_behaviors_project ON user_behaviors(project_id);
CREATE INDEX idx_user_behaviors_session ON user_behaviors(session_id);
CREATE INDEX idx_user_behaviors_type ON user_behaviors(project_id, behavior_type);
CREATE INDEX idx_user_behaviors_journey ON user_behaviors(project_id, journey);
CREATE INDEX idx_user_behaviors_created ON user_behaviors(created_at);

-- Behavior stats indexes
CREATE INDEX idx_behavior_stats_project ON behavior_stats(project_id);
CREATE INDEX idx_behavior_stats_type ON behavior_stats(project_id, behavior_type);
CREATE UNIQUE INDEX idx_behavior_stats_unique ON behavior_stats(project_id, behavior_type, COALESCE(journey, ''), COALESCE(step, ''), period_start);

-- Session quality indexes
CREATE UNIQUE INDEX idx_session_quality_session ON session_quality(session_id);
CREATE INDEX idx_session_quality_project ON session_quality(project_id);
CREATE INDEX idx_session_quality_frustration ON session_quality(project_id, frustration_score DESC);

-- Heatmap data indexes
CREATE INDEX idx_heatmap_project ON heatmap_data(project_id);
CREATE INDEX idx_heatmap_page ON heatmap_data(project_id, page_url);

-- Frustration signals indexes
CREATE INDEX idx_frustration_project ON frustration_signals(project_id);
CREATE INDEX idx_frustration_session ON frustration_signals(session_id);
CREATE INDEX idx_frustration_severity ON frustration_signals(project_id, severity, occurred_at DESC);

-- Rate limits indexes
CREATE INDEX idx_rate_limits_lookup ON rate_limits(project_key, window_start);

-- Request signatures indexes
CREATE INDEX idx_request_signatures_lookup ON request_signatures(project_id, signature_hash, timestamp);

-- Projects secret_key index
CREATE INDEX idx_projects_secret_key ON projects(secret_key);

-- =====================================================
-- STEP 5: HELPER FUNCTIONS
-- =====================================================

-- Get project_id from project_key
CREATE OR REPLACE FUNCTION get_project_id_from_key(key TEXT)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  proj_id UUID;
BEGIN
  SELECT id INTO proj_id
  FROM projects
  WHERE project_key = key;
  
  RETURN proj_id;
END;
$$;

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to generate new project keys (public + secret)
CREATE OR REPLACE FUNCTION generate_project_keys()
RETURNS TABLE(project_key TEXT, secret_key TEXT) AS $$
BEGIN
  RETURN QUERY SELECT 
    'pk_' || encode(gen_random_bytes(24), 'base64') AS project_key,
    'sk_' || encode(gen_random_bytes(32), 'base64') AS secret_key;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-cleanup old rate limits (keep last 5 minutes only)
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS void AS $$
BEGIN
  DELETE FROM rate_limits 
  WHERE window_start < NOW() - INTERVAL '5 minutes';
END;
$$ LANGUAGE plpgsql;

-- Auto-cleanup old signatures (prevent replay attacks within 5 minutes)
CREATE OR REPLACE FUNCTION cleanup_old_signatures()
RETURNS void AS $$
BEGIN
  DELETE FROM request_signatures 
  WHERE timestamp < NOW() - INTERVAL '5 minutes';
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_workspaces_updated_at
  BEFORE UPDATE ON workspaces
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_journey_stats_updated_at
  BEFORE UPDATE ON journey_stats
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_feature_stats_updated_at
  BEFORE UPDATE ON feature_stats
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_driver_stats_updated_at
  BEFORE UPDATE ON driver_stats
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- STEP 6: ROW-LEVEL SECURITY POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE journey_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_behaviors ENABLE ROW LEVEL SECURITY;
ALTER TABLE behavior_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_quality ENABLE ROW LEVEL SECURITY;
ALTER TABLE heatmap_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE frustration_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_signatures ENABLE ROW LEVEL SECURITY;

-- Workspace members policies
CREATE POLICY "Authenticated users can view workspace_members"
  ON workspace_members FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can manage workspace_members"
  ON workspace_members FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Workspaces policies
CREATE POLICY "Users can view their own workspaces"
  ON workspaces FOR SELECT
  USING (
    id IN (
      SELECT workspace_id 
      FROM workspace_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own workspaces"
  ON workspaces FOR UPDATE
  USING (
    id IN (
      SELECT workspace_id 
      FROM workspace_members 
      WHERE user_id = auth.uid()
    )
  );

-- Projects policies
CREATE POLICY "Users can view projects in their workspaces"
  ON projects FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id 
      FROM workspace_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create projects in their workspaces"
  ON projects FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id 
      FROM workspace_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update projects in their workspaces"
  ON projects FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id 
      FROM workspace_members 
      WHERE user_id = auth.uid()
    )
  );

-- Analytics users policies
CREATE POLICY "Users can view analytics users in their projects"
  ON users FOR SELECT
  USING (
    project_id IN (
      SELECT p.id 
      FROM projects p
      JOIN workspace_members wm ON wm.workspace_id = p.workspace_id
      WHERE wm.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage analytics users"
  ON users FOR ALL
  USING (auth.role() = 'service_role');

-- Sessions policies
CREATE POLICY "Users can view sessions in their projects"
  ON sessions FOR SELECT
  USING (
    project_id IN (
      SELECT p.id 
      FROM projects p
      JOIN workspace_members wm ON wm.workspace_id = p.workspace_id
      WHERE wm.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage sessions"
  ON sessions FOR ALL
  USING (auth.role() = 'service_role');

-- Events policies
CREATE POLICY "Users can view events in their projects"
  ON events FOR SELECT
  USING (
    project_id IN (
      SELECT p.id 
      FROM projects p
      JOIN workspace_members wm ON wm.workspace_id = p.workspace_id
      WHERE wm.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can insert events"
  ON events FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Surveys policies
CREATE POLICY "Users can view surveys in their projects"
  ON surveys FOR SELECT
  USING (
    project_id IN (
      SELECT p.id 
      FROM projects p
      JOIN workspace_members wm ON wm.workspace_id = p.workspace_id
      WHERE wm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage surveys in their projects"
  ON surveys FOR ALL
  USING (
    project_id IN (
      SELECT p.id 
      FROM projects p
      JOIN workspace_members wm ON wm.workspace_id = p.workspace_id
      WHERE wm.user_id = auth.uid()
    )
  );

-- Survey responses policies
CREATE POLICY "Users can view survey responses in their projects"
  ON survey_responses FOR SELECT
  USING (
    project_id IN (
      SELECT p.id 
      FROM projects p
      JOIN workspace_members wm ON wm.workspace_id = p.workspace_id
      WHERE wm.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can insert survey responses"
  ON survey_responses FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Aggregation tables policies (all follow same pattern)
CREATE POLICY "Users can view journey stats in their projects"
  ON journey_stats FOR SELECT
  USING (
    project_id IN (
      SELECT p.id 
      FROM projects p
      JOIN workspace_members wm ON wm.workspace_id = p.workspace_id
      WHERE wm.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage journey stats"
  ON journey_stats FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Users can view feature stats in their projects"
  ON feature_stats FOR SELECT
  USING (
    project_id IN (
      SELECT p.id 
      FROM projects p
      JOIN workspace_members wm ON wm.workspace_id = p.workspace_id
      WHERE wm.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage feature stats"
  ON feature_stats FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Users can view driver stats in their projects"
  ON driver_stats FOR SELECT
  USING (
    project_id IN (
      SELECT p.id 
      FROM projects p
      JOIN workspace_members wm ON wm.workspace_id = p.workspace_id
      WHERE wm.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage driver stats"
  ON driver_stats FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Users can view their user_behaviors"
  ON user_behaviors FOR SELECT
  TO authenticated
  USING (
    project_id IN (
      SELECT p.id FROM projects p
      JOIN workspaces w ON w.id = p.workspace_id
      JOIN workspace_members wm ON wm.workspace_id = w.id
      WHERE wm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view their behavior_stats"
  ON behavior_stats FOR SELECT
  TO authenticated
  USING (
    project_id IN (
      SELECT p.id FROM projects p
      JOIN workspaces w ON w.id = p.workspace_id
      JOIN workspace_members wm ON wm.workspace_id = w.id
      WHERE wm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view their session_quality"
  ON session_quality FOR SELECT
  TO authenticated
  USING (
    project_id IN (
      SELECT p.id FROM projects p
      JOIN workspaces w ON w.id = p.workspace_id
      JOIN workspace_members wm ON wm.workspace_id = w.id
      WHERE wm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view their heatmap_data"
  ON heatmap_data FOR SELECT
  TO authenticated
  USING (
    project_id IN (
      SELECT p.id FROM projects p
      JOIN workspaces w ON w.id = p.workspace_id
      JOIN workspace_members wm ON wm.workspace_id = w.id
      WHERE wm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view their frustration_signals"
  ON frustration_signals FOR SELECT
  TO authenticated
  USING (
    project_id IN (
      SELECT p.id FROM projects p
      JOIN workspaces w ON w.id = p.workspace_id
      JOIN workspace_members wm ON wm.workspace_id = w.id
      WHERE wm.user_id = auth.uid()
    )
  );

-- Rate limits policies (only service role)
CREATE POLICY "Service role can manage rate limits"
  ON rate_limits FOR ALL
  USING (auth.role() = 'service_role');

-- Request signatures policies (only service role)
CREATE POLICY "Service role can manage request signatures"
  ON request_signatures FOR ALL
  USING (auth.role() = 'service_role');

-- =====================================================
-- STEP 7: VIEWS (analytics helpers)
-- =====================================================

-- Recent journey performance
CREATE OR REPLACE VIEW v_recent_journey_performance AS
SELECT 
  j.*,
  p.name AS project_name,
  p.project_key
FROM journey_stats j
JOIN projects p ON p.id = j.project_id
WHERE j.period_start >= NOW() - INTERVAL '30 days'
ORDER BY j.period_start DESC;

-- Top positive drivers
CREATE OR REPLACE VIEW v_top_positive_drivers AS
SELECT 
  d.*,
  p.name AS project_name,
  p.project_key
FROM driver_stats d
JOIN projects p ON p.id = d.project_id
WHERE d.satisfaction_delta > 0
  AND d.period_start >= NOW() - INTERVAL '30 days'
ORDER BY d.satisfaction_delta DESC;

-- Top negative drivers
CREATE OR REPLACE VIEW v_top_negative_drivers AS
SELECT 
  d.*,
  p.name AS project_name,
  p.project_key
FROM driver_stats d
JOIN projects p ON p.id = d.project_id
WHERE d.satisfaction_delta < 0
  AND d.period_start >= NOW() - INTERVAL '30 days'
ORDER BY d.satisfaction_delta ASC;

-- =====================================================
-- STEP 8: COMMENTS (documentation)
-- =====================================================

-- Table comments
COMMENT ON TABLE workspaces IS 'Top-level organization units';
COMMENT ON TABLE projects IS 'Individual apps/products being tracked';
COMMENT ON TABLE workspace_members IS 'Links authenticated users to workspaces with roles';
COMMENT ON TABLE users IS 'End users of tracked apps (analytics users, not auth users)';
COMMENT ON TABLE sessions IS 'User sessions with activity tracking';
COMMENT ON TABLE events IS 'All analytics events (journeys, features, satisfaction, behaviors, custom)';
COMMENT ON TABLE surveys IS 'Configurable satisfaction surveys';
COMMENT ON TABLE survey_responses IS 'Survey responses from users';
COMMENT ON TABLE journey_stats IS 'Aggregated journey completion and satisfaction metrics';
COMMENT ON TABLE feature_stats IS 'Aggregated feature usage statistics';
COMMENT ON TABLE driver_stats IS 'Correlation between feature usage and satisfaction (drivers)';
COMMENT ON TABLE user_behaviors IS 'Raw behavior events captured automatically by the SDK';
COMMENT ON TABLE behavior_stats IS 'Aggregated behavior statistics';
COMMENT ON TABLE session_quality IS 'Quality metrics per session';
COMMENT ON TABLE heatmap_data IS 'Aggregated heatmap data for visualization';
COMMENT ON TABLE frustration_signals IS 'High-severity frustration events requiring attention';
COMMENT ON TABLE rate_limits IS 'Rate limiting counters (fallback when Redis unavailable)';
COMMENT ON TABLE request_signatures IS 'Tracks used signatures to prevent replay attacks';

-- Column comments
COMMENT ON COLUMN events.name IS 'Custom event name (required for CUSTOM events, used to distinguish different custom event types)';
COMMENT ON COLUMN projects.domain_restriction IS 'Optional domain restriction for web tracking security';
COMMENT ON COLUMN projects.secret_key IS 'Secret key for HMAC signature authentication (server-side only, never expose to frontend)';
COMMENT ON COLUMN user_behaviors.behavior_type IS 'Types: rage_click, dead_click, scroll_depth, rapid_scroll, mouse_hesitation, form_abandonment, copy_paste, tab_hidden, tab_visible, back_button, error_click, slow_load, network_error, orientation_change, long_form_fill, field_refill, selection_change, swipe_gesture, pinch_zoom, device_shake, screen_rotation';

-- Function comments
COMMENT ON FUNCTION get_project_id_from_key IS 'Helper to resolve project_key to project_id';
COMMENT ON FUNCTION generate_project_keys IS 'Generates cryptographically secure project_key and secret_key pair';

-- Policy comments
COMMENT ON POLICY "Users can view their own workspaces" ON workspaces IS 'Users can only access workspaces they are members of';
COMMENT ON POLICY "Service role can manage analytics users" ON users IS 'Edge Functions use service role to upsert analytics users';
COMMENT ON POLICY "Service role can insert events" ON events IS 'Edge Functions use service role to insert tracking events';

-- View comments
COMMENT ON VIEW v_recent_journey_performance IS 'Last 30 days of journey performance metrics';
COMMENT ON VIEW v_top_positive_drivers IS 'Features that positively correlate with satisfaction';
COMMENT ON VIEW v_top_negative_drivers IS 'Features that negatively correlate with satisfaction';

-- =====================================================
-- STEP 8: AGGREGATION TRIGGERS
-- =====================================================
-- These triggers automatically update aggregation tables
-- when events are inserted, eliminating the need for
-- scheduled cron jobs.
-- =====================================================

-- Helper function: Get current day period
CREATE OR REPLACE FUNCTION get_current_period()
RETURNS TABLE(period_start TIMESTAMPTZ, period_end TIMESTAMPTZ) AS $$
BEGIN
  RETURN QUERY SELECT 
    date_trunc('day', NOW())::TIMESTAMPTZ,
    (date_trunc('day', NOW()) + INTERVAL '1 day')::TIMESTAMPTZ;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- TRIGGER FUNCTION 1: Update Journey Stats
-- =====================================================
CREATE OR REPLACE FUNCTION update_journey_stats()
RETURNS TRIGGER AS $$
DECLARE
  v_period_start TIMESTAMPTZ;
  v_period_end TIMESTAMPTZ;
BEGIN
  -- Only process journey-related events
  IF NEW.journey IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get current period
  SELECT * INTO v_period_start, v_period_end FROM get_current_period();

  -- Initialize journey_stats row if it doesn't exist
  INSERT INTO journey_stats (
    project_id,
    journey,
    period_start,
    period_end,
    total_sessions,
    completed_sessions,
    completion_rate,
    avg_satisfaction
  )
  VALUES (
    NEW.project_id,
    NEW.journey,
    v_period_start,
    v_period_end,
    0,
    0,
    0,
    NULL
  )
  ON CONFLICT (project_id, journey, period_start) DO NOTHING;

  -- Update based on event type
  CASE NEW.event
    WHEN 'JOURNEY_START' THEN
      -- Recalculate session count
      UPDATE journey_stats
      SET 
        total_sessions = (
          SELECT COUNT(DISTINCT session_id)
          FROM events
          WHERE project_id = NEW.project_id
            AND journey = NEW.journey
            AND event = 'JOURNEY_START'
            AND created_at >= v_period_start
            AND created_at < v_period_end
        ),
        updated_at = NOW()
      WHERE project_id = NEW.project_id
        AND journey = NEW.journey
        AND period_start = v_period_start;

      -- Recalculate completion rate
      UPDATE journey_stats
      SET 
        completion_rate = CASE 
          WHEN total_sessions > 0 
          THEN ROUND((completed_sessions::NUMERIC / total_sessions::NUMERIC) * 100, 2)
          ELSE 0 
        END,
        updated_at = NOW()
      WHERE project_id = NEW.project_id
        AND journey = NEW.journey
        AND period_start = v_period_start;

    WHEN 'JOURNEY_COMPLETE' THEN
      -- Recalculate completion count
      UPDATE journey_stats
      SET 
        completed_sessions = (
          SELECT COUNT(DISTINCT session_id)
          FROM events
          WHERE project_id = NEW.project_id
            AND journey = NEW.journey
            AND event = 'JOURNEY_COMPLETE'
            AND created_at >= v_period_start
            AND created_at < v_period_end
        ),
        updated_at = NOW()
      WHERE project_id = NEW.project_id
        AND journey = NEW.journey
        AND period_start = v_period_start;

      -- Recalculate completion rate
      UPDATE journey_stats
      SET 
        completion_rate = CASE 
          WHEN total_sessions > 0 
          THEN ROUND((completed_sessions::NUMERIC / total_sessions::NUMERIC) * 100, 2)
          ELSE 0 
        END,
        updated_at = NOW()
      WHERE project_id = NEW.project_id
        AND journey = NEW.journey
        AND period_start = v_period_start;

    WHEN 'JOURNEY_SATISFACTION' THEN
      -- Recalculate average satisfaction
      UPDATE journey_stats
      SET 
        avg_satisfaction = ROUND((
          SELECT AVG(value)
          FROM events
          WHERE project_id = NEW.project_id
            AND journey = NEW.journey
            AND event = 'JOURNEY_SATISFACTION'
            AND value IS NOT NULL
            AND created_at >= v_period_start
            AND created_at < v_period_end
        ), 2),
        updated_at = NOW()
      WHERE project_id = NEW.project_id
        AND journey = NEW.journey
        AND period_start = v_period_start;

    ELSE
      -- Do nothing for other event types
  END CASE;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGER FUNCTION 2: Update Driver Stats
-- =====================================================
CREATE OR REPLACE FUNCTION update_driver_stats()
RETURNS TRIGGER AS $$
DECLARE
  v_period_start TIMESTAMPTZ;
  v_period_end TIMESTAMPTZ;
  v_feature TEXT;
  v_journey TEXT;
BEGIN
  -- Get current period
  SELECT * INTO v_period_start, v_period_end FROM get_current_period();

  -- Process FEATURE_USED events
  IF NEW.event = 'FEATURE_USED' AND NEW.feature IS NOT NULL THEN
    v_feature := NEW.feature;
    v_journey := NEW.journey;

    -- Initialize driver_stats row if it doesn't exist
    INSERT INTO driver_stats (
      project_id,
      feature,
      journey,
      period_start,
      period_end,
      sessions_with_feature,
      sessions_without_feature,
      avg_satisfaction_with,
      avg_satisfaction_without,
      satisfaction_delta
    )
    VALUES (
      NEW.project_id,
      v_feature,
      v_journey,
      v_period_start,
      v_period_end,
      0,
      0,
      NULL,
      NULL,
      NULL
    )
    ON CONFLICT DO NOTHING;

    -- Recalculate sessions with feature
    UPDATE driver_stats ds
    SET 
      sessions_with_feature = (
        SELECT COUNT(DISTINCT e.session_id)
        FROM events e
        WHERE e.project_id = NEW.project_id
          AND e.feature = v_feature
          AND (v_journey IS NULL OR e.journey = v_journey)
          AND e.event = 'FEATURE_USED'
          AND e.created_at >= v_period_start
          AND e.created_at < v_period_end
          AND e.session_id IS NOT NULL
      ),
      updated_at = NOW()
    WHERE ds.project_id = NEW.project_id
      AND ds.feature = v_feature
      AND (ds.journey IS NULL AND v_journey IS NULL OR ds.journey = v_journey)
      AND ds.period_start = v_period_start;

    -- Recalculate avg satisfaction with feature
    UPDATE driver_stats ds
    SET 
      avg_satisfaction_with = ROUND((
        SELECT AVG(sat.value)
        FROM events sat
        WHERE sat.project_id = NEW.project_id
          AND sat.event = 'JOURNEY_SATISFACTION'
          AND sat.value IS NOT NULL
          AND sat.session_id IN (
            SELECT DISTINCT e.session_id
            FROM events e
            WHERE e.project_id = NEW.project_id
              AND e.feature = v_feature
              AND (v_journey IS NULL OR e.journey = v_journey)
              AND e.event = 'FEATURE_USED'
              AND e.created_at >= v_period_start
              AND e.created_at < v_period_end
              AND e.session_id IS NOT NULL
          )
          AND sat.created_at >= v_period_start
          AND sat.created_at < v_period_end
      ), 2),
      updated_at = NOW()
    WHERE ds.project_id = NEW.project_id
      AND ds.feature = v_feature
      AND (ds.journey IS NULL AND v_journey IS NULL OR ds.journey = v_journey)
      AND ds.period_start = v_period_start;
  END IF;

  -- Process JOURNEY_SATISFACTION events
  IF NEW.event = 'JOURNEY_SATISFACTION' AND NEW.value IS NOT NULL THEN
    -- Update all relevant driver_stats rows
    UPDATE driver_stats ds
    SET
      -- Recalculate satisfaction with feature
      avg_satisfaction_with = ROUND((
        SELECT AVG(sat.value)
        FROM events sat
        WHERE sat.project_id = ds.project_id
          AND sat.event = 'JOURNEY_SATISFACTION'
          AND sat.value IS NOT NULL
          AND sat.session_id IN (
            SELECT DISTINCT e.session_id
            FROM events e
            WHERE e.project_id = ds.project_id
              AND e.feature = ds.feature
              AND (ds.journey IS NULL OR e.journey = ds.journey)
              AND e.event = 'FEATURE_USED'
              AND e.created_at >= ds.period_start
              AND e.created_at < ds.period_end
              AND e.session_id IS NOT NULL
          )
          AND sat.created_at >= ds.period_start
          AND sat.created_at < ds.period_end
      ), 2),
      -- Recalculate satisfaction without feature
      avg_satisfaction_without = ROUND((
        SELECT AVG(sat.value)
        FROM events sat
        WHERE sat.project_id = ds.project_id
          AND sat.event = 'JOURNEY_SATISFACTION'
          AND sat.value IS NOT NULL
          AND sat.session_id NOT IN (
            SELECT DISTINCT e.session_id
            FROM events e
            WHERE e.project_id = ds.project_id
              AND e.feature = ds.feature
              AND (ds.journey IS NULL OR e.journey = ds.journey)
              AND e.event = 'FEATURE_USED'
              AND e.created_at >= ds.period_start
              AND e.created_at < ds.period_end
              AND e.session_id IS NOT NULL
          )
          AND sat.session_id IS NOT NULL
          AND sat.created_at >= ds.period_start
          AND sat.created_at < ds.period_end
      ), 2),
      sessions_without_feature = (
        SELECT COUNT(DISTINCT sat.session_id)
        FROM events sat
        WHERE sat.project_id = ds.project_id
          AND sat.event = 'JOURNEY_SATISFACTION'
          AND sat.session_id NOT IN (
            SELECT DISTINCT e.session_id
            FROM events e
            WHERE e.project_id = ds.project_id
              AND e.feature = ds.feature
              AND (ds.journey IS NULL OR e.journey = ds.journey)
              AND e.event = 'FEATURE_USED'
              AND e.created_at >= ds.period_start
              AND e.created_at < ds.period_end
              AND e.session_id IS NOT NULL
          )
          AND sat.session_id IS NOT NULL
          AND sat.created_at >= ds.period_start
          AND sat.created_at < ds.period_end
      ),
      updated_at = NOW()
    WHERE ds.project_id = NEW.project_id
      AND ds.period_start = v_period_start
      AND ds.period_end = v_period_end;

    -- Calculate delta for all updated rows
    UPDATE driver_stats
    SET
      satisfaction_delta = CASE
        WHEN avg_satisfaction_with IS NOT NULL AND avg_satisfaction_without IS NOT NULL
        THEN ROUND(avg_satisfaction_with - avg_satisfaction_without, 2)
        ELSE NULL
      END,
      updated_at = NOW()
    WHERE project_id = NEW.project_id
      AND period_start = v_period_start
      AND period_end = v_period_end;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGER FUNCTION 3: Update Behavior Stats
-- =====================================================
CREATE OR REPLACE FUNCTION update_behavior_stats()
RETURNS TRIGGER AS $$
DECLARE
  v_period_start TIMESTAMPTZ;
  v_period_end TIMESTAMPTZ;
BEGIN
  -- Get current period
  SELECT * INTO v_period_start, v_period_end FROM get_current_period();

  -- Initialize behavior_stats row if it doesn't exist
  INSERT INTO behavior_stats (
    project_id,
    period_start,
    period_end,
    behavior_type,
    journey,
    step,
    occurrence_count,
    unique_sessions,
    avg_value,
    avg_satisfaction_with_behavior,
    avg_satisfaction_without_behavior,
    satisfaction_delta,
    top_elements
  )
  VALUES (
    NEW.project_id,
    v_period_start,
    v_period_end,
    NEW.behavior_type,
    NEW.journey,
    NEW.step,
    0,
    0,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL
  )
  ON CONFLICT DO NOTHING;

  -- Update occurrence count and metrics
  UPDATE behavior_stats bs
  SET 
    occurrence_count = (
      SELECT COUNT(*)
      FROM user_behaviors ub
      WHERE ub.project_id = NEW.project_id
        AND ub.behavior_type = NEW.behavior_type
        AND (NEW.journey IS NULL OR ub.journey = NEW.journey)
        AND (NEW.step IS NULL OR ub.step = NEW.step)
        AND ub.occurred_at >= v_period_start
        AND ub.occurred_at < v_period_end
    ),
    unique_sessions = (
      SELECT COUNT(DISTINCT ub.session_id)
      FROM user_behaviors ub
      WHERE ub.project_id = NEW.project_id
        AND ub.behavior_type = NEW.behavior_type
        AND (NEW.journey IS NULL OR ub.journey = NEW.journey)
        AND (NEW.step IS NULL OR ub.step = NEW.step)
        AND ub.occurred_at >= v_period_start
        AND ub.occurred_at < v_period_end
        AND ub.session_id IS NOT NULL
    ),
    avg_value = (
      SELECT ROUND(AVG(ub.value), 2)
      FROM user_behaviors ub
      WHERE ub.project_id = NEW.project_id
        AND ub.behavior_type = NEW.behavior_type
        AND (NEW.journey IS NULL OR ub.journey = NEW.journey)
        AND (NEW.step IS NULL OR ub.step = NEW.step)
        AND ub.value IS NOT NULL
        AND ub.occurred_at >= v_period_start
        AND ub.occurred_at < v_period_end
    ),
    avg_satisfaction_with_behavior = ROUND((
      SELECT AVG(e.value)
      FROM events e
      WHERE e.project_id = NEW.project_id
        AND e.event = 'JOURNEY_SATISFACTION'
        AND e.value IS NOT NULL
        AND e.session_id IN (
          SELECT DISTINCT ub.session_id
          FROM user_behaviors ub
          WHERE ub.project_id = NEW.project_id
            AND ub.behavior_type = NEW.behavior_type
            AND (NEW.journey IS NULL OR ub.journey = NEW.journey)
            AND (NEW.step IS NULL OR ub.step = NEW.step)
            AND ub.occurred_at >= v_period_start
            AND ub.occurred_at < v_period_end
            AND ub.session_id IS NOT NULL
        )
        AND e.created_at >= v_period_start
        AND e.created_at < v_period_end
    ), 2),
    avg_satisfaction_without_behavior = ROUND((
      SELECT AVG(e.value)
      FROM events e
      WHERE e.project_id = NEW.project_id
        AND e.event = 'JOURNEY_SATISFACTION'
        AND e.value IS NOT NULL
        AND e.session_id NOT IN (
          SELECT DISTINCT ub.session_id
          FROM user_behaviors ub
          WHERE ub.project_id = NEW.project_id
            AND ub.behavior_type = NEW.behavior_type
            AND (NEW.journey IS NULL OR ub.journey = NEW.journey)
            AND (NEW.step IS NULL OR ub.step = NEW.step)
            AND ub.occurred_at >= v_period_start
            AND ub.occurred_at < v_period_end
            AND ub.session_id IS NOT NULL
        )
        AND e.session_id IS NOT NULL
        AND e.created_at >= v_period_start
        AND e.created_at < v_period_end
    ), 2),
    top_elements = (
      SELECT jsonb_agg(elem)
      FROM (
        SELECT 
          jsonb_build_object(
            'selector', ub.element_selector,
            'count', COUNT(*)
          ) as elem
        FROM user_behaviors ub
        WHERE ub.project_id = NEW.project_id
          AND ub.behavior_type = NEW.behavior_type
          AND (NEW.journey IS NULL OR ub.journey = NEW.journey)
          AND (NEW.step IS NULL OR ub.step = NEW.step)
          AND ub.element_selector IS NOT NULL
          AND ub.occurred_at >= v_period_start
          AND ub.occurred_at < v_period_end
        GROUP BY ub.element_selector
        ORDER BY COUNT(*) DESC
        LIMIT 10
      ) top_10
    ),
    updated_at = NOW()
  WHERE bs.project_id = NEW.project_id
    AND bs.behavior_type = NEW.behavior_type
    AND (bs.journey IS NULL AND NEW.journey IS NULL OR bs.journey = NEW.journey)
    AND (bs.step IS NULL AND NEW.step IS NULL OR bs.step = NEW.step)
    AND bs.period_start = v_period_start;

  -- Calculate satisfaction delta
  UPDATE behavior_stats
  SET
    satisfaction_delta = CASE
      WHEN avg_satisfaction_with_behavior IS NOT NULL 
        AND avg_satisfaction_without_behavior IS NOT NULL
      THEN ROUND(avg_satisfaction_with_behavior - avg_satisfaction_without_behavior, 2)
      ELSE NULL
    END,
    updated_at = NOW()
  WHERE project_id = NEW.project_id
    AND behavior_type = NEW.behavior_type
    AND (journey IS NULL AND NEW.journey IS NULL OR journey = NEW.journey)
    AND (step IS NULL AND NEW.step IS NULL OR step = NEW.step)
    AND period_start = v_period_start;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- CREATE TRIGGERS
-- =====================================================

-- Trigger on events table for journey stats
DROP TRIGGER IF EXISTS trigger_update_journey_stats ON events;
CREATE TRIGGER trigger_update_journey_stats
  AFTER INSERT ON events
  FOR EACH ROW
  WHEN (NEW.journey IS NOT NULL AND NEW.event IN ('JOURNEY_START', 'JOURNEY_COMPLETE', 'JOURNEY_SATISFACTION'))
  EXECUTE FUNCTION update_journey_stats();

-- Trigger on events table for driver stats
DROP TRIGGER IF EXISTS trigger_update_driver_stats ON events;
CREATE TRIGGER trigger_update_driver_stats
  AFTER INSERT ON events
  FOR EACH ROW
  WHEN (NEW.event IN ('FEATURE_USED', 'JOURNEY_SATISFACTION'))
  EXECUTE FUNCTION update_driver_stats();

-- Trigger on user_behaviors table for behavior stats
DROP TRIGGER IF EXISTS trigger_update_behavior_stats ON user_behaviors;
CREATE TRIGGER trigger_update_behavior_stats
  AFTER INSERT ON user_behaviors
  FOR EACH ROW
  EXECUTE FUNCTION update_behavior_stats();

-- =====================================================
-- ADDITIONAL INDEXES FOR TRIGGER PERFORMANCE
-- =====================================================

-- Indexes for journey stats triggers
CREATE INDEX IF NOT EXISTS idx_events_journey_trigger 
  ON events(project_id, journey, event, created_at)
  WHERE journey IS NOT NULL;

-- Indexes for driver stats triggers
CREATE INDEX IF NOT EXISTS idx_events_feature_trigger 
  ON events(project_id, feature, event, session_id, created_at)
  WHERE feature IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_satisfaction_trigger 
  ON events(project_id, event, session_id, value, created_at)
  WHERE event = 'JOURNEY_SATISFACTION';

-- Indexes for behavior stats triggers
CREATE INDEX IF NOT EXISTS idx_user_behaviors_trigger 
  ON user_behaviors(project_id, behavior_type, journey, step, occurred_at);
CREATE INDEX IF NOT EXISTS idx_user_behaviors_session_trigger 
  ON user_behaviors(project_id, session_id, occurred_at)
  WHERE session_id IS NOT NULL;

-- =====================================================
-- STEP 9: AUTO-CREATE WORKSPACE FOR NEW USERS
-- =====================================================
-- This trigger automatically creates a default workspace
-- when a new user signs up, ensuring every user has
-- a workspace to create projects in.
-- =====================================================

-- Function to create default workspace for new user
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  workspace_id UUID;
BEGIN
  -- Create a default workspace for the new user
  INSERT INTO workspaces (name)
  VALUES (NEW.email || '''s Workspace')
  RETURNING id INTO workspace_id;

  -- Add the user as owner of the workspace
  INSERT INTO workspace_members (workspace_id, user_id, role)
  VALUES (workspace_id, NEW.id, 'owner');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to run after user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- =====================================================
-- BACKFILL: Create workspaces for existing users
-- =====================================================
-- This creates workspaces for any existing users who don't have one

DO $$
DECLARE
  user_record RECORD;
  workspace_id UUID;
BEGIN
  -- Loop through users who don't have a workspace
  FOR user_record IN 
    SELECT au.id, au.email
    FROM auth.users au
    WHERE NOT EXISTS (
      SELECT 1 FROM workspace_members wm WHERE wm.user_id = au.id
    )
  LOOP
    -- Create workspace
    INSERT INTO workspaces (name)
    VALUES (user_record.email || '''s Workspace')
    RETURNING id INTO workspace_id;

    -- Add user as owner
    INSERT INTO workspace_members (workspace_id, user_id, role)
    VALUES (workspace_id, user_record.id, 'owner');

    RAISE NOTICE 'Created workspace for user: %', user_record.email;
  END LOOP;
END $$;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- Schema version: 1.1
-- Last updated: 2025
-- 
-- This migration creates the complete ProductDrivers schema:
-- - 16 tables for core data and aggregations
-- - 80+ indexes for query performance
-- - 8 functions (4 helpers + 3 aggregation triggers + 1 period helper)
-- - 40+ RLS policies for security
-- - 3 analytics views
-- - 3 automatic aggregation triggers
-- - Automatic workspace creation for new users
-- 
-- Next steps:
-- 1. Deploy Edge Functions (supabase/functions/)
-- 2. Configure authentication
-- 3. Create your first project via the dashboard
-- 
-- Note: Aggregation tables (journey_stats, driver_stats, behavior_stats)
-- are automatically updated by database triggers when events are inserted.
-- No cron jobs required.
-- =====================================================

