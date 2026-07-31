window.SSD_CONFIG = {
  // Store Owner's WhatsApp Number (International format without '+' prefix or spaces)
  WHATSAPP_NUMBER: "918019655336",

  // Supabase project (Settings > API in the Supabase dashboard).
  // SUPABASE_ANON_KEY is the public "anon" key -- safe to expose in frontend
  // code as long as Row Level Security policies are enabled (see
  // backend/migrations/20260730_static_site_rls.sql). Never put the
  // service_role key here.
  SUPABASE_URL: "https://rrtrvdiznqcrnzwwnoih.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJydHJ2ZGl6bnFjcm56d3dub2loIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyNjA2MTQsImV4cCI6MjA5OTgzNjYxNH0.jbFfFLQF4vgY92tPwIZ72yYmJtb9M8ChFx8J-FU0h_M",
  SUPABASE_BUCKET: "saree_images"
};

// Requires the Supabase JS SDK <script> tag to be loaded before this file.
window.supabaseClient = window.supabase.createClient(
  window.SSD_CONFIG.SUPABASE_URL,
  window.SSD_CONFIG.SUPABASE_ANON_KEY
);
