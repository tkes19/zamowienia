-- Migracja: ujednolicenie roli grafika z GRAPHICS -> GRAPHIC_DESIGNER
-- Data: 2025-12-10
-- Autor: Cascade
--
-- Zakres:
-- 1) Aktualizacja danych w tabelach User i UserRoleAssignment
-- 2) Aktualizacja polityk RLS dla GraphicTask, Order, OrderItem, Customer

DO $$
BEGIN
    -------------------------------------------------------------------
    -- 1. Aktualizacja danych użytkowników i przypisań ról
    -------------------------------------------------------------------

    -- Główna rola użytkownika
    UPDATE public."User"
    SET role = 'GRAPHIC_DESIGNER'
    WHERE role = 'GRAPHICS';

    -- Dodatkowe role (UserRoleAssignment)
    UPDATE public."UserRoleAssignment"
    SET role = 'GRAPHIC_DESIGNER'
    WHERE role = 'GRAPHICS';

    -------------------------------------------------------------------
    -- 2. Polityki RLS dla zadań graficznych (GraphicTask)
    -------------------------------------------------------------------

    -- Usuwamy stare polityki oparte o rolę GRAPHICS
    DROP POLICY IF EXISTS "Graphic designers view all tasks" ON public."GraphicTask";
    DROP POLICY IF EXISTS "Graphic designers edit own tasks" ON public."GraphicTask";
    DROP POLICY IF EXISTS "Graphic designers create tasks" ON public."GraphicTask";

    -- Tworzymy nowe polityki dla GRAPHIC_DESIGNER

    -- Podgląd wszystkich zadań graficznych
    CREATE POLICY "Graphic designers view all tasks" 
        ON public."GraphicTask" FOR SELECT 
        USING (
            EXISTS (
                SELECT 1 FROM public."User" 
                WHERE id = auth.uid()::text
                  AND role = 'GRAPHIC_DESIGNER'
            )
        );

    -- Edycja tylko własnych zadań
    CREATE POLICY "Graphic designers edit own tasks" 
        ON public."GraphicTask" FOR UPDATE 
        USING (
            EXISTS (
                SELECT 1 FROM public."User" 
                WHERE id = auth.uid()::text
                  AND role = 'GRAPHIC_DESIGNER'
            )
            AND "assignedTo" = auth.uid()::text
        );

    -- Tworzenie zadań graficznych
    CREATE POLICY "Graphic designers create tasks" 
        ON public."GraphicTask" FOR INSERT 
        WITH CHECK (
            EXISTS (
                SELECT 1 FROM public."User" 
                WHERE id = auth.uid()::text
                  AND role = 'GRAPHIC_DESIGNER'
            )
        );

    -------------------------------------------------------------------
    -- 3. Polityki RLS dla podglądu zamówień przez grafików
    --    (Order, OrderItem, Customer)
    -------------------------------------------------------------------

    -- Usuwamy stare polityki oparte o GRAPHICS
    DROP POLICY IF EXISTS "Graphics view all orders" ON public."Order";
    DROP POLICY IF EXISTS "Graphics view all order items" ON public."OrderItem";
    DROP POLICY IF EXISTS "Graphics view all customers" ON public."Customer";

    -- Tworzymy nowe polityki korzystające z GRAPHIC_DESIGNER

    CREATE POLICY "Graphics view all orders" 
        ON public."Order" FOR SELECT 
        USING (
            EXISTS (
                SELECT 1 FROM public."User" 
                WHERE id = auth.uid()::text 
                  AND role = 'GRAPHIC_DESIGNER'
            )
        );

    CREATE POLICY "Graphics view all order items" 
        ON public."OrderItem" FOR SELECT 
        USING (
            EXISTS (
                SELECT 1 FROM public."User" 
                WHERE id = auth.uid()::text 
                  AND role = 'GRAPHIC_DESIGNER'
            )
        );

    CREATE POLICY "Graphics view all customers" 
        ON public."Customer" FOR SELECT 
        USING (
            EXISTS (
                SELECT 1 FROM public."User" 
                WHERE id = auth.uid()::text 
                  AND role = 'GRAPHIC_DESIGNER'
            )
        );

END $$;
