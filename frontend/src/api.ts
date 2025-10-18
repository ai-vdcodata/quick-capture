import { Item } from './types.ts';

const API_BASE_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error: any) {
      console.error('API request failed:', error);
      return { success: false, error: error.message || 'An error occurred' };
    }
  }

  async getItems(): Promise<ApiResponse<Item[]>> {
    return this.request<Item[]>('/items');
  }

  async createItem(item: Omit<Item, 'id' | 'created_at' | 'updated_at'>): Promise<ApiResponse<Item>> {
    return this.request<Item>('/items', {
      method: 'POST',
      body: JSON.stringify(item),
    });
  }

  async updateItem(id: string, item: Partial<Item>): Promise<ApiResponse<Item>> {
    return this.request<Item>(`/items/${id}`, {
      method: 'PUT',
      body: JSON.stringify(item),
    });
  }

  async deleteItem(id: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/items/${id}`, {
      method: 'DELETE',
    });
  }

  async getTags(): Promise<ApiResponse<string[]>> {
    return this.request<string[]>('/tags');
  }
}

export const api = new ApiClient(API_BASE_URL);
