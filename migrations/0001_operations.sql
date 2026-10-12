PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS trips (
 id TEXT PRIMARY KEY, org TEXT NOT NULL, label TEXT NOT NULL, traveler TEXT NOT NULL DEFAULT '', plan TEXT NOT NULL,
 owner TEXT NOT NULL DEFAULT '', workflow TEXT NOT NULL DEFAULT 'unreviewed', decision TEXT NOT NULL DEFAULT '',
 monitoring INTEGER NOT NULL DEFAULT 0, archived INTEGER NOT NULL DEFAULT 0, created TEXT NOT NULL,
 updated TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, latest_id TEXT, next_check INTEGER NOT NULL DEFAULT 0,
 checking_until INTEGER NOT NULL DEFAULT 0, check_token TEXT, check_error TEXT
);
CREATE INDEX IF NOT EXISTS trips_due ON trips(org,monitoring,archived,next_check);
CREATE TABLE IF NOT EXISTS assessments (
 id TEXT PRIMARY KEY, org TEXT NOT NULL, trip_id TEXT NOT NULL REFERENCES trips(id), checked TEXT NOT NULL,
 level INTEGER NOT NULL, missing INTEGER NOT NULL, verdict TEXT NOT NULL, payload TEXT NOT NULL, summary TEXT NOT NULL DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS assessments_trip ON assessments(org,trip_id,checked DESC);
CREATE TABLE IF NOT EXISTS actions (
 id TEXT PRIMARY KEY, org TEXT NOT NULL, trip_id TEXT NOT NULL REFERENCES trips(id), actor TEXT NOT NULL,
 kind TEXT NOT NULL, detail TEXT NOT NULL, created TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS actions_trip ON actions(org,trip_id,created DESC);
CREATE TRIGGER IF NOT EXISTS actions_no_update BEFORE UPDATE ON actions BEGIN SELECT RAISE(ABORT,'Audit records are append-only'); END;
CREATE TRIGGER IF NOT EXISTS actions_no_delete BEFORE DELETE ON actions BEGIN SELECT RAISE(ABORT,'Audit records are append-only'); END;
CREATE TABLE IF NOT EXISTS subscriptions (
 org TEXT NOT NULL, trip_id TEXT NOT NULL REFERENCES trips(id), email TEXT NOT NULL, created TEXT NOT NULL,
 PRIMARY KEY(org,trip_id,email)
);
CREATE TABLE IF NOT EXISTS alerts (
 id TEXT PRIMARY KEY, org TEXT NOT NULL, trip_id TEXT NOT NULL REFERENCES trips(id), assessment_id TEXT NOT NULL,
 reason TEXT NOT NULL, created TEXT NOT NULL, acknowledged INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS deliveries (
 id TEXT PRIMARY KEY, org TEXT NOT NULL, alert_id TEXT NOT NULL REFERENCES alerts(id), email TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0, next_try INTEGER NOT NULL DEFAULT 0,
 provider_id TEXT, error TEXT, lease_until INTEGER NOT NULL DEFAULT 0, UNIQUE(alert_id,email)
);
