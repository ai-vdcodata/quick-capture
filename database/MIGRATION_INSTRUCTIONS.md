# Migration Instructions for Status, Sequential IDs, and Dependencies

This migration adds three new features to the Quick Capture application:
- **Issue #2**: Status tracking (Open, In Progress, On Hold, Blocked, Completed, Canceled)
- **Issue #3**: Sequential IDs for easy reference
- **Issue #4**: Dependency tracking between tasks

## For Existing Installations

If you already have a Quick Capture database with data, follow these steps:

### Step 1: Apply the Migration

1. Go to your Supabase dashboard: https://supabase.com/dashboard
2. Navigate to your project
3. Open the **SQL Editor**
4. Copy the contents of `database/migration_001_status_sequential_id.sql`
5. Paste into the SQL Editor
6. Click **Run**

The migration will:
- Create the `item_status` enum type
- Add `status` column (defaults to 'Open')
- Create sequence for sequential IDs
- Add `sequential_id` column
- Backfill sequential IDs for existing records (ordered by creation date)
- Create auto-increment trigger for new records
- Add database indexes for performance
- Add column comments for documentation

### Step 2: Deploy Backend Changes

The backend has been updated to:
- Support new `status` and `sequential_id` fields
- Filter out Completed/Canceled items by default
- Accept `?include_completed=true` query parameter to show all items

If using Render:
1. Push changes to GitHub: `git push origin feature/issues-2-3-4-status-ids-dependencies`
2. Render will auto-deploy the backend
3. No environment variable changes needed

### Step 3: Deploy Frontend Changes

The frontend has been updated to:
- Display sequential IDs (#1, #2, etc.)
- Show status badges with color coding
- Provide status dropdown in forms
- Include toggle to show/hide completed items
- Add dependency input with task lookup

If using Render:
1. Frontend will auto-deploy with backend
2. No environment variable changes needed

### Step 4: Verify

After deployment:
1. Open your application
2. Existing items should have sequential IDs assigned
3. All existing items should have status "Open"
4. Create a new item and verify:
   - It gets the next sequential ID automatically
   - Status dropdown works
   - Status badges appear
   - Toggle show/hide completed works
   - Dependencies field allows entering task IDs

## For Fresh Installations

If you're setting up Quick Capture for the first time, use the updated `database/schema.sql` file which includes all the new fields. The migration file is not needed.

## Troubleshooting

### Migration Fails with "type already exists"
This means the migration was partially applied. You can either:
1. Drop the type and re-run: `DROP TYPE IF EXISTS item_status CASCADE;`
2. Or skip the enum creation section

### Sequential IDs not auto-generating
Check that the trigger was created:
```sql
SELECT * FROM information_schema.triggers WHERE trigger_name = 'set_items_sequential_id';
```

### Status column missing
Verify the column was added:
```sql
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'items' AND column_name IN ('status', 'sequential_id');
```

## Rollback (if needed)

If you need to rollback the migration:

```sql
-- Remove columns
ALTER TABLE items DROP COLUMN IF EXISTS status;
ALTER TABLE items DROP COLUMN IF EXISTS sequential_id;

-- Remove trigger and function
DROP TRIGGER IF EXISTS set_items_sequential_id ON items;
DROP FUNCTION IF EXISTS set_sequential_id();

-- Remove sequence
DROP SEQUENCE IF EXISTS items_sequential_id_seq;

-- Remove enum type
DROP TYPE IF EXISTS item_status;

-- Remove indexes
DROP INDEX IF EXISTS idx_items_status;
DROP INDEX IF EXISTS idx_items_sequential_id;
```

⚠️ **Warning**: Rollback will delete all status and sequential_id data.

## Support

If you encounter issues:
1. Check the Supabase logs in the dashboard
2. Check browser console for frontend errors
3. Open an issue on GitHub with:
   - Error message
   - Steps to reproduce
   - Database state (SELECT COUNT(*) FROM items;)
