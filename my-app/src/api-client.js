import { supabase } from "./supabase.js";
import { mergeUserData, normalizeUserData, sanitizeIntegrations } from "./sync-utils.js";

function mapRowToUserData(row) {
  if (!row) return null;

  return normalizeUserData({
    profile: row.profile,
    outputs: row.outputs,
    todos: row.todos,
    integrations: row.integrations,
    creds: row.creds,
    lastSync: row.last_sync,
    rowUpdatedAt: row.updated_at,
  });
}

async function getUid() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) throw new Error("Not authenticated");
  return session.user.id;
}

async function fetchUserRow(uid) {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("user_id", uid)
    .maybeSingle();

  if (error) throw error;
  return data;
}

function buildRow(uid, data) {
  const normalized = normalizeUserData(data);

  return {
    user_id: uid,
    profile: normalized.profile,
    outputs: normalized.outputs,
    todos: normalized.todos,
    integrations: sanitizeIntegrations(normalized.integrations),
    creds: normalized.creds,
    last_sync: normalized.lastSync,
  };
}

export async function fetchUserData() {
  const uid = await getUid();
  const row = await fetchUserRow(uid);
  return mapRowToUserData(row);
}

export async function saveUserData(_, data) {
  const uid = await getUid();
  const localData = normalizeUserData(data);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const existingRow = await fetchUserRow(uid);
    const remoteData = mapRowToUserData(existingRow);
    const mergedData = mergeUserData(remoteData, localData);
    const nextUpdatedAt = new Date().toISOString();
    const rowPayload = { ...buildRow(uid, mergedData), updated_at: nextUpdatedAt };

    if (!existingRow) {
      const { data: savedRow, error } = await supabase
        .from("users")
        .upsert(rowPayload, { onConflict: "user_id" })
        .select("*")
        .single();

      if (!error) return mapRowToUserData(savedRow);
      if (attempt < 2) continue;
      throw error;
    }

    const { data: savedRow, error } = await supabase
      .from("users")
      .update(rowPayload)
      .eq("user_id", uid)
      .eq("updated_at", existingRow.updated_at)
      .select("*")
      .maybeSingle();

    if (savedRow) return mapRowToUserData(savedRow);
    if (error && attempt === 2) throw error;
  }

  throw new Error("Could not save user data after multiple retries.");
}

export async function syncData(_, outputs, todos, lastSync) {
  return saveUserData(null, { outputs, todos, lastSync });
}

export async function updateCreds(_, creds) {
  const current = (await fetchUserData()) || {};
  return saveUserData(null, { ...current, creds });
}

export async function updateIntegrations(_, integrations) {
  const current = (await fetchUserData()) || {};
  return saveUserData(null, { ...current, integrations });
}

export async function subscribeToUserData(onChange) {
  const uid = await getUid();
  const channel = supabase
    .channel(`users-sync-${uid}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "users",
        filter: `user_id=eq.${uid}`,
      },
      (payload) => {
        if (payload.eventType === "DELETE") {
          onChange(null);
          return;
        }

        onChange(mapRowToUserData(payload.new));
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function getUserId() {
  return "supabase-auth";
}
