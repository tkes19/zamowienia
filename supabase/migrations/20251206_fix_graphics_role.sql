-- Fix RLS policies to use correct role name 'GRAPHICS' instead of 'GRAPHIC_DESIGNER'

DO $$
BEGIN
    -- Drop old policies using GRAPHIC_DESIGNER
    DROP POLICY IF EXISTS "Graphic designers view all tasks" ON public."GraphicTask";
    DROP POLICY IF EXISTS "Graphic designers edit own tasks" ON public."GraphicTask";
    DROP POLICY IF EXISTS "Graphic designers create tasks" ON public."GraphicTask";
    
    -- Create new policies using GRAPHICS
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Graphic designers view all tasks') THEN
        CREATE POLICY "Graphic designers view all tasks" 
            ON public."GraphicTask" FOR SELECT 
            USING (auth.jwt() ->> 'role' = 'GRAPHICS');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Graphic designers edit own tasks') THEN
        CREATE POLICY "Graphic designers edit own tasks" 
            ON public."GraphicTask" FOR UPDATE 
            USING (auth.jwt() ->> 'role' = 'GRAPHICS' AND "assignedTo" = auth.uid()::text);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Graphic designers create tasks') THEN
        CREATE POLICY "Graphic designers create tasks" 
            ON public."GraphicTask" FOR INSERT 
            WITH CHECK (auth.jwt() ->> 'role' = 'GRAPHICS');
    END IF;

END $$;
