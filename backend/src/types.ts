export type ItemType = 'task' | 'event';

export interface Item {
  id: string;
  type: ItemType;
  title: string;
  start_iso?: string | null;
  duration_min?: number | null;
  all_day?: boolean | null;
  location?: string | null;
  attendees?: string[] | null;
  due_date?: string | null;
  due_week_start?: string | null;
  effort_min?: number | null;
  deadline_type?: 'hard' | 'soft' | null;
  priority?: 1 | 2 | 3 | 4 | 5 | null;
  earliest_start?: string | null;
  recurrence?: string | null;
  subtasks?: string[] | null;
  dependencies?: string[] | null;
  tags?: string[] | null;
  notes?: string | null;
  urls?: string[] | null;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface DbItem extends Omit<Item, 'id'> {
  id?: string;
}
