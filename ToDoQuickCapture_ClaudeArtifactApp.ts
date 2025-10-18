import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Calendar, CheckSquare, Edit2, ChevronDown, ChevronUp, X, Copy, Check, Cloud, CloudOff, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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

const QuickCaptureApp: React.FC = () => {
  // Hard-coded JSONBin.io credentials
  const API_KEY = '$2a$10$s7qUzV8SbTK1gD43Hn9JXOKcrsut1N5Fva0WSJWMMyXd1MRiAZk22';
  const BIN_ID = '68f3ad58d0ea881f40aa2874';
  
  const [items, setItems] = useState<Item[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [itemType, setItemType] = useState<ItemType>('task');
  const [showMoreDetails, setShowMoreDetails] = useState(false);
  const [nlInput, setNlInput] = useState('');
  const [showBackup, setShowBackup] = useState(false);
  const [backupCopied, setBackupCopied] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [lastSync, setLastSync] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<Partial<Item>>({
    title: '',
    tags: [],
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  });
  const [dueType, setDueType] = useState<'date' | 'week'>('date');
  const [tagInput, setTagInput] = useState('');
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [syncError, setSyncError] = useState<string>('');
  
  // Create shareable link with data encoded in URL
  const createShareableLink = useCallback(() => {
    const data = {
      items: items,
      tags: allTags,
      updated_at: new Date().toISOString()
    };
    
    // Compress data to base64
    const jsonString = JSON.stringify(data);
    const compressed = btoa(encodeURIComponent(jsonString));
    
    // Create URL with data in hash
    const url = window.location.origin + window.location.pathname + '#data=' + compressed;
    
    // Check URL length (browsers typically support ~2000 chars)
    if (url.length > 2000) {
      alert('Too much data for URL sharing. Please use JSON backup instead.');
      return null;
    }
    
    return url;
  }, [items, allTags]);
  
  // Load data from URL hash
  const loadFromUrl = useCallback(() => {
    try {
      const hash = window.location.hash;
      if (hash && hash.startsWith('#data=')) {
        const compressed = hash.substring(6);
        const jsonString = decodeURIComponent(atob(compressed));
        const data = JSON.parse(jsonString);
        
        if (data.items) {
          setItems(data.items);
          localStorage.setItem('items/v1', JSON.stringify(data.items));
        }
        
        if (data.tags) {
          setAllTags(data.tags);
          localStorage.setItem('tags/v1', JSON.stringify(data.tags));
        }
        
        alert('Data loaded from URL!');
        // Clear the hash to clean up the URL
        window.location.hash = '';
        return true;
      }
    } catch (error) {
      console.error('Failed to load from URL:', error);
    }
    return false;
  }, []);
  
  // Sync with JSONBin.io
  const syncWithCloud = useCallback(async (direction: 'push' | 'pull' | 'merge') => {
    setSyncStatus('syncing');
    setSyncError('');
    
    try {
      if (direction === 'pull' || direction === 'merge') {
        // Fetch from JSONBin
        console.log('Fetching from JSONBin...');
        const response = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
          method: 'GET',
          headers: {
            'X-Access-Key': API_KEY,
            'X-Bin-Meta': 'false'
          }
        });
        
        console.log('Response status:', response.status);
        
        if (response.ok) {
          const cloudData = await response.json();
          console.log('Cloud data received:', cloudData);
          
          if (direction === 'merge') {
            // Merge cloud and local data
            const localItemIds = new Set(items.map(item => item.id));
            const cloudItems = cloudData.items || [];
            const newItems = cloudItems.filter((item: Item) => !localItemIds.has(item.id));
            
            const mergedItems = [...items, ...newItems];
            const mergedTags = Array.from(new Set([...allTags, ...(cloudData.tags || [])]));
            
            setItems(mergedItems);
            setAllTags(mergedTags);
            localStorage.setItem('items/v1', JSON.stringify(mergedItems));
            localStorage.setItem('tags/v1', JSON.stringify(mergedTags));
          } else {
            // Pull: Replace local with cloud
            setItems(cloudData.items || []);
            setAllTags(cloudData.tags || []);
            localStorage.setItem('items/v1', JSON.stringify(cloudData.items || []));
            localStorage.setItem('tags/v1', JSON.stringify(cloudData.tags || []));
          }
        } else if (response.status === 404) {
          console.log('Bin not found, will create on push');
        } else {
          const errorText = await response.text();
          console.error('Fetch error:', errorText);
          throw new Error(`Failed to fetch: ${response.status}`);
        }
      }
      
      if (direction === 'push' || direction === 'merge') {
        // Push to JSONBin
        console.log('Pushing to JSONBin...');
        const dataToSave = {
          items: items,
          tags: allTags,
          updated_at: new Date().toISOString()
        };
        
        console.log('Data to save:', dataToSave);
        
        const response = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-Access-Key': API_KEY,
            'X-Bin-Versioning': 'false'
          },
          body: JSON.stringify(dataToSave)
        });
        
        console.log('Push response status:', response.status);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Push error:', errorText);
          throw new Error(`Failed to push: ${response.status} - ${errorText}`);
        }
        
        const result = await response.json();
        console.log('Push successful:', result);
      }
      
      const now = new Date().toISOString();
      setLastSync(now);
      localStorage.setItem('last_sync', now);
      setSyncStatus('success');
      setSyncError('');
      setTimeout(() => setSyncStatus('idle'), 2000);
      
    } catch (error: any) {
      console.error('Sync error:', error);
      setSyncError(error.message || 'Sync failed');
      setSyncStatus('error');
      setTimeout(() => setSyncStatus('idle'), 3000);
    }
  }, [items, allTags]);
  
  // Load data on mount (check for URL data first)
  useEffect(() => {
    const loadData = () => {
      // Check if there's data in the URL first
      const hash = window.location.hash;
      if (hash && hash.startsWith('#data=')) {
        try {
          const compressed = hash.substring(6);
          const jsonString = decodeURIComponent(atob(compressed));
          const data = JSON.parse(jsonString);
          
          if (data.items) {
            setItems(data.items);
            localStorage.setItem('items/v1', JSON.stringify(data.items));
          }
          
          if (data.tags) {
            setAllTags(data.tags);
            localStorage.setItem('tags/v1', JSON.stringify(data.tags));
          }
          
          // Clear the hash after loading
          window.location.hash = '';
          return; // Don't load from localStorage if we loaded from URL
        } catch (error) {
          console.error('Failed to load from URL:', error);
        }
      }
      
      // Load from localStorage if no URL data
      const storedItems = localStorage.getItem('items/v1');
      const storedTags = localStorage.getItem('tags/v1');
      const storedLastSync = localStorage.getItem('last_sync');
      
      if (storedLastSync) {
        setLastSync(storedLastSync);
      }
      
      if (storedItems) {
        try {
          const parsed = JSON.parse(storedItems);
          setItems(parsed);
        } catch (e) {
          console.error('Failed to load items:', e);
        }
      }
      
      if (storedTags) {
        try {
          const parsed = JSON.parse(storedTags);
          setAllTags(parsed);
        } catch (e) {
          console.error('Failed to load tags:', e);
        }
      }
    };
    
    loadData();
  }, []);
  
  // Save items to localStorage (removed auto-sync to avoid errors)
  useEffect(() => {
    if (items.length >= 0) {
      localStorage.setItem('items/v1', JSON.stringify(items));
    }
  }, [items]);
  
  // Save tags to localStorage
  useEffect(() => {
    if (allTags.length >= 0) {
      localStorage.setItem('tags/v1', JSON.stringify(allTags));
    }
  }, [allTags]);
  
  const resetForm = useCallback(() => {
    setFormData({
      title: '',
      tags: [],
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    });
    setDueType('date');
    setTagInput('');
    setErrors({});
    setNlInput('');
    setShowMoreDetails(false);
  }, []);
  
  const openModal = useCallback((item?: Item) => {
    if (item) {
      setEditingItem(item);
      setFormData(item);
      setItemType(item.type);
      setDueType(item.due_week_start ? 'week' : 'date');
    } else {
      setEditingItem(null);
      resetForm();
    }
    setShowModal(true);
  }, [resetForm]);
  
  const closeModal = useCallback(() => {
    setShowModal(false);
    setEditingItem(null);
    resetForm();
  }, [resetForm]);
  
  const validateForm = useCallback(() => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.title?.trim()) {
      newErrors.title = 'Title is required';
    }
    
    if (itemType === 'task') {
      if (!formData.due_date && !formData.due_week_start) {
        newErrors.due = 'Due date or week is required';
      }
      if (!formData.effort_min) {
        newErrors.effort = 'Effort is required';
      }
      if (!formData.deadline_type) {
        newErrors.deadline = 'Deadline type is required';
      }
    } else {
      if (!formData.start_iso) {
        newErrors.start = 'Start date/time is required';
      }
      if (!formData.all_day && !formData.duration_min) {
        newErrors.duration = 'Duration is required for non-all-day events';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData, itemType]);
  
  const handleSave = useCallback(() => {
    if (!validateForm()) return;
    
    const now = new Date().toISOString();
    const newItem: Item = {
      ...formData,
      id: editingItem?.id || crypto.randomUUID(),
      type: itemType,
      title: formData.title!.trim(),
      timezone: formData.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      created_at: editingItem?.created_at || now,
      updated_at: now
    } as Item;
    
    if (itemType === 'task') {
      delete newItem.start_iso;
      delete newItem.duration_min;
      delete newItem.all_day;
      delete newItem.location;
      delete newItem.attendees;
    } else {
      delete newItem.due_date;
      delete newItem.due_week_start;
      delete newItem.effort_min;
      delete newItem.deadline_type;
    }
    
    if (formData.tags?.length) {
      const newTags = formData.tags.filter(tag => !allTags.includes(tag));
      if (newTags.length > 0) {
        setAllTags([...allTags, ...newTags]);
      }
    }
    
    if (editingItem) {
      const updatedItems = items.map(item => 
        item.id === editingItem.id ? newItem : item
      );
      setItems(updatedItems);
    } else {
      setItems([newItem, ...items]);
    }
    
    closeModal();
  }, [formData, itemType, editingItem, items, allTags, validateForm, closeModal]);
  
  const parseNaturalLanguage = useCallback(() => {
    const input = nlInput.toLowerCase();
    const parsed: Partial<Item> = { ...formData };
    
    const tagMatches = input.match(/#(\w+)/g);
    if (tagMatches) {
      parsed.tags = tagMatches.map(tag => tag.substring(1));
    }
    
    if (input.includes('hard')) {
      parsed.deadline_type = 'hard';
    } else if (input.includes('soft')) {
      parsed.deadline_type = 'soft';
    }
    
    const durationMatch = input.match(/(\d+)h(\d+)?m?|(\d+)m/);
    if (durationMatch) {
      let minutes = 0;
      if (durationMatch[1]) {
        minutes = parseInt(durationMatch[1]) * 60;
        if (durationMatch[2]) {
          minutes += parseInt(durationMatch[2]);
        }
      } else if (durationMatch[3]) {
        minutes = parseInt(durationMatch[3]);
      }
      
      if (itemType === 'task') {
        parsed.effort_min = minutes;
      } else {
        parsed.duration_min = minutes;
      }
    }
    
    const today = new Date();
    
    if (input.includes('today')) {
      const dateStr = today.toISOString().split('T')[0];
      if (itemType === 'task') {
        parsed.due_date = dateStr;
      } else {
        parsed.start_iso = dateStr + 'T09:00:00';
      }
    } else if (input.includes('tomorrow')) {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];
      if (itemType === 'task') {
        parsed.due_date = dateStr;
      } else {
        parsed.start_iso = dateStr + 'T09:00:00';
      }
    }
    
    if (itemType === 'event' && input.includes('all-day')) {
      parsed.all_day = true;
    }
    
    let title = input
      .replace(/#\w+/g, '')
      .replace(/\b(hard|soft)\b/g, '')
      .replace(/\d+h?\d*m/g, '')
      .replace(/\b(today|tomorrow)\b/g, '')
      .replace(/all-day/g, '')
      .trim();
    
    if (title) {
      parsed.title = title;
    }
    
    setFormData(parsed);
  }, [nlInput, formData, itemType]);
  
  const handleTagInputChange = useCallback((value: string) => {
    setTagInput(value);
    
    if (value.trim()) {
      const suggestions = allTags.filter(tag => 
        tag.toLowerCase().includes(value.toLowerCase()) &&
        !formData.tags?.includes(tag)
      );
      setTagSuggestions(suggestions);
    } else {
      setTagSuggestions([]);
    }
  }, [allTags, formData.tags]);
  
  const addTag = useCallback((tag: string) => {
    const trimmedTag = tag.trim();
    if (trimmedTag && !formData.tags?.includes(trimmedTag)) {
      const currentTags = formData.tags || [];
      setFormData({
        ...formData,
        tags: [...currentTags, trimmedTag]
      });
      setTagInput('');
      setTagSuggestions([]);
    }
  }, [formData]);
  
  const removeTag = useCallback((tag: string) => {
    setFormData({
      ...formData,
      tags: formData.tags?.filter(t => t !== tag)
    });
  }, [formData]);
  
  const exportAsJSON = useCallback(() => {
    const data = {
      items,
      tags: allTags,
      exported_at: new Date().toISOString()
    };
    
    const json = JSON.stringify(data, null, 2);
    
    // Try to copy to clipboard
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(json).then(() => {
        setBackupCopied(true);
        setTimeout(() => setBackupCopied(false), 3000);
      }).catch(() => {
        setShowBackup(true);
      });
    } else {
      setShowBackup(true);
    }
  }, [items, allTags]);
  
  const importJSON = useCallback((jsonStr: string) => {
    try {
      const data = JSON.parse(jsonStr);
      
      if (data.items && Array.isArray(data.items)) {
        const importedItems = data.items.map((item: any) => ({
          ...item,
          id: crypto.randomUUID(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }));
        
        setItems([...importedItems, ...items]);
        
        if (data.tags && Array.isArray(data.tags)) {
          const newTags = new Set([...allTags, ...data.tags]);
          setAllTags(Array.from(newTags));
        }
        
        alert(`Imported ${importedItems.length} items successfully!`);
      }
    } catch (error) {
      alert('Invalid JSON format. Please check your backup data.');
    }
  }, [items, allTags]);
  
  const formatDate = useCallback((dateStr: string | null | undefined) => {
    if (!dateStr) return '';
    
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
    });
  }, []);
  
  const formatTime = useCallback((isoStr: string | null | undefined) => {
    if (!isoStr) return '';
    
    const date = new Date(isoStr);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }, []);
  
  const formatRelativeTime = useCallback((isoStr: string) => {
    const date = new Date(isoStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }, []);
  
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Quick Capture</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={exportAsJSON}
              className={`px-4 py-2 ${backupCopied ? 'bg-green-600' : 'bg-blue-600'} text-white rounded-lg hover:opacity-90 flex items-center gap-2 transition-colors`}
            >
              {backupCopied ? (
                <>
                  <Check className="w-4 h-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  JSON Backup
                </>
              )}
            </button>
          </div>
        </div>
        
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800 font-medium">💡 Sync Options in Claude:</p>
          <div className="text-xs text-yellow-700 mt-1 space-y-1">
            <p>✅ <strong>Works:</strong> Shareable links, JSON backup, localStorage</p>
            <p>❌ <strong>Blocked:</strong> External APIs (JSONBin, Firebase, etc.)</p>
            <p className="mt-2">Use "JSON Backup" button to create shareable links or export data!</p>
          </div>
        </div>
        
        {showBackup && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-6 bg-white rounded-lg shadow-sm p-4"
          >
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-medium text-gray-900">Backup & Sync Options</h3>
              <button
                onClick={() => setShowBackup(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            
            <div className="mb-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm font-medium text-blue-800 mb-2">📎 Shareable Link (Works in Claude!)</p>
              <p className="text-xs text-blue-700 mb-3">
                Create a link with your data embedded. Share across devices!
              </p>
              <button
                onClick={() => {
                  const url = createShareableLink();
                  if (url) {
                    navigator.clipboard.writeText(url).then(() => {
                      alert('Shareable link copied! Send it to another device or save it.');
                    }).catch(() => {
                      prompt('Copy this link:', url);
                    });
                  }
                }}
                className="w-full px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
              >
                📋 Create & Copy Shareable Link
              </button>
              {items.length > 10 && (
                <p className="text-xs text-blue-600 mt-2">
                  ⚠️ You have many items. Link might be too long for some browsers.
                </p>
              )}
            </div>
            
            <hr className="my-4" />
            
            <p className="text-sm text-gray-600 mb-3">Manual JSON Backup:</p>
            
            <textarea
              value={JSON.stringify({ items, tags: allTags, exported_at: new Date().toISOString() }, null, 2)}
              readOnly
              className="w-full h-48 p-3 border rounded-lg font-mono text-xs"
              onClick={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.select();
              }}
            />
            
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => {
                  const textarea = document.querySelector('textarea');
                  if (textarea) {
                    textarea.select();
                    document.execCommand('copy');
                    setBackupCopied(true);
                    setTimeout(() => setBackupCopied(false), 3000);
                  }
                }}
                className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
              >
                Copy to Clipboard
              </button>
              
              <input
                type="file"
                accept=".json"
                className="hidden"
                id="json-import"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      const text = event.target?.result as string;
                      importJSON(text);
                    };
                    reader.readAsText(file);
                  }
                  e.target.value = '';
                }}
              />
              
              <label
                htmlFor="json-import"
                className="px-3 py-1.5 bg-gray-600 text-white rounded text-sm hover:bg-gray-700 cursor-pointer"
              >
                Import JSON
              </label>
            </div>
            
            <p className="text-xs text-gray-500 mt-3">
              Copy this data and save it to a file. You can import it later to restore your items.
            </p>
          </motion.div>
        )}
        
        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-4 border-b">
            <h2 className="font-semibold text-gray-900">Capture Log</h2>
          </div>
          
          <div className="divide-y">
            {items.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No items yet. Click the Add button to get started.
              </div>
            ) : (
              items.map((item) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 hover:bg-gray-50 flex items-center gap-4"
                >
                  <div className="flex-shrink-0">
                    {item.type === 'task' ? (
                      <CheckSquare className="w-5 h-5 text-blue-600" />
                    ) : (
                      <Calendar className="w-5 h-5 text-green-600" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900">{item.title}</div>
                    <div className="text-sm text-gray-500">
                      {item.type === 'task' ? (
                        <>
                          Due: {formatDate(item.due_date || item.due_week_start)} • {item.effort_min}m • {item.deadline_type}
                          {item.priority && ` • P${item.priority}`}
                        </>
                      ) : (
                        <>
                          {formatDate(item.start_iso)}
                          {!item.all_day && ` ${formatTime(item.start_iso)}`}
                          {item.all_day ? ' • All day' : ` • ${item.duration_min}m`}
                          {item.priority && ` • P${item.priority}`}
                        </>
                      )}
                    </div>
                    {(item.notes || item.dependencies?.length) && (
                      <div className="text-xs text-gray-400 mt-1">
                        {item.dependencies?.length ? `⚡ ${item.dependencies.length} dependencies` : ''}
                        {item.dependencies?.length && item.notes ? ' • ' : ''}
                        {item.notes ? '📝 Has notes' : ''}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {item.tags?.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  
                  <div className="text-sm text-gray-400">
                    {formatRelativeTime(item.created_at)}
                  </div>
                  
                  <button
                    onClick={() => openModal(item)}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                  >
                    <Edit2 className="w-4 h-4 text-gray-600" />
                  </button>
                </motion.div>
              ))
            )}
          </div>
        </div>
        
        <button
          onClick={() => openModal()}
          className="fixed bottom-8 right-8 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 flex items-center justify-center"
        >
          <Plus className="w-6 h-6" />
        </button>
        
        <AnimatePresence>
          {showModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
              onClick={(e) => e.target === e.currentTarget && closeModal()}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              >
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-gray-900">
                      {editingItem ? 'Edit Item' : 'Quick Add'}
                    </h2>
                    <button
                      onClick={closeModal}
                      className="p-2 hover:bg-gray-100 rounded-lg"
                    >
                      <X className="w-5 h-5 text-gray-500" />
                    </button>
                  </div>
                  
                  <div className="flex gap-2 mb-6">
                    <button
                      onClick={() => setItemType('task')}
                      className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                        itemType === 'task'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      <CheckSquare className="w-4 h-4 inline-block mr-2" />
                      Task
                    </button>
                    <button
                      onClick={() => setItemType('event')}
                      className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                        itemType === 'event'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      <Calendar className="w-4 h-4 inline-block mr-2" />
                      Event
                    </button>
                  </div>
                  
                  <div className="mb-6">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={nlInput}
                        onChange={(e) => setNlInput(e.target.value)}
                        placeholder="Quick entry: e.g., 'Draft proposal by Friday 2h hard #work'"
                        className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <button
                        onClick={parseNaturalLanguage}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                      >
                        Parse
                      </button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Title *
                      </label>
                      <input
                        type="text"
                        value={formData.title || ''}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                          errors.title ? 'border-red-500' : 'border-gray-300'
                        }`}
                      />
                      {errors.title && (
                        <p className="text-red-500 text-xs mt-1">{errors.title}</p>
                      )}
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Tags
                      </label>
                      <div className="relative">
                        <div className="flex flex-wrap gap-1 p-2 border rounded-lg min-h-[42px]">
                          {formData.tags?.map((tag) => (
                            <motion.span
                              key={tag}
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
                            >
                              {tag}
                              <button
                                onClick={() => removeTag(tag)}
                                className="hover:text-blue-900"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </motion.span>
                          ))}
                          <input
                            type="text"
                            value={tagInput}
                            onChange={(e) => handleTagInputChange(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                addTag(tagInput);
                              }
                            }}
                            placeholder={formData.tags?.length ? '' : 'Add tags...'}
                            className="flex-1 min-w-[100px] outline-none"
                          />
                        </div>
                        
                        {tagSuggestions.length > 0 && (
                          <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg">
                            {tagSuggestions.map((tag) => (
                              <button
                                key={tag}
                                onClick={() => addTag(tag)}
                                className="w-full text-left px-3 py-2 hover:bg-gray-100"
                              >
                                {tag}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="mb-6">
                    <h3 className="font-medium text-gray-900 mb-3">Required</h3>
                    
                    {itemType === 'task' ? (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Due *
                          </label>
                          <div className="flex gap-2">
                            <select
                              value={dueType}
                              onChange={(e) => setDueType(e.target.value as 'date' | 'week')}
                              className="px-3 py-2 border rounded-lg"
                            >
                              <option value="date">Date</option>
                              <option value="week">Week</option>
                            </select>
                            <input
                              type="date"
                              value={dueType === 'date' ? (formData.due_date || '') : (formData.due_week_start || '')}
                              onChange={(e) => {
                                if (dueType === 'date') {
                                  setFormData({ ...formData, due_date: e.target.value, due_week_start: null });
                                } else {
                                  const date = new Date(e.target.value);
                                  const sunday = new Date(date);
                                  sunday.setDate(date.getDate() - date.getDay());
                                  setFormData({ 
                                    ...formData, 
                                    due_week_start: sunday.toISOString().split('T')[0],
                                    due_date: null 
                                  });
                                }
                              }}
                              className={`flex-1 px-3 py-2 border rounded-lg ${
                                errors.due ? 'border-red-500' : 'border-gray-300'
                              }`}
                            />
                          </div>
                          {errors.due && (
                            <p className="text-red-500 text-xs mt-1">{errors.due}</p>
                          )}
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Effort (minutes) *
                          </label>
                          <input
                            type="number"
                            value={formData.effort_min || ''}
                            onChange={(e) => {
                              const val = e.target.value ? parseInt(e.target.value) : null;
                              setFormData({ ...formData, effort_min: val });
                            }}
                            className={`w-full px-3 py-2 border rounded-lg ${
                              errors.effort ? 'border-red-500' : 'border-gray-300'
                            }`}
                          />
                          {errors.effort && (
                            <p className="text-red-500 text-xs mt-1">{errors.effort}</p>
                          )}
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Deadline Type *
                          </label>
                          <select
                            value={formData.deadline_type || ''}
                            onChange={(e) => {
                              const val = e.target.value as 'hard' | 'soft' | '';
                              setFormData({ ...formData, deadline_type: val ? val : null });
                            }}
                            className={`w-full px-3 py-2 border rounded-lg ${
                              errors.deadline ? 'border-red-500' : 'border-gray-300'
                            }`}
                          >
                            <option value="">Select...</option>
                            <option value="hard">Hard</option>
                            <option value="soft">Soft</option>
                          </select>
                          {errors.deadline && (
                            <p className="text-red-500 text-xs mt-1">{errors.deadline}</p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Start Date/Time *
                          </label>
                          <input
                            type="datetime-local"
                            value={formData.start_iso ? formData.start_iso.slice(0, 16) : ''}
                            onChange={(e) => {
                              const val = e.target.value ? new Date(e.target.value).toISOString() : null;
                              setFormData({ ...formData, start_iso: val });
                            }}
                            disabled={formData.all_day}
                            className={`w-full px-3 py-2 border rounded-lg ${
                              errors.start ? 'border-red-500' : 'border-gray-300'
                            } ${formData.all_day ? 'bg-gray-100' : ''}`}
                          />
                          {errors.start && (
                            <p className="text-red-500 text-xs mt-1">{errors.start}</p>
                          )}
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Duration (minutes) {!formData.all_day && '*'}
                          </label>
                          <input
                            type="number"
                            value={formData.duration_min || ''}
                            onChange={(e) => {
                              const val = e.target.value ? parseInt(e.target.value) : null;
                              setFormData({ ...formData, duration_min: val });
                            }}
                            disabled={formData.all_day}
                            className={`w-full px-3 py-2 border rounded-lg ${
                              errors.duration ? 'border-red-500' : 'border-gray-300'
                            } ${formData.all_day ? 'bg-gray-100' : ''}`}
                          />
                          {errors.duration && (
                            <p className="text-red-500 text-xs mt-1">{errors.duration}</p>
                          )}
                        </div>
                        
                        <div>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={formData.all_day || false}
                              onChange={(e) => setFormData({ 
                                ...formData, 
                                all_day: e.target.checked,
                                duration_min: e.target.checked ? null : formData.duration_min
                              })}
                              className="rounded"
                            />
                            <span className="text-sm font-medium text-gray-700">All day</span>
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="mb-6">
                    <button
                      onClick={() => setShowMoreDetails(!showMoreDetails)}
                      className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                    >
                      {showMoreDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      More details
                    </button>
                    
                    {showMoreDetails && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        className="mt-4 space-y-4"
                      >
                        {itemType === 'task' ? (
                          <>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Priority
                                </label>
                                <select
                                  value={formData.priority || ''}
                                  onChange={(e) => {
                                    const val = e.target.value ? parseInt(e.target.value) as 1 | 2 | 3 | 4 | 5 : null;
                                    setFormData({ ...formData, priority: val });
                                  }}
                                  className="w-full px-3 py-2 border rounded-lg"
                                >
                                  <option value="">None</option>
                                  <option value="1">1 (Highest)</option>
                                  <option value="2">2</option>
                                  <option value="3">3</option>
                                  <option value="4">4</option>
                                  <option value="5">5 (Lowest)</option>
                                </select>
                              </div>
                              
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Earliest Start
                                </label>
                                <input
                                  type="date"
                                  value={formData.earliest_start || ''}
                                  onChange={(e) => setFormData({ ...formData, earliest_start: e.target.value || null })}
                                  className="w-full px-3 py-2 border rounded-lg"
                                />
                              </div>
                            </div>
                            
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Dependencies (select existing items)
                              </label>
                              <select
                                multiple
                                value={formData.dependencies || []}
                                onChange={(e) => {
                                  const selected = Array.from(e.target.selectedOptions, option => option.value);
                                  setFormData({ ...formData, dependencies: selected.length > 0 ? selected : null });
                                }}
                                className="w-full px-3 py-2 border rounded-lg"
                                size={3}
                              >
                                {items
                                  .filter(item => item.id !== editingItem?.id)
                                  .map(item => (
                                    <option key={item.id} value={item.id}>
                                      {item.title} ({item.type})
                                    </option>
                                  ))
                                }
                              </select>
                              <p className="text-xs text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple</p>
                            </div>
                            
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Recurrence
                              </label>
                              <input
                                type="text"
                                value={formData.recurrence || ''}
                                onChange={(e) => setFormData({ ...formData, recurrence: e.target.value || null })}
                                placeholder="e.g., Daily, Weekly on Mon/Wed, Monthly"
                                className="w-full px-3 py-2 border rounded-lg"
                              />
                            </div>
                            
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Subtasks
                              </label>
                              <textarea
                                value={formData.subtasks?.join('\n') || ''}
                                onChange={(e) => {
                                  const lines = e.target.value.split('\n').filter(s => s.trim());
                                  setFormData({ ...formData, subtasks: lines.length > 0 ? lines : null });
                                }}
                                placeholder="One subtask per line"
                                rows={3}
                                className="w-full px-3 py-2 border rounded-lg"
                              />
                            </div>
                          </>
                        ) : (
                          <>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Priority
                              </label>
                              <select
                                value={formData.priority || ''}
                                onChange={(e) => {
                                  const val = e.target.value ? parseInt(e.target.value) as 1 | 2 | 3 | 4 | 5 : null;
                                  setFormData({ ...formData, priority: val });
                                }}
                                className="w-full px-3 py-2 border rounded-lg"
                              >
                                <option value="">None</option>
                                <option value="1">1 (Highest)</option>
                                <option value="2">2</option>
                                <option value="3">3</option>
                                <option value="4">4</option>
                                <option value="5">5 (Lowest)</option>
                              </select>
                            </div>
                            
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Location
                              </label>
                              <input
                                type="text"
                                value={formData.location || ''}
                                onChange={(e) => setFormData({ ...formData, location: e.target.value || null })}
                                className="w-full px-3 py-2 border rounded-lg"
                              />
                            </div>
                            
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Attendees
                              </label>
                              <textarea
                                value={formData.attendees?.join('\n') || ''}
                                onChange={(e) => {
                                  const lines = e.target.value.split('\n').filter(a => a.trim());
                                  setFormData({ ...formData, attendees: lines.length > 0 ? lines : null });
                                }}
                                placeholder="One attendee per line"
                                rows={3}
                                className="w-full px-3 py-2 border rounded-lg"
                              />
                            </div>
                            
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Recurrence
                              </label>
                              <input
                                type="text"
                                value={formData.recurrence || ''}
                                onChange={(e) => setFormData({ ...formData, recurrence: e.target.value || null })}
                                placeholder="e.g., Daily, Weekly on Mon/Wed, Monthly"
                                className="w-full px-3 py-2 border rounded-lg"
                              />
                            </div>
                          </>
                        )}
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Notes
                          </label>
                          <textarea
                            value={formData.notes || ''}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value || null })}
                            rows={3}
                            className="w-full px-3 py-2 border rounded-lg"
                            placeholder="Additional notes or details..."
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            URLs
                          </label>
                          <textarea
                            value={formData.urls?.join('\n') || ''}
                            onChange={(e) => {
                              const lines = e.target.value.split('\n').filter(u => u.trim());
                              setFormData({ ...formData, urls: lines.length > 0 ? lines : null });
                            }}
                            placeholder="One URL per line"
                            rows={2}
                            className="w-full px-3 py-2 border rounded-lg"
                          />
                        </div>
                      </motion.div>
                    )}
                  </div>
                  
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={closeModal}
                      className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default QuickCaptureApp;