import { supabase } from "./supabase.js";

function normalizeTodo(todo) {
  return {
    id: todo.id,
    title: typeof todo.title === "string" ? todo.title.trim() : "",
    priority: todo.priority || "Medium",
    due: todo.due || "",
    done: Boolean(todo.done),
    deletedAt: todo.deletedAt || null,
    updatedAt: todo.updatedAt || todo.createdAt || null,
  };
}

function sortTodos(items) {
  return [...items].sort((a, b) => {
    const priorityWeight = { High: 0, Medium: 1, Low: 2 };
    const dueA = a.due || "9999-12-31";
    const dueB = b.due || "9999-12-31";
    if (dueA !== dueB) return dueA.localeCompare(dueB);
    const prioDiff = (priorityWeight[a.priority] ?? 1) - (priorityWeight[b.priority] ?? 1);
    if (prioDiff !== 0) return prioDiff;
    return a.title.localeCompare(b.title);
  });
}

export function extractVisibleTodos(row) {
  if (!row?.todos || !Array.isArray(row.todos)) return [];
  return sortTodos(
    row.todos
      .filter((todo) => todo && typeof todo.id === "string")
      .map(normalizeTodo)
      .filter((todo) => todo.title && !todo.done && !todo.deletedAt),
  );
}

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export function onAuthStateChange(callback) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
  return () => subscription.unsubscribe();
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

async function fetchUserRow(uid) {
  const { data, error } = await supabase
    .from("users")
    .select("todos, profile, updated_at")
    .eq("user_id", uid)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function fetchWidgetData() {
  const session = await getSession();
  if (!session?.user?.id) return { todos: [], profile: null };
  const row = await fetchUserRow(session.user.id);
  return {
    todos: extractVisibleTodos(row),
    profile: row?.profile || null,
  };
}

export async function subscribeToWidgetData(onChange) {
  const session = await getSession();
  const uid = session?.user?.id;
  if (!uid) return () => {};

  const channel = supabase
    .channel(`widget-users-${uid}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "users",
        filter: `user_id=eq.${uid}`,
      },
      (payload) => {
        onChange({
          todos: extractVisibleTodos(payload.new),
          profile: payload.new?.profile || null,
        });
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
