-- Grant read access to necessary tables for GRAPHICS role to avoid 500 errors

DO $$
BEGIN
    -- 1. Order table
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Graphics view all orders') THEN
        CREATE POLICY "Graphics view all orders" 
            ON public."Order" FOR SELECT 
            USING (EXISTS (SELECT 1 FROM public."User" WHERE id = auth.uid()::text AND role = 'GRAPHICS'));
    END IF;

    -- 2. OrderItem table
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Graphics view all order items') THEN
        CREATE POLICY "Graphics view all order items" 
            ON public."OrderItem" FOR SELECT 
            USING (EXISTS (SELECT 1 FROM public."User" WHERE id = auth.uid()::text AND role = 'GRAPHICS'));
    END IF;

    -- 3. Customer table
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Graphics view all customers') THEN
        CREATE POLICY "Graphics view all customers" 
            ON public."Customer" FOR SELECT 
            USING (EXISTS (SELECT 1 FROM public."User" WHERE id = auth.uid()::text AND role = 'GRAPHICS'));
    END IF;
END $$;
