// js/supabase.js
// Supabase Client Initialization and authentication helpers.

const SUPABASE_URL = "https://qnzxwbtxrfcqxshiujmu.supabase.co";

// Try to load the anon key from localStorage
let supabaseAnonKey = "";
try {
  supabaseAnonKey = localStorage.getItem('supabase_anon_key') || "";
} catch (e) {
  console.warn("localStorage is not available.");
}

export function getSupabaseUrl() {
  return SUPABASE_URL;
}

export function getSupabaseAnonKey() {
  return supabaseAnonKey;
}

export function setSupabaseAnonKey(key) {
  supabaseAnonKey = key;
  try {
    if (key) {
      localStorage.setItem('supabase_anon_key', key);
    } else {
      localStorage.removeItem('supabase_anon_key');
    }
  } catch (e) {
    console.warn("Failed to write to localStorage.");
  }
  initSupabaseClient();
}

export let supabase = null;

export function initSupabaseClient() {
  if (supabaseAnonKey && window.supabase) {
    try {
      supabase = window.supabase.createClient(SUPABASE_URL, supabaseAnonKey);
    } catch (err) {
      console.error('Failed to create Supabase client:', err.message);
      supabase = null;
    }
  } else {
    supabase = null;
  }
  return supabase;
}

// Initial initialization attempt
initSupabaseClient();
