import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL ?? "https://nmaleghbwzbuedukxctb.supabase.co";
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5tYWxlZ2hid3pidWVkdWt4Y3RiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4OTg3NzQsImV4cCI6MjA4ODQ3NDc3NH0.7gbRxezsIrwtlnJuxxQzmwIuptkzcGfSOiP3sbqcpyI";

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
