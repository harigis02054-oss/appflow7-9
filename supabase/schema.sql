-- ==============================================================================
-- APPFLOW MASTER PRODUCTION DATABASE SCHEMA (PostgreSQL / Supabase)
-- Master Development Prompt: Phases 4 through 9
-- ==============================================================================

-- Enable UUID and cryptographic extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. Applications Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS apps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    repository_id VARCHAR(255) NOT NULL,
    version VARCHAR(64) NOT NULL DEFAULT '1.0.0',
    android_build_number INTEGER NOT NULL DEFAULT 1,
    ios_build_number INTEGER NOT NULL DEFAULT 1,
    android_package VARCHAR(255),
    ios_bundle_id VARCHAR(255),
    google_play_connection VARCHAR(64) NOT NULL DEFAULT 'not-connected',
    app_store_connection VARCHAR(64) NOT NULL DEFAULT 'not-connected',
    analysis JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_apps_repository ON apps(repository_id);
CREATE INDEX IF NOT EXISTS idx_apps_bundle_id ON apps(ios_bundle_id, android_package);

-- ------------------------------------------------------------------------------
-- 2. Build Jobs & Artifacts Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS builds (
    id VARCHAR(64) PRIMARY KEY,
    app_id UUID NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    platform VARCHAR(32) NOT NULL CHECK (platform IN ('android', 'ios')),
    status VARCHAR(32) NOT NULL CHECK (status IN ('queued', 'running', 'success', 'failed', 'cancelled', 'blocked')),
    version VARCHAR(64) NOT NULL,
    build_number INTEGER NOT NULL,
    commit_sha VARCHAR(64),
    commit_message TEXT,
    commit_author VARCHAR(255),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,
    build_mode VARCHAR(64),
    artifact_path TEXT,
    artifact_name VARCHAR(255),
    artifact_size BIGINT,
    is_demo_artifact BOOLEAN NOT NULL DEFAULT FALSE,
    google_play_publish_status VARCHAR(64) DEFAULT 'not-published',
    google_play_published_track VARCHAR(64),
    google_play_published_at TIMESTAMPTZ,
    logs JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_builds_app_id ON builds(app_id);
CREATE INDEX IF NOT EXISTS idx_builds_started_at ON builds(started_at DESC);

-- ------------------------------------------------------------------------------
-- 3. Releases & Pipeline Orchestrator Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS releases (
    id VARCHAR(64) PRIMARY KEY,
    app_id UUID NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    app_name VARCHAR(255) NOT NULL,
    repository_id VARCHAR(255) NOT NULL,
    branch VARCHAR(128) NOT NULL DEFAULT 'main',
    commit_sha VARCHAR(64),
    commit_message TEXT,
    commit_author VARCHAR(255),
    commit_date TIMESTAMPTZ,
    platform VARCHAR(32) NOT NULL CHECK (platform IN ('android', 'ios')),
    track VARCHAR(64) NOT NULL,
    version VARCHAR(64) NOT NULL,
    build_number INTEGER NOT NULL,
    state VARCHAR(64) NOT NULL,
    current_stage_id VARCHAR(64) NOT NULL,
    stages JSONB NOT NULL DEFAULT '[]'::jsonb,
    build_id VARCHAR(64),
    artifact_id VARCHAR(64),
    artifact_path TEXT,
    artifact_name VARCHAR(255),
    artifact_size BIGINT,
    artifact_checksum VARCHAR(128),
    android_package VARCHAR(255),
    ios_bundle_id VARCHAR(255),
    is_simulated BOOLEAN NOT NULL DEFAULT FALSE,
    change_summary JSONB,
    compliance_status VARCHAR(64) DEFAULT 'not-checked',
    testing_status VARCHAR(64) DEFAULT 'pending',
    approval_status VARCHAR(64) DEFAULT 'pending',
    store_processing_status VARCHAR(64) DEFAULT 'not-uploaded',
    store_links JSONB,
    error_summary TEXT,
    audit_logs JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_releases_app_id ON releases(app_id);
CREATE INDEX IF NOT EXISTS idx_releases_state ON releases(state);
CREATE INDEX IF NOT EXISTS idx_releases_track ON releases(track);
CREATE INDEX IF NOT EXISTS idx_releases_created_at ON releases(created_at DESC);

-- ------------------------------------------------------------------------------
-- 4. Store Listings & Metadata Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS store_listings (
    app_id UUID PRIMARY KEY REFERENCES apps(id) ON DELETE CASCADE,
    google_play JSONB NOT NULL,
    apple JSONB NOT NULL,
    assets JSONB NOT NULL DEFAULT '[]'::jsonb,
    status VARCHAR(32) NOT NULL DEFAULT 'draft',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 5. Testing & Distribution Quorum Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS testing_data (
    app_id UUID PRIMARY KEY REFERENCES apps(id) ON DELETE CASCADE,
    groups JSONB NOT NULL DEFAULT '[]'::jsonb,
    closed_testing_start_date TIMESTAMPTZ,
    store_links JSONB,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 6. Team Members & RBAC Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS team_members (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(64) NOT NULL CHECK (role IN ('owner', 'admin', 'developer', 'qa', 'release_manager', 'viewer')),
    avatar_url TEXT,
    added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status VARCHAR(32) NOT NULL DEFAULT 'active'
);

CREATE INDEX IF NOT EXISTS idx_team_email ON team_members(email);

-- ------------------------------------------------------------------------------
-- 7. Automations & Triggers Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS automations (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    app_id UUID REFERENCES apps(id) ON DELETE CASCADE,
    trigger JSONB NOT NULL,
    actions JSONB NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    last_run_at TIMESTAMPTZ,
    last_status VARCHAR(32),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automations_enabled ON automations(enabled);

-- ------------------------------------------------------------------------------
-- 8. Notifications Center Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(64) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(32) NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error')),
    app_id UUID REFERENCES apps(id) ON DELETE CASCADE,
    release_id VARCHAR(64),
    read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read, created_at DESC);

-- ------------------------------------------------------------------------------
-- Row Level Security (RLS) Enablement
-- ------------------------------------------------------------------------------
ALTER TABLE apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE builds ENABLE ROW LEVEL SECURITY;
ALTER TABLE releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE testing_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Default Permissive Service-Role Policies (for server-side execution)
CREATE POLICY "Service Role Full Access on Apps" ON apps FOR ALL TO service_role USING (true);
CREATE POLICY "Service Role Full Access on Builds" ON builds FOR ALL TO service_role USING (true);
CREATE POLICY "Service Role Full Access on Releases" ON releases FOR ALL TO service_role USING (true);
CREATE POLICY "Service Role Full Access on Store Listings" ON store_listings FOR ALL TO service_role USING (true);
CREATE POLICY "Service Role Full Access on Testing Data" ON testing_data FOR ALL TO service_role USING (true);
CREATE POLICY "Service Role Full Access on Team Members" ON team_members FOR ALL TO service_role USING (true);
CREATE POLICY "Service Role Full Access on Automations" ON automations FOR ALL TO service_role USING (true);
CREATE POLICY "Service Role Full Access on Notifications" ON notifications FOR ALL TO service_role USING (true);
