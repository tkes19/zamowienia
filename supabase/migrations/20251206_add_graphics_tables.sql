-- Migration for Graphics Module
-- Creates tables for graphic tasks and extends Order table

-- Extend Order table with graphics-related fields
ALTER TABLE public."Order" 
ADD COLUMN IF NOT EXISTS orderType varchar(30) NOT NULL DEFAULT 'PRODUCTS_AND_PROJECTS',
ADD COLUMN IF NOT EXISTS projectApprovalRequired boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS projectsReady boolean NOT NULL DEFAULT false;

-- Add constraint for orderType values
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_type_check') THEN
        ALTER TABLE public."Order" 
        ADD CONSTRAINT order_type_check 
        CHECK (orderType IN ('PRODUCTS_ONLY', 'PRODUCTS_AND_PROJECTS', 'PROJECTS_ONLY'));
    END IF;
END $$;

-- Extend OrderItem with design requirement flags
ALTER TABLE public."OrderItem" 
ADD COLUMN IF NOT EXISTS requiresDesign boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS hasExistingProject boolean NOT NULL DEFAULT false;

-- Create GraphicTask table
CREATE TABLE IF NOT EXISTS public."GraphicTask" (
  id serial PRIMARY KEY,

  "orderId" text NOT NULL REFERENCES "Order"(id) ON DELETE CASCADE,
  "orderItemId" text REFERENCES "OrderItem"(id) ON DELETE SET NULL,

  status varchar(30) NOT NULL DEFAULT 'todo',
  -- todo, in_progress, waiting_approval, ready_for_production, rejected, archived

  priority integer NOT NULL DEFAULT 3,
  -- 1-urgent, 2-high, 3-normal, 4-low

  "dueDate" timestamp,
  -- np. data wysyłki z zamówienia - bufor na produkcję

  "assignedTo" text REFERENCES "User"(id) ON DELETE SET NULL,
  -- przypisany grafik

  "galleryContext" jsonb,
  -- np. {"mode": "PM", "city": "Zakopane", "kiFolder": "KI_Jan_Kowalski",
  --       "qnapObjectIds": [123, 456]}

  "filesLocation" text,
  -- Lokalizacja plików na QNAP / w galerii

  "projectNumbers" jsonb,
  -- np. {"front": "PM-ZAK-00123", "back": "PM-ZAK-00123-B", "variant": "A"}

  "checklist" jsonb,
  -- {"dataVerified": true, "quantitiesVerified": true,
  --  "layersOk": true, "namingOk": true}

  "approvalRequired" boolean NOT NULL DEFAULT false,
  -- czy dla tego zadania wymagana jest akceptacja projektu

  "approvalStatus" varchar(30) DEFAULT 'not_required',
  -- not_required, pending, approved, rejected

  "createdBy" text REFERENCES "User"(id) ON DELETE SET NULL,
  "createdAt" timestamp DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP
);

-- Add constraint for GraphicTask.status
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'graphic_task_status_check') THEN
        ALTER TABLE public."GraphicTask" 
        ADD CONSTRAINT graphic_task_status_check 
        CHECK (status IN ('todo', 'in_progress', 'waiting_approval', 'ready_for_production', 'rejected', 'archived'));
    END IF;
END $$;

-- Add constraint for GraphicTask.approvalStatus
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'graphic_task_approval_status_check') THEN
        ALTER TABLE public."GraphicTask" 
        ADD CONSTRAINT graphic_task_approval_status_check 
        CHECK ("approvalStatus" IN ('not_required', 'pending', 'approved', 'rejected'));
    END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_graphic_task_order_id ON public."GraphicTask"("orderId");
CREATE INDEX IF NOT EXISTS idx_graphic_task_order_item_id ON public."GraphicTask"("orderItemId");
CREATE INDEX IF NOT EXISTS idx_graphic_task_status ON public."GraphicTask"(status);
CREATE INDEX IF NOT EXISTS idx_graphic_task_assigned_to ON public."GraphicTask"("assignedTo");
CREATE INDEX IF NOT EXISTS idx_graphic_task_priority ON public."GraphicTask"(priority);
CREATE INDEX IF NOT EXISTS idx_graphic_task_due_date ON public."GraphicTask"("dueDate");

-- Create trigger to update updatedAt timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_graphic_task_updated_at') THEN
        CREATE TRIGGER update_graphic_task_updated_at 
            BEFORE UPDATE ON public."GraphicTask" 
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- Enable RLS (Row Level Security) for GraphicTask
ALTER TABLE public."GraphicTask" ENABLE ROW LEVEL SECURITY;

-- RLS Policies for GraphicTask
-- Graphic designers can see all tasks and edit their own assigned tasks
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Graphic designers view all tasks') THEN
        CREATE POLICY "Graphic designers view all tasks" 
            ON public."GraphicTask" FOR SELECT 
            USING (auth.jwt() ->> 'role' = 'GRAPHIC_DESIGNER');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Graphic designers edit own tasks') THEN
        CREATE POLICY "Graphic designers edit own tasks" 
            ON public."GraphicTask" FOR UPDATE 
            USING (auth.jwt() ->> 'role' = 'GRAPHIC_DESIGNER' AND "assignedTo" = auth.uid()::text);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Graphic designers create tasks') THEN
        CREATE POLICY "Graphic designers create tasks" 
            ON public."GraphicTask" FOR INSERT 
            WITH CHECK (auth.jwt() ->> 'role' = 'GRAPHIC_DESIGNER');
    END IF;
END $$;

-- Sales department can view tasks from their orders and approve/reject projects
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Sales view own order tasks') THEN
        CREATE POLICY "Sales view own order tasks" 
            ON public."GraphicTask" FOR SELECT 
            USING (auth.jwt() ->> 'role' IN ('SALES_REP', 'SALES_DEPT'));
    END IF;
END $$;

-- Production managers can view all tasks (read-only for supervision)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Production managers view all tasks') THEN
        CREATE POLICY "Production managers view all tasks" 
            ON public."GraphicTask" FOR SELECT 
            USING (auth.jwt() ->> 'role' = 'PRODUCTION_MANAGER');
    END IF;
END $$;

-- Admins have full access
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins full access') THEN
        CREATE POLICY "Admins full access" 
            ON public."GraphicTask" FOR ALL 
            USING (auth.jwt() ->> 'role' = 'ADMIN');
    END IF;
END $$;

-- Add comments for documentation
COMMENT ON TABLE public."GraphicTask" IS 'Zadania graficzne powiązane z zamówieniami i pozycjami zamówień';
COMMENT ON COLUMN public."GraphicTask".status IS 'Status zadania: todo, in_progress, waiting_approval, ready_for_production, rejected, archived';
COMMENT ON COLUMN public."GraphicTask".priority IS 'Priorytet: 1-urgent, 2-high, 3-normal, 4-low';
COMMENT ON COLUMN public."GraphicTask"."galleryContext" IS 'Kontekst galerii: tryb, miasto, folder KI, ID obiektów';
COMMENT ON COLUMN public."GraphicTask"."filesLocation" IS 'Ścieżka do plików na QNAP lub w galerii';
COMMENT ON COLUMN public."GraphicTask"."projectNumbers" IS 'Numery projektów dla różnych stron/wariantów';
COMMENT ON COLUMN public."GraphicTask"."checklist" IS 'Checklista weryfikacji projektu';
COMMENT ON COLUMN public."Order".orderType IS 'Typ zamówienia: PRODUCTS_ONLY, PRODUCTS_AND_PROJECTS, PROJECTS_ONLY';
COMMENT ON COLUMN public."Order".projectApprovalRequired IS 'Czy wymagana jest akceptacja projektów przed produkcją';
COMMENT ON COLUMN public."Order".projectsReady IS 'Czy wszystkie zadania graficzne są gotowe do produkcji';
COMMENT ON COLUMN public."OrderItem".requiresDesign IS 'Czy pozycja wymaga pracy grafika';
COMMENT ON COLUMN public."OrderItem".hasExistingProject IS 'Czy pozycja ma już gotowy projekt';
