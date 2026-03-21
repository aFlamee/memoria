// ============================================================
// Memoria – Neo4j Initialisation Script
// Run once against a fresh database:
//   cypher-shell -u neo4j -p <password> < scripts/init_db.cypher
// ============================================================

// --- Uniqueness Constraints ---
CREATE CONSTRAINT user_id     IF NOT EXISTS FOR (u:User)         REQUIRE u.user_id     IS UNIQUE;
CREATE CONSTRAINT instance_id IF NOT EXISTS FOR (i:Instance)     REQUIRE i.instance_id IS UNIQUE;
CREATE CONSTRAINT session_id  IF NOT EXISTS FOR (s:Session)      REQUIRE s.session_id  IS UNIQUE;
CREATE CONSTRAINT task_id     IF NOT EXISTS FOR (t:Task)         REQUIRE t.task_id     IS UNIQUE;
CREATE CONSTRAINT action_id   IF NOT EXISTS FOR (a:Action)       REQUIRE a.action_id   IS UNIQUE;
CREATE CONSTRAINT template_id IF NOT EXISTS FOR (tmpl:TaskTemplate) REQUIRE tmpl.template_id IS UNIQUE;
CREATE CONSTRAINT step_fp     IF NOT EXISTS FOR (sn:StepNode)    REQUIRE (sn.fingerprint, sn.template_id) IS UNIQUE;

// --- Indexes ---
CREATE INDEX action_permission IF NOT EXISTS FOR (a:Action) ON (a.permission_level);
CREATE INDEX action_is_flagged IF NOT EXISTS FOR (a:Action) ON (a.is_flagged);
CREATE INDEX action_status     IF NOT EXISTS FOR (a:Action) ON (a.status);
CREATE INDEX task_status       IF NOT EXISTS FOR (t:Task)   ON (t.status);
CREATE INDEX task_type         IF NOT EXISTS FOR (t:Task)   ON (t.type);
CREATE INDEX session_status    IF NOT EXISTS FOR (s:Session) ON (s.status);
CREATE INDEX instance_status   IF NOT EXISTS FOR (i:Instance) ON (i.status);

// --- Root User Node ---
MERGE (u:User {user_id: "meet"})
SET u.name       = "Meet Kachhadiya",
    u.created_at = datetime();
