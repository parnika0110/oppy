-- OPPY Database Schema for Supabase
-- Migration 001: Initial schema

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- for fuzzy text search

-- ============================================================
-- PROFILES (extends Supabase Auth users)
-- ============================================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  experience_level TEXT CHECK (experience_level IN ('Student', 'Recent Graduate', 'Working Professional')),
  location TEXT,
  preferred_work_mode TEXT CHECK (preferred_work_mode IN ('Remote', 'On-site', 'Hybrid', 'Any')),
  onboarding_complete BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- USER PREFERENCES
-- ============================================================
CREATE TABLE user_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  categories TEXT[] DEFAULT '{}',
  interests TEXT[] DEFAULT '{}',
  locations TEXT[] DEFAULT '{}',
  remote BOOLEAN,
  experience_level TEXT,
  preferred_sources TEXT[] DEFAULT '{}',
  language TEXT DEFAULT 'en',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- OPPORTUNITIES
-- ============================================================
CREATE TABLE opportunities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Core fields
  title TEXT NOT NULL,
  organization TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL CHECK (category IN ('Job', 'Internship', 'Hackathon', 'Fellowship', 'Scholarship', 'Grant', 'Event')),
  
  -- Location
  location TEXT NOT NULL DEFAULT '',
  is_remote BOOLEAN DEFAULT FALSE,
  city TEXT,
  country TEXT,
  
  -- URLs
  application_url TEXT,
  source_url TEXT,
  event_url TEXT,
  organizer_url TEXT,
  official_source_url TEXT,
  
  -- Images
  image_url TEXT,
  image_alt TEXT,
  
  -- Dates
  application_deadline TIMESTAMPTZ,
  registration_deadline TIMESTAMPTZ,
  event_start_date TIMESTAMPTZ,
  event_end_date TIMESTAMPTZ,
  deadline_kind TEXT DEFAULT 'unavailable' CHECK (deadline_kind IN ('verified', 'source_provided', 'rolling', 'unavailable')),
  
  -- Tags & scoring
  tags TEXT[] DEFAULT '{}',
  quality_score NUMERIC,
  opportunity_score NUMERIC,
  
  -- Source provenance
  source TEXT,
  source_platform TEXT,
  source_id TEXT,
  discovery_method TEXT,
  discovery_query TEXT,
  source_trust_tier TEXT,
  
  -- Lifecycle
  lifecycle_status TEXT DEFAULT 'active' CHECK (lifecycle_status IN ('active', 'closed', 'archived')),
  is_active BOOLEAN DEFAULT TRUE,
  
  -- AI enrichment
  ai_summary JSONB,
  category_validation JSONB,
  
  -- Timestamps
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SAVED OPPORTUNITIES
-- ============================================================
CREATE TABLE saved_opportunities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, opportunity_id)
);

-- ============================================================
-- APPLICATION TRACKING
-- ============================================================
CREATE TABLE application_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'interested' CHECK (status IN ('interested', 'saved', 'applied', 'interview', 'rejected', 'accepted', 'archived')),
  notes TEXT,
  applied_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, opportunity_id)
);

-- ============================================================
-- RECENTLY VIEWED
-- ============================================================
CREATE TABLE recently_viewed (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INGESTION RUNS
-- ============================================================
CREATE TABLE ingestion_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  fetched INTEGER DEFAULT 0,
  published INTEGER DEFAULT 0,
  duplicates INTEGER DEFAULT 0,
  rejected INTEGER DEFAULT 0,
  error_message TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SOURCE HEALTH
-- ============================================================
CREATE TABLE source_health (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  configured BOOLEAN DEFAULT FALSE,
  last_run TIMESTAMPTZ,
  last_success TIMESTAMPTZ,
  last_error TEXT,
  fetched INTEGER DEFAULT 0,
  published INTEGER DEFAULT 0,
  duplicates INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DISCOVERY CANDIDATES
-- ============================================================
CREATE TABLE discovery_candidates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  organization TEXT NOT NULL,
  url TEXT,
  source_platform TEXT,
  source_id TEXT,
  discovered_from TEXT,
  trust_tier TEXT,
  candidate_type TEXT,
  description TEXT,
  deadline TIMESTAMPTZ,
  deadline_kind TEXT,
  event_date TIMESTAMPTZ,
  image_url TEXT,
  validation_state TEXT DEFAULT 'pending',
  rejection_reasons TEXT[],
  promoted_at TIMESTAMPTZ,
  promoted_to_id UUID REFERENCES opportunities(id),
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

-- Opportunities: primary browse queries
CREATE INDEX idx_opportunities_category ON opportunities(category);
CREATE INDEX idx_opportunities_lifecycle ON opportunities(lifecycle_status, is_active);
CREATE INDEX idx_opportunities_remote ON opportunities(is_remote);
CREATE INDEX idx_opportunities_deadline ON opportunities(application_deadline);
CREATE INDEX idx_opportunities_event_date ON opportunities(event_start_date);
CREATE INDEX idx_opportunities_created ON opportunities(created_at DESC);
CREATE INDEX idx_opportunities_source_platform ON opportunities(source_platform);
CREATE INDEX idx_opportunities_tags ON opportunities USING GIN(tags);
CREATE INDEX idx_opportunities_score ON opportunities(opportunity_score DESC NULLS LAST);
CREATE INDEX idx_opportunities_location_trgm ON opportunities USING GIN(location gin_trgm_ops);
CREATE INDEX idx_opportunities_title_trgm ON opportunities USING GIN(title gin_trgm_ops);

-- Full-text search
CREATE INDEX idx_opportunities_fts ON opportunities USING GIN(
  to_tsvector('english', coalesce(title, '') || ' ' || coalesce(organization, '') || ' ' || coalesce(description, ''))
);

-- Saved opportunities
CREATE INDEX idx_saved_user ON saved_opportunities(user_id);
CREATE INDEX idx_saved_opportunity ON saved_opportunities(opportunity_id);

-- Application tracking
CREATE INDEX idx_tracking_user ON application_tracking(user_id);
CREATE INDEX idx_tracking_status ON application_tracking(user_id, status);

-- Recently viewed
CREATE INDEX idx_recently_viewed_user ON recently_viewed(user_id, viewed_at DESC);

-- Ingestion runs
CREATE INDEX idx_runs_source ON ingestion_runs(source, started_at DESC);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE recently_viewed ENABLE ROW LEVEL SECURITY;
ALTER TABLE discovery_candidates ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read/update their own profile
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- User preferences: users can CRUD their own preferences
CREATE POLICY "Users can view own preferences" ON user_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own preferences" ON user_preferences FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own preferences" ON user_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Opportunities: public read for active, admin write
CREATE POLICY "Public can view active opportunities" ON opportunities FOR SELECT USING (lifecycle_status = 'active' OR lifecycle_status = 'closed');
CREATE POLICY "Service role can manage opportunities" ON opportunities FOR ALL USING (true) WITH CHECK (true);

-- Saved opportunities: users can CRUD their own saves
CREATE POLICY "Users can view own saves" ON saved_opportunities FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own saves" ON saved_opportunities FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own saves" ON saved_opportunities FOR DELETE USING (auth.uid() = user_id);

-- Application tracking: users can CRUD their own tracking
CREATE POLICY "Users can view own tracking" ON application_tracking FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tracking" ON application_tracking FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tracking" ON application_tracking FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own tracking" ON application_tracking FOR DELETE USING (auth.uid() = user_id);

-- Recently viewed: users can view/insert their own
CREATE POLICY "Users can view own recently viewed" ON recently_viewed FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own recently viewed" ON recently_viewed FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Discovery candidates: admin only (service role)
CREATE POLICY "Service role can manage candidates" ON discovery_candidates FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_profiles_updated
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_preferences_updated
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_opportunities_updated
  BEFORE UPDATE ON opportunities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_tracking_updated
  BEFORE UPDATE ON application_tracking
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_source_health_updated
  BEFORE UPDATE ON source_health
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'name', ''));
  
  INSERT INTO user_preferences (user_id)
  VALUES (NEW.id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
