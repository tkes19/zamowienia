-- Fix RLS policies to use correct role checking from public."User" table
-- Also updates role name check from 'GRAPHIC_DESIGNER' to 'GRAPHICS'

DO $$
BEGIN
    -- Drop old policies if they exist (to be safe)
    DROP POLICY IF EXISTS "Graphic designers view all tasks" ON public."GraphicTask";
    DROP POLICY IF EXISTS "Graphic designers edit own tasks" ON public."GraphicTask";
    DROP POLICY IF EXISTS "Graphic designers create tasks" ON public."GraphicTask";
    DROP POLICY IF EXISTS "Sales view own order tasks" ON public."GraphicTask";
    DROP POLICY IF EXISTS "Production managers view all tasks" ON public."GraphicTask";
    DROP POLICY IF EXISTS "Admins full access" ON public."GraphicTask";
    
    -- Create new policies with correct logic
    -- Instead of auth.jwt() ->> 'role', we check public."User".role

    -- 1. Graphic designers (GRAPHICS)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Graphic designers view all tasks') THEN
        CREATE POLICY "Graphic designers view all tasks" 
            ON public."GraphicTask" FOR SELECT 
            USING (
                EXISTS (SELECT 1 FROM public."User" WHERE id = auth.uid() AND role = 'GRAPHICS')
            );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Graphic designers edit own tasks') THEN
        CREATE POLICY "Graphic designers edit own tasks" 
            ON public."GraphicTask" FOR UPDATE 
            USING (
                EXISTS (SELECT 1 FROM public."User" WHERE id = auth.uid() AND role = 'GRAPHICS') 
                AND "assignedTo" = auth.uid()::text
            );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Graphic designers create tasks') THEN
        CREATE POLICY "Graphic designers create tasks" 
            ON public."GraphicTask" FOR INSERT 
            WITH CHECK (
                EXISTS (SELECT 1 FROM public."User" WHERE id = auth.uid() AND role = 'GRAPHICS')
            );
    END IF;

    -- 2. Sales department (SALES_REP, SALES_DEPT)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Sales view own order tasks') THEN
        CREATE POLICY "Sales view own order tasks" 
            ON public."GraphicTask" FOR SELECT 
            USING (
                EXISTS (SELECT 1 FROM public."User" WHERE id = auth.uid() AND role IN ('SALES_REP', 'SALES_DEPT'))
            );
    END IF;

    -- 3. Production managers (PRODUCTION_MANAGER)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Production managers view all tasks') THEN
        CREATE POLICY "Production managers view all tasks" 
            ON public."GraphicTask" FOR SELECT 
            USING (
                EXISTS (SELECT 1 FROM public."User" WHERE id = auth.uid() AND role = 'PRODUCTION_MANAGER')
            );
    END IF;

    -- 4. Admins (ADMIN)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins full access') THEN
        CREATE POLICY "Admins full access" 
            ON public."GraphicTask" FOR ALL 
            USING (
                EXISTS (SELECT 1 FROM public."User" WHERE id = auth.uid() AND role = 'ADMIN')
            );
    END IF;

END $$;
