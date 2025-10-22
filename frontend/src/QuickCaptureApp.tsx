import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Calendar, CheckSquare, Edit2, ChevronDown, ChevronUp, X, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Item, ItemType } from './types.ts';
import { api } from './api.ts';

const QuickCaptureApp: React.FC = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [itemType, setItemType] = useState<ItemType>('task');
  const [showMoreDetails, setShowMoreDetails] = useState(false);
  const [nlInput, setNlInput] = useState('');
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [syncError, setSyncError] = useState<string>('');
  const [showCompleted, setShowCompleted] = useState(false);

  const [formData, setFormData] = useState<Partial<Item>>({
    title: '',
    tags: [],
    status: 'Open',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  });
  const [dueType, setDueType] = useState<'date' | 'week'>('date');
  const [tagInput, setTagInput] = useState('');
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load items from API on mount
  useEffect(() => {
    loadData();
  }, []);

  // Reload data when showCompleted changes
  useEffect(() => {
    loadData();
  }, [showCompleted]);

  const loadData = async () => {
    setSyncStatus('syncing');
    const itemsResponse = await api.getItems(showCompleted);
    const tagsResponse = await api.getTags();

    if (itemsResponse.success && itemsResponse.data) {
      setItems(itemsResponse.data);
    }

    if (tagsResponse.success && tagsResponse.data) {
      setAllTags(tagsResponse.data);
    }

    if (itemsResponse.error || tagsResponse.error) {
      setSyncError(itemsResponse.error || tagsResponse.error || 'Failed to load data');
      setSyncStatus('error');
      setTimeout(() => setSyncStatus('idle'), 3000);
    } else {
      setSyncStatus('success');
      setTimeout(() => setSyncStatus('idle'), 2000);
    }
  };

  const resetForm = useCallback(() => {
    setFormData({
      title: '',
      tags: [],
      status: 'Open',
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

  const handleSave = useCallback(async () => {
    if (!validateForm()) return;

    setSyncStatus('syncing');

    const itemData: any = {
      ...formData,
      type: itemType,
      title: formData.title!.trim(),
      timezone: formData.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    };

    // Remove type-specific fields
    if (itemType === 'task') {
      delete itemData.start_iso;
      delete itemData.duration_min;
      delete itemData.all_day;
      delete itemData.location;
      delete itemData.attendees;
    } else {
      delete itemData.due_date;
      delete itemData.due_week_start;
      delete itemData.effort_min;
      delete itemData.deadline_type;
    }

    let response;
    if (editingItem) {
      response = await api.updateItem(editingItem.id, itemData);
    } else {
      response = await api.createItem(itemData);
    }

    if (response.success && response.data) {
      if (editingItem) {
        setItems(items.map(item => item.id === editingItem.id ? response.data! : item));
      } else {
        setItems([response.data, ...items]);
      }

      // Reload tags
      const tagsResponse = await api.getTags();
      if (tagsResponse.success && tagsResponse.data) {
        setAllTags(tagsResponse.data);
      }

      setSyncStatus('success');
      setTimeout(() => setSyncStatus('idle'), 2000);
      closeModal();
    } else {
      setSyncError(response.error || 'Failed to save item');
      setSyncStatus('error');
      setTimeout(() => setSyncStatus('idle'), 3000);
    }
  }, [formData, itemType, editingItem, items, closeModal, validateForm]);

  const parseNaturalLanguage = useCallback(() => {
    const input = nlInput.toLowerCase();

    setFormData(prev => {
      const parsed: Partial<Item> = { ...prev };

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

      return parsed;
    });
  }, [nlInput, itemType]);

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
    if (trimmedTag) {
      setFormData(prev => {
        // Check if tag already exists
        if (prev.tags?.includes(trimmedTag)) {
          return prev;
        }
        const currentTags = prev.tags || [];
        return {
          ...prev,
          tags: [...currentTags, trimmedTag]
        };
      });
      setTagInput('');
      setTagSuggestions([]);
    }
  }, []);

  const removeTag = useCallback((tag: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags?.filter(t => t !== tag)
    }));
  }, []);

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Open': return 'bg-blue-100 text-blue-800';
      case 'In Progress': return 'bg-yellow-100 text-yellow-800';
      case 'On Hold': return 'bg-gray-100 text-gray-800';
      case 'Blocked': return 'bg-red-100 text-red-800';
      case 'Completed': return 'bg-green-100 text-green-800';
      case 'Canceled': return 'bg-gray-100 text-gray-500';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Quick Capture</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCompleted(!showCompleted)}
              className={`px-4 py-2 ${
                showCompleted ? 'bg-gray-700' : 'bg-gray-500'
              } text-white rounded-lg hover:opacity-90 flex items-center gap-2 transition-colors text-sm`}
            >
              {showCompleted ? 'Hide Completed' : 'Show Completed'}
            </button>
            <button
              onClick={loadData}
              disabled={syncStatus === 'syncing'}
              className={`px-4 py-2 ${
                syncStatus === 'success' ? 'bg-green-600' :
                syncStatus === 'error' ? 'bg-red-600' :
                'bg-blue-600'
              } text-white rounded-lg hover:opacity-90 flex items-center gap-2 transition-colors disabled:opacity-50`}
            >
              <RefreshCw className={`w-4 h-4 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
              {syncStatus === 'syncing' ? 'Syncing...' :
               syncStatus === 'success' ? 'Synced!' :
               syncStatus === 'error' ? 'Error' : 'Refresh'}
            </button>
          </div>
        </div>

        {syncError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">{syncError}</p>
          </div>
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
                  <div className="flex-shrink-0 text-sm font-mono text-gray-400">
                    #{item.sequential_id}
                  </div>

                  <div className="flex-shrink-0">
                    {item.type === 'task' ? (
                      <CheckSquare className="w-5 h-5 text-blue-600" />
                    ) : (
                      <Calendar className="w-5 h-5 text-green-600" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{item.title}</span>
                      <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(item.status)}`}>
                        {item.status}
                      </span>
                    </div>
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
                        Status *
                      </label>
                      <select
                        value={formData.status || 'Open'}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="Open">Open</option>
                        <option value="In Progress">In Progress</option>
                        <option value="On Hold">On Hold</option>
                        <option value="Blocked">Blocked</option>
                        <option value="Completed">Completed</option>
                        <option value="Canceled">Canceled</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 mb-6">
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
                            disabled={formData.all_day ?? false}
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
                            disabled={formData.all_day ?? false}
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
                            Dependencies (Task IDs)
                          </label>
                          <input
                            type="text"
                            value={formData.dependencies?.join(', ') || ''}
                            onChange={(e) => {
                              const ids = e.target.value.split(',').map(s => s.trim()).filter(s => s);
                              setFormData({ ...formData, dependencies: ids.length > 0 ? ids : null });
                            }}
                            placeholder="e.g., 5, 12, 23 (comma-separated task IDs)"
                            className="w-full px-3 py-2 border rounded-lg"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Enter sequential IDs of tasks that must be completed before this one
                          </p>
                          {items.filter(i => i.status !== 'Completed' && i.status !== 'Canceled' && i.id !== editingItem?.id).length > 0 && (
                            <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                              <p className="font-medium text-gray-700 mb-1">Available open tasks:</p>
                              <div className="flex flex-wrap gap-1">
                                {items
                                  .filter(i => i.status !== 'Completed' && i.status !== 'Canceled' && i.id !== editingItem?.id)
                                  .slice(0, 10)
                                  .map(i => (
                                    <span key={i.id} className="px-2 py-0.5 bg-white border rounded text-gray-600">
                                      #{i.sequential_id}: {i.title.substring(0, 20)}{i.title.length > 20 ? '...' : ''}
                                    </span>
                                  ))}
                                {items.filter(i => i.status !== 'Completed' && i.status !== 'Canceled' && i.id !== editingItem?.id).length > 10 && (
                                  <span className="text-gray-500">+{items.filter(i => i.status !== 'Completed' && i.status !== 'Canceled' && i.id !== editingItem?.id).length - 10} more</span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

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
                      disabled={syncStatus === 'syncing'}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      {syncStatus === 'syncing' ? 'Saving...' : 'Save'}
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
