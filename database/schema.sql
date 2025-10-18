-- Quick Capture Database Schema for Supabase PostgreSQL

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create items table
CREATE TABLE IF NOT EXISTS items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type VARCHAR(10) NOT NULL CHECK (type IN ('task', 'event')),
  title TEXT NOT NULL,

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

-- Note: For single-user setup, you can disable Row Level Security (RLS)
-- If you want to enable RLS in the future, uncomment these lines:
-- ALTER TABLE items ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow all operations for authenticated users" ON items FOR ALL USING (true);
