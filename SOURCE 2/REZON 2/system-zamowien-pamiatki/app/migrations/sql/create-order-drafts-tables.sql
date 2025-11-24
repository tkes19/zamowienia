
-- Create order_drafts table
CREATE TABLE IF NOT EXISTS order_drafts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_type TEXT NOT NULL,
  client_id TEXT,
  location_name TEXT,
  custom_client_data JSONB,
  total_value DECIMAL(10, 2) DEFAULT 0 NOT NULL,
  status TEXT DEFAULT 'draft' NOT NULL,
  session_id TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create indexes for order_drafts
CREATE INDEX IF NOT EXISTS order_drafts_user_id_idx ON order_drafts (user_id);
CREATE INDEX IF NOT EXISTS order_drafts_status_idx ON order_drafts (status);
CREATE INDEX IF NOT EXISTS order_drafts_user_status_idx ON order_drafts (user_id, status);
CREATE INDEX IF NOT EXISTS order_drafts_session_id_idx ON order_drafts (session_id);

-- Create order_draft_items table  
CREATE TABLE IF NOT EXISTS order_draft_items (
  id TEXT PRIMARY KEY,
  draft_id TEXT NOT NULL REFERENCES order_drafts(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  total_price DECIMAL(10, 2) NOT NULL,
  customization TEXT,
  projects TEXT[],
  projects_details JSONB,
  source TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create indexes for order_draft_items
CREATE INDEX IF NOT EXISTS order_draft_items_draft_id_idx ON order_draft_items (draft_id);
CREATE INDEX IF NOT EXISTS order_draft_items_product_id_idx ON order_draft_items (product_id);
CREATE INDEX IF NOT EXISTS order_draft_items_sort_order_idx ON order_draft_items (draft_id, sort_order);

-- Add User relation for order_drafts if not already exists
ALTER TABLE users ADD COLUMN IF NOT EXISTS draft_orders_relation TEXT;

-- Add Product relation for order_draft_items if not already exists  
ALTER TABLE products ADD COLUMN IF NOT EXISTS draft_items_relation TEXT;
