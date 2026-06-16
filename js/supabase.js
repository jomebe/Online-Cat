// js/supabase.js
// Supabase Client Initialization and authentication helpers.

const SUPABASE_URL = "https://qnzxwbtxrfcqxshiujmu.supabase.co";
const DEFAULT_ANON_KEY = "sb_publishable_0C3jRPfJxxOhkb-fB7Je_w_iAEfnBcI";

// Try to load the anon key from localStorage, fallback to DEFAULT_ANON_KEY
let supabaseAnonKey = DEFAULT_ANON_KEY;
try {
  supabaseAnonKey = localStorage.getItem('supabase_anon_key') || DEFAULT_ANON_KEY;
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
  supabaseAnonKey = key || DEFAULT_ANON_KEY;
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
