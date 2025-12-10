-- Add restrictToAssignedProducts flag to WorkStation
ALTER TABLE "WorkStation"
ADD COLUMN "restrictToAssignedProducts" boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN "WorkStation"."restrictToAssignedProducts" IS 'If true, this machine only accepts products explicitly assigned via MachineProductAssignment';
