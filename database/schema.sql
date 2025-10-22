-- Quick Capture Database Schema for Supabase PostgreSQL

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create status enum type
DO $$ BEGIN
  CREATE TYPE item_status AS ENUM ('Open', 'In Progress', 'On Hold', 'Blocked', 'Completed', 'Canceled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create sequence for sequential IDs
CREATE SEQUENCE IF NOT EXISTS items_sequential_id_seq START WITH 1;

-- Create items table
CREATE TABLE IF NOT EXISTS items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sequential_id INTEGER UNIQUE NOT NULL DEFAULT nextval('items_sequential_id_seq'),
  type VARCHAR(10) NOT NULL CHECK (type IN ('task', 'event')),
  title TEXT NOT NULL,
  status item_status NOT NULL DEFAULT 'Open',

  -- Event-specific fields
  start_iso TIMESTAMPTZ,
  duration_min INTEGER,
  all_day BOOLEAN,
  location TEXT,
  attendees TEXT[],

  -- Task-specific fields
  due_date DATE,
  due_week_start DATE,
  effort_min INTEGER,
  deadline_type VARCHAR(10) CHECK (deadline_type IN ('hard', 'soft')),

  -- Common fields
  priority INTEGER CHECK (priority BETWEEN 1 AND 5),
  earliest_start DATE,
  recurrence TEXT,
  subtasks TEXT[],
  dependencies TEXT[],
  tags TEXT[],
  notes TEXT,
  urls TEXT[],
  timezone VARCHAR(100) NOT NULL,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_items_type ON items(type);
CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
CREATE INDEX IF NOT EXISTS idx_items_sequential_id ON items(sequential_id);
CREATE INDEX IF NOT EXISTS idx_items_created_at ON items(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_items_due_date ON items(due_date) WHERE due_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_items_start_iso ON items(start_iso) WHERE start_iso IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_items_tags ON items USING GIN(tags) WHERE tags IS NOT NULL;

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to automatically update updated_at
CREATE TRIGGER update_items_updated_at
BEFORE UPDATE ON items
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Add comments for special columns
COMMENT ON COLUMN items.dependencies IS 'Array of sequential_ids (as strings) for items that must be completed before this item';
COMMENT ON COLUMN items.status IS 'Current status: Open, In Progress, On Hold, Blocked, Completed, or Canceled';
COMMENT ON COLUMN items.sequential_id IS 'Human-readable sequential ID for easy reference';

-- Note: For single-user setup, you can disable Row Level Security (RLS)
-- If you want to enable RLS in the future, uncomment these lines:
-- ALTER TABLE items ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow all operations for authenticated users" ON items FOR ALL USING (true);
