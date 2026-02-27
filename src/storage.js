import { supabase } from './supabaseClient';

/**
 * Drop-in replacement for window.storage using Supabase.
 * Uses a simple key-value table (kv_store) in Supabase.
 *
 * Table schema:
 *   CREATE TABLE kv_store (
 *     key TEXT PRIMARY KEY,
 *     value TEXT NOT NULL,
 *     updated_at TIMESTAMPTZ DEFAULT now()
 *   );
 */

const storage = {
  async get(key) {
    const { data, error } = await supabase
      .from('kv_store')
      .select('key, value')
      .eq('key', key)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    return { key: data.key, value: data.value };
  },

  async set(key, value) {
    const { data, error } = await supabase
      .from('kv_store')
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
      .select('key, value')
      .single();

    if (error) throw error;
    return { key: data.key, value: data.value };
  },

  async delete(key) {
    const { error } = await supabase
      .from('kv_store')
      .delete()
      .eq('key', key);

    if (error) throw error;
    return { key, deleted: true };
  },

  async list(prefix) {
    let query = supabase.from('kv_store').select('key');
    if (prefix) {
      query = query.like('key', `${prefix}%`);
    }
    const { data, error } = await query;
    if (error) throw error;
    return { keys: (data || []).map((d) => d.key), prefix };
  },
};

// Make it available globally so the App component can use it
// exactly as it used window.storage before
window.storage = storage;

export default storage;
