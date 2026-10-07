import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : null;

export type AccountProfile = {
  id: string;
  display_name: string | null;
  role: "user" | "admin";
};

export type PlayerProfile = {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
};

export type MatchRecord = {
  id: string;
  user_id: string;
  player1_id: string | null;
  player2_id: string | null;
  player1_name: string;
  player2_name: string;
  player1_score: number;
  player2_score: number;
  winner_name: string | null;
  created_at: string;
};
