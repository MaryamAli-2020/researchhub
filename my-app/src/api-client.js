// my-app/src/api-client.js
// Direct Supabase data layer — no Express backend needed.
// The authenticated user's UUID is the sync key across all platforms.

import { supabase } from "./supabase.js";

// ─── helpers ────────────────────────────────────────────────

async function getUid() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) throw new Error("Not authenticated");
  return session.user.id;
}

// ─── fetch ──────────────────────────────────────────────────

export async function fetchUserData() {
  const uid = await getUid();
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("user_id", uid)
    .single();

  if (error && error.code === "PGRST116") return null; // no row yet
  if (error) throw error;

  return {
    profile:      data.profile      ?? {},
    outputs:      data.outputs      ?? [],
    todos:        data.todos        ?? [],
    integrations: data.integrations ?? {},
    creds:        data.creds        ?? {},
    lastSync:     data.last_sync    ?? null,
  };
}

// ─── save (upsert entire row) ────────────────────────────────

export async function saveUserData(_, data) {
  // The first arg (userId) is kept for API compatibility but ignored —
  // we always use the authenticated session UID.
  const uid = await getUid();
  const { error } = await supabase
    .from("users")
    .upsert({
      user_id:      uid,
      profile:      data.profile      ?? {},
      outputs:      data.outputs      ?? [],
      todos:        data.todos        ?? [],
      integrations: data.integrations ?? {},
      creds:        data.creds        ?? {},
      last_sync:    data.lastSync ? new Date(data.lastSync).toISOString() : new Date().toISOString(),
      updated_at:   new Date().toISOString(),
    }, { onConflict: "user_id" });

  if (error) throw error;
  return { ok: true };
}

// ─── partial sync (outputs + todos only) ────────────────────

export async function syncData(_, outputs, todos, lastSync) {
  const uid = await getUid();
  const { error } = await supabase
    .from("users")
    .update({
      outputs,
      todos,
      last_sync:  lastSync ? new Date(lastSync).toISOString() : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", uid);

  if (error) throw error;
  return { ok: true };
}

// ─── update creds ────────────────────────────────────────────

export async function updateCreds(_, creds) {
  const uid = await getUid();
  const { error } = await supabase
    .from("users")
    .update({ creds, updated_at: new Date().toISOString() })
    .eq("user_id", uid);

  if (error) throw error;
  return { ok: true };
}

// ─── update integrations ─────────────────────────────────────

export async function updateIntegrations(_, integrations) {
  const uid = await getUid();
  const { error } = await supabase
    .from("users")
    .update({ integrations, updated_at: new Date().toISOString() })
    .eq("user_id", uid);

  if (error) throw error;
  return { ok: true };
}

// ─── legacy shim — kept so App.jsx import doesn't break ──────
export function getUserId() {
  // No longer used — auth UID is resolved inside each function.
  // Safe to call; returns a placeholder.
  return "supabase-auth";
}