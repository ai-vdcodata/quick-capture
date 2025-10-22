-- Migration: Add status tracking, sequential IDs, and improved dependency tracking
-- Issues: #2 (Status Tracking), #3 (Sequential IDs), #4 (Dependency Tracking)

-- 1. Create status enum type
DO $$ BEGIN
  CREATE TYPE item_status AS ENUM ('Open', 'In Progress', 'On Hold', 'Blocked', 'Completed', 'Canceled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Add status column with default value
ALTER TABLE items
ADD COLUMN IF NOT EXISTS status item_status NOT NULL DEFAULT 'Open';

-- 3. Create sequence for sequential IDs
CREATE SEQUENCE IF NOT EXISTS items_sequential_id_seq START WITH 1;

-- 4. Add sequential_id column
ALTER TABLE items
ADD COLUMN IF NOT EXISTS sequential_id INTEGER UNIQUE;

-- 5. Backfill sequential_id for existing records (ordered by created_at)
DO $$
DECLARE
  rec RECORD;
  counter INTEGER := 1;
BEGIN
  FOR rec IN
    SELECT id FROM items
    WHERE sequential_id IS NULL
    ORDER BY created_at ASC
  LOOP
    UPDATE items
    SET sequential_id = counter
    WHERE id = rec.id;
    counter := counter + 1;
  END LOOP;

  -- Set the sequence to start after existing records
  PERFORM setval('items_sequential_id_seq', counter);
END $$;

-- 6. Make sequential_id NOT NULL after backfill
ALTER TABLE items
ALTER COLUMN sequential_id SET NOT NULL;

-- 7. Create function to auto-assign sequential_id on insert
CREATE OR REPLACE FUNCTION set_sequential_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.sequential_id IS NULL THEN
    NEW.sequential_id := nextval('items_sequential_id_seq');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. Create trigger to auto-assign sequential_id
DROP TRIGGER IF EXISTS set_items_sequential_id ON items;
CREATE TRIGGER set_items_sequential_id
BEFORE INSERT ON items
FOR EACH ROW
EXECUTE FUNCTION set_sequential_id();

-- 9. Create index on status for better query performance
CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);

-- 10. Create index on sequential_id for lookups
CREATE INDEX IF NOT EXISTS idx_items_sequential_id ON items(sequential_id);

-- 11. Update the existing dependencies column comment for clarity
COMMENT ON COLUMN items.dependencies IS 'Array of sequential_ids (as strings) for items that must be completed before this item';

-- Note: The dependencies column already exists as TEXT[] in the original schema
-- Users should store sequential_ids as strings in this array (e.g., ['1', '5', '12'])
-- This allows for easier lookup and display of dependencies

-- Verification queries (uncomment to run):
-- SELECT COUNT(*), status FROM items GROUP BY status;
-- SELECT id, sequential_id, title, status, created_at FROM items ORDER BY sequential_id LIMIT 10;
