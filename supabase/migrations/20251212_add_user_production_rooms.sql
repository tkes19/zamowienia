-- Multiroom assignments for production operators
-- Creates junction table between User and ProductionRoom with primary-room sync

CREATE TABLE IF NOT EXISTS "UserProductionRoom" (
    id SERIAL PRIMARY KEY,
    "userId" text NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
    "roomId" integer NOT NULL REFERENCES "ProductionRoom"(id) ON DELETE CASCADE,
    "isPrimary" boolean NOT NULL DEFAULT false,
    notes text,
    "assignedBy" text REFERENCES "User"(id) ON DELETE SET NULL,
    "createdAt" timestamptz NOT NULL DEFAULT now(),
    UNIQUE ("userId", "roomId")
);

COMMENT ON TABLE "UserProductionRoom" IS 'Assignments of users to production rooms (multiroom support).';
COMMENT ON COLUMN "UserProductionRoom"."isPrimary" IS 'Marks the default room for kiosks and dashboards.';

CREATE INDEX IF NOT EXISTS idx_user_production_room_user ON "UserProductionRoom"("userId");
CREATE INDEX IF NOT EXISTS idx_user_production_room_room ON "UserProductionRoom"("roomId");
CREATE INDEX IF NOT EXISTS idx_user_production_room_primary ON "UserProductionRoom"("userId") WHERE "isPrimary" = true;

-- Ensure only one primary room per user
CREATE UNIQUE INDEX IF NOT EXISTS uniq_user_primary_room
    ON "UserProductionRoom"("userId")
    WHERE "isPrimary" = true;

-- Migrate existing single-room assignments
INSERT INTO "UserProductionRoom" ("userId", "roomId", "isPrimary", "createdAt")
SELECT id, "productionroomid", true, COALESCE("createdAt", now())
FROM "User"
WHERE "productionroomid" IS NOT NULL
ON CONFLICT ("userId", "roomId") DO NOTHING;

-- Helper function to keep User.productionroomid in sync with primary assignment
CREATE OR REPLACE FUNCTION sync_user_primary_room()
RETURNS trigger AS $$
DECLARE
    primary_room integer;
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW."isPrimary" THEN
            UPDATE "User" SET "productionroomid" = NEW."roomId" WHERE id = NEW."userId";
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        IF NEW."isPrimary" AND (OLD."isPrimary" IS DISTINCT FROM NEW."isPrimary" OR OLD."roomId" IS DISTINCT FROM NEW."roomId") THEN
            UPDATE "User" SET "productionroomid" = NEW."roomId" WHERE id = NEW."userId";
        ELSIF OLD."isPrimary" AND NOT NEW."isPrimary" THEN
            SELECT "roomId" INTO primary_room FROM "UserProductionRoom"
            WHERE "userId" = NEW."userId" AND "isPrimary" = true AND id <> NEW.id
            ORDER BY id DESC
            LIMIT 1;

            UPDATE "User"
            SET "productionroomid" = primary_room
            WHERE id = NEW."userId";
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        IF OLD."isPrimary" THEN
            SELECT "roomId" INTO primary_room FROM "UserProductionRoom"
            WHERE "userId" = OLD."userId" AND "isPrimary" = true
            ORDER BY id DESC
            LIMIT 1;

            UPDATE "User"
            SET "productionroomid" = primary_room
            WHERE id = OLD."userId";
        END IF;
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_user_production_room_sync_ins
AFTER INSERT ON "UserProductionRoom"
FOR EACH ROW EXECUTE FUNCTION sync_user_primary_room();

CREATE TRIGGER trg_user_production_room_sync_upd
AFTER UPDATE ON "UserProductionRoom"
FOR EACH ROW EXECUTE FUNCTION sync_user_primary_room();

CREATE TRIGGER trg_user_production_room_sync_del
AFTER DELETE ON "UserProductionRoom"
FOR EACH ROW EXECUTE FUNCTION sync_user_primary_room();

-- Optional: default primary assignment if user has no primary
CREATE OR REPLACE FUNCTION ensure_primary_room()
RETURNS trigger AS $$
DECLARE
    has_primary boolean;
BEGIN
    IF NEW."isPrimary" THEN
        RETURN NEW;
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM "UserProductionRoom"
        WHERE "userId" = NEW."userId" AND "isPrimary" = true
    ) INTO has_primary;

    IF NOT has_primary THEN
        NEW."isPrimary" = true;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_user_production_room_default_primary
BEFORE INSERT ON "UserProductionRoom"
FOR EACH ROW EXECUTE FUNCTION ensure_primary_room();
