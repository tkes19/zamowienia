-- Add room manager to ProductionRoom
ALTER TABLE "ProductionRoom" 
ADD COLUMN "roomManagerUserId" text REFERENCES "User"(id);

-- Add comment for documentation
COMMENT ON COLUMN "ProductionRoom"."roomManagerUserId" IS 'User who manages product-to-machine assignments in this room';

-- Create MachineProductAssignment junction table
CREATE TABLE "MachineProductAssignment" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workStationId integer NOT NULL REFERENCES "WorkStation"(id) ON DELETE CASCADE,
    productId text NOT NULL REFERENCES "Product"(id) ON DELETE CASCADE,
    assignedBy text NOT NULL REFERENCES "User"(id),
    assignedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notes TEXT,
    UNIQUE(workStationId, productId)
);

-- Add comments for documentation
COMMENT ON TABLE "MachineProductAssignment" IS 'Assigns specific products to work stations/machines for production planning';
COMMENT ON COLUMN "MachineProductAssignment".workStationId IS 'The work station/machine assigned to produce this product';
COMMENT ON COLUMN "MachineProductAssignment".productId IS 'The product assigned to this machine';
COMMENT ON COLUMN "MachineProductAssignment".assignedBy IS 'User who made this assignment (room manager or admin)';
COMMENT ON COLUMN "MachineProductAssignment".assignedAt IS 'When this assignment was made';
COMMENT ON COLUMN "MachineProductAssignment".notes IS 'Optional notes about the assignment';

-- Create indexes for performance
CREATE INDEX idx_machine_product_assignment_station ON "MachineProductAssignment"(workStationId);
CREATE INDEX idx_machine_product_assignment_product ON "MachineProductAssignment"(productId);
CREATE INDEX idx_machine_product_assignment_assigned_by ON "MachineProductAssignment"(assignedBy);

-- Enable RLS
ALTER TABLE "MachineProductAssignment" ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Room managers and admins can view assignments" ON "MachineProductAssignment"
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM "ProductionRoom" pr
            JOIN "WorkCenter" wc ON pr.id = wc."roomId"
            JOIN "WorkStation" ws ON wc.id = ws."workCenterId"
            WHERE ws.id = "MachineProductAssignment".workStationId
            AND pr."roomManagerUserId" = auth.uid()::text
        )
        OR auth.jwt()->>'role' IN ('ADMIN')
    );

CREATE POLICY "Room managers and admins can insert assignments" ON "MachineProductAssignment"
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM "ProductionRoom" pr
            JOIN "WorkCenter" wc ON pr.id = wc."roomId"
            JOIN "WorkStation" ws ON wc.id = ws."workCenterId"
            WHERE ws.id = workStationId
            AND pr."roomManagerUserId" = auth.uid()::text
        )
        OR auth.jwt()->>'role' IN ('ADMIN')
    );

CREATE POLICY "Room managers and admins can update assignments" ON "MachineProductAssignment"
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM "ProductionRoom" pr
            JOIN "WorkCenter" wc ON pr.id = wc."roomId"
            JOIN "WorkStation" ws ON wc.id = ws."workCenterId"
            WHERE ws.id = "MachineProductAssignment".workStationId
            AND pr."roomManagerUserId" = auth.uid()::text
        )
        OR auth.jwt()->>'role' IN ('ADMIN')
    );

CREATE POLICY "Room managers and admins can delete assignments" ON "MachineProductAssignment"
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM "ProductionRoom" pr
            JOIN "WorkCenter" wc ON pr.id = wc."roomId"
            JOIN "WorkStation" ws ON wc.id = ws."workCenterId"
            WHERE ws.id = "MachineProductAssignment".workStationId
            AND pr."roomManagerUserId" = auth.uid()::text
        )
        OR auth.jwt()->>'role' IN ('ADMIN')
    );
