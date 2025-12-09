-- Add deletedAt column to Department table for soft delete functionality
ALTER TABLE "Department" 
ADD COLUMN "deletedAt" timestamptz;

-- Add comment for documentation
COMMENT ON COLUMN "Department"."deletedAt" IS 'Timestamp when department was soft deleted (null if active)';

-- Add index for better performance on deletedAt queries
CREATE INDEX "idx_Department_deletedAt" ON "Department"("deletedAt");
