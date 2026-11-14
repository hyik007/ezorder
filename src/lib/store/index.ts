import { localStore } from "./local";
import { supabaseConfigured, supabaseStore } from "./supabase";
import type { Store } from "./types";

/**
 * With Supabase keys in the environment the app syncs between real phones.
 * Without them it runs on sample data in this browser, so the journey always works.
 */
export const store: Store = supabaseConfigured ? supabaseStore : localStore;
export type { Store };
