import { createClient } from '@supabase/supabase-js';

// Default to the provisioned live Supabase project if Vite environment variables are not set
const DEFAULT_SUPABASE_URL = 'https://diuqdjsyhjocgudvmbun.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpdXFkanN5aGpvY2d1ZHZtYnVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5ODAyODEsImV4cCI6MjEwNDU1NjI4MX0.I8bO8WvI48EiXo_mg9CkGOckMCRHFVZsEqBcf-uD2ec';

const supabaseUrl = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL) || DEFAULT_SUPABASE_URL;
const supabaseAnonKey = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY) || DEFAULT_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
