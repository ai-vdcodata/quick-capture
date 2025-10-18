import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { supabase } from './db.js';
import { Item, DbItem } from './types.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Simple API key authentication middleware
const authenticateApiKey = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const apiKey = req.headers['x-api-key'];
  const expectedApiKey = process.env.API_KEY;

  if (!expectedApiKey) {
    // If no API key is set, allow requests (for development)
    return next();
  }

  if (apiKey !== expectedApiKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
};

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get all items
app.get('/api/items', authenticateApiKey, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json(data || []);
  } catch (error: any) {
    console.error('Error fetching items:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch items' });
  }
});

// Create a new item
app.post('/api/items', authenticateApiKey, async (req, res) => {
  try {
    const itemData: DbItem = {
      ...req.body,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('items')
      .insert([itemData])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json(data);
  } catch (error: any) {
    console.error('Error creating item:', error);
    res.status(500).json({ error: error.message || 'Failed to create item' });
  }
});

// Update an item
app.put('/api/items/:id', authenticateApiKey, async (req, res) => {
  try {
    const { id } = req.params;
    const itemData = {
      ...req.body,
      updated_at: new Date().toISOString(),
    };

    // Remove id from the update data if present
    delete itemData.id;
    delete itemData.created_at; // Don't update created_at

    const { data, error } = await supabase
      .from('items')
      .update(itemData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.json(data);
  } catch (error: any) {
    console.error('Error updating item:', error);
    res.status(500).json({ error: error.message || 'Failed to update item' });
  }
});

// Delete an item
app.delete('/api/items/:id', authenticateApiKey, async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('items')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.status(204).send();
  } catch (error: any) {
    console.error('Error deleting item:', error);
    res.status(500).json({ error: error.message || 'Failed to delete item' });
  }
});

// Get all unique tags
app.get('/api/tags', authenticateApiKey, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('items')
      .select('tags');

    if (error) throw error;

    // Extract and deduplicate tags
    const tagsSet = new Set<string>();
    data?.forEach((item: any) => {
      if (item.tags && Array.isArray(item.tags)) {
        item.tags.forEach((tag: string) => tagsSet.add(tag));
      }
    });

    const uniqueTags = Array.from(tagsSet).sort();
    res.json(uniqueTags);
  } catch (error: any) {
    console.error('Error fetching tags:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch tags' });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Health check available at http://localhost:${port}/health`);
});
