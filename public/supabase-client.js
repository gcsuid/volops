// Initialize the Supabase client
const SUPABASE_URL = 'https://fbvqkyyhzegxtikqrskt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZidnFreXloemVneHRpa3Fyc2t0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNDY5MTcsImV4cCI6MjA4ODYyMjkxN30.ZR5sf-gYu4A1cN4epGRaU3ik_xOF8erHxX4csRXr2c8';

// Create a single supabase client for interacting with your database
window.supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
