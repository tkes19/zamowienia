-- Add projectViewUrl to OrderItem to store the gallery view URL the salesperson was browsing
-- This allows all departments (sales, production, graphics) to quickly preview the projects context

ALTER TABLE public."OrderItem"
ADD COLUMN IF NOT EXISTS projectViewUrl text;

COMMENT ON COLUMN public."OrderItem".projectViewUrl IS 'URL to the gallery view the salesperson was browsing when adding this item (e.g., gallery.html?city=Kołobrzeg&object=HotelX)';
