import React, { useState, useEffect, useCallback } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AuthProvider, useAuth } from "./AuthContext.js";
import AuthScreen from "./AuthScreen.js";
import { fetchUserData, saveUserData } from "./api-client.js";

const V = "#8b5cf6";
const G = "#22d3a5";
const A = "#f59e0b";
const B = "#38bdf8";

const STORAGE_KEY = "reeza_user_data";

const typeIcon = {
  Paper: "📄", Preprint: "📝", Dataset: "📊", Code: "💻",
  Software: "⚙️", Talk: "🎤", Poster: "🖼️", Report: "📋",
};

const typeColor = (t) =>
  ({ Paper: V, Preprint: "#a78bfa", Dataset: G, Code: A, Software: "#fb923c", Talk: "#f472b6", Poster: "#e879f9", Report: B }[t] || "#94a3b8");

/* ─── EXTERNAL API FETCHERS (unchanged) ─────────────────── */
async function fetchORCID(orcidId) {
  const base = `https://pub.orcid.org/v3.0/${orcidId}`;
  const headers = { Accept: "application/json" };
  const res = await fetch(`${base}/works`, { headers });
  if (!res.ok) throw new Error(`ORCID error: ${res.status}`);
  const data = await res.json();
  const groups = data.group || [];
  const outputs = [];
  for (const g of groups.slice(0, 40)) {
    const summary = g["work-summary"]?.[0];
    if (!summary) continue;
    const title = summary.title?.title?.value || "Untitled";
    const year = summary["publication-date"]?.year?.value || null;
    const type = summary.type || "journal-article";
    const extIds = summary["external-ids"]?.["external-id"] || [];
    const doiObj = extIds.find((e) => e["external-id-type"] === "doi");
    const doi = doiObj ? doiObj["external-id-value"] : "";
    const mapped = type.includes("dataset") ? "Dataset"
      : type.includes("software") ? "Software"
      : type.includes("preprint") ? "Preprint"
      : type.includes("conference") ? "Talk"
      : "Paper";
    outputs.push({ id: `orcid-${Math.random().toString(36).slice(2)}`, type: mapped, title, platform: "ORCID", year: year ? +year : null, citations: 0, downloads: 0, stars: 0, doi, version: "", source: "orcid" });
  }
  return outputs;
}

async function fetchCrossRefCitations(doi) {
  try {
    const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, { headers: { "User-Agent": "Reeza/1.0 (mailto:info@Reeza.io)" } });
    if (!res.ok) return 0;
    const data = await res.json();
    return data.message?.["is-referenced-by-count"] || 0;
  } catch { return 0; }
}

async function enrichWithCitations(outputs) {
  const enriched = [...outputs];
  const withDoi = enriched.filter((o) => o.doi && ["Paper", "Preprint", "Report"].includes(o.type)).slice(0, 15);
  await Promise.all(withDoi.map(async (o) => {
    const c = await fetchCrossRefCitations(o.doi);
    const idx = enriched.findIndex((x) => x.id === o.id);
    if (idx !== -1) enriched[idx] = { ...enriched[idx], citations: c };
  }));
  return enriched;
}

function parseZenodoHit(h) {
  const rt = h.metadata?.resource_type?.type || h.resource_type?.type || "publication";
  const st = h.metadata?.resource_type?.subtype || h.resource_type?.subtype || "";
  const mapped = rt === "dataset" ? "Dataset" : rt === "software" ? "Software" : st === "preprint" ? "Preprint" : st.includes("conferencepaper") ? "Paper" : st.includes("poster") ? "Poster" : st.includes("presentation") ? "Talk" : "Paper";
  const doi = h.doi || h.metadata?.doi || h.conceptdoi || "";
  const year = (h.metadata?.publication_date || h.created || "").slice(0, 4);
  return { id: `zenodo-${h.id}`, type: mapped, title: h.metadata?.title || h.title || "Untitled", platform: "Zenodo", year: year ? +year : null, citations: 0, downloads: h.stats?.downloads || 0, stars: 0, doi, version: h.metadata?.version || "", source: "zenodo" };
}

async function fetchZenodo(tokenOrUsername, isUsername = false) {
  if (isUsername) {
    const url = `https://zenodo.org/api/records?q=creators.name:${encodeURIComponent(tokenOrUsername)}&sort=mostrecent&size=40`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Zenodo error: ${res.status}`);
    const data = await res.json();
    return (data.hits?.hits || []).map(parseZenodoHit);
  } else {
    const headers = { Authorization: `Bearer ${tokenOrUsername}`, "Content-Type": "application/json" };
    const res = await fetch("https://zenodo.org/api/deposit/depositions?sort=mostrecent&size=40", { headers });
    if (!res.ok) throw new Error(`Zenodo error: ${res.status}`);
    const data = await res.json();
    return (Array.isArray(data) ? data : data.hits?.hits || []).map(parseZenodoHit);
  }
}

async function fetchGitHub(username) {
  const res = await fetch(`https://api.github.com/users/${username}/repos?sort=updated&per_page=100&type=owner`);
  if (!res.ok) throw new Error(`GitHub error: ${res.status} — check username`);
  const repos = await res.json();
  return repos.filter((r) => !r.fork).map((r) => ({ id: `gh-${r.id}`, type: "Code", title: r.name, platform: "GitHub", year: r.created_at ? +r.created_at.slice(0, 4) : null, citations: 0, downloads: 0, stars: r.stargazers_count || 0, doi: "", version: "", source: "github", description: r.description || "", language: r.language || "" }));
}

/* ─── TABS ───────────────────────────────────────────────── */
const TABS = [
  { id: "dashboard",    label: "Dashboard"    },
  { id: "projects",     label: "Projects"     },
  { id: "integrations", label: "Integrations" },
  { id: "todo",         label: "Todo"         },
];

/* ─── AUTH GATE ──────────────────────────────────────────── */
export default function App() {
  return (
    <AuthProvider>
      <AppGate />
    </AuthProvider>
  );
}

function AppGate() {
  const { session, loading, signIn, signUp } = useAuth();

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#04080f", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color="#8b5cf6" size="large" />
      </SafeAreaView>
    );
  }

  if (!session) {
    return <AuthScreen signIn={signIn} signUp={signUp} />;
  }

  return <AppInner user={session.user} />;
}

/* ─── MAIN APP ───────────────────────────────────────────── */
function AppInner({ user }) {
  const { signOut } = useAuth();
  const [view, setView] = useState("dashboard");
  const [hydrated, setHydrated] = useState(false);

  const defaultTodos = [
    { id: "1", title: "Finish Q1 research paper",          priority: "High",   due: "2024-03-15", done: false },
    { id: "2", title: "Update GitHub repos documentation", priority: "Medium", due: "",           done: false },
    { id: "3", title: "Submit dataset to Zenodo",          priority: "High",   due: "2024-03-20", done: false },
  ];

  const [profile,      setProfile]      = useState({ name: "Researcher", affiliation: "", bio: "" });
  const [outputs,      setOutputs]      = useState([]);
  const [todos,        setTodos]        = useState(defaultTodos);
  const [integrations, setIntegrations] = useState({
    orcid:    { status: "idle", count: 0, error: null },
    zenodo:   { status: "idle", count: 0, error: null },
    github:   { status: "idle", count: 0, error: null },
    crossref: { status: "idle", count: 0, error: null },
  });
  const [creds,    setCreds]    = useState({ orcidId: "", zenodoToken: "", githubUsername: "" });
  const [lastSync, setLastSync] = useState(null);
  const [syncing,  setSyncing]  = useState(false);

  // ── 1. Load from Supabase first, fall back to AsyncStorage ──
  useEffect(() => {
    (async () => {
      try {
        // Try Supabase first (cross-device sync)
        const serverData = await fetchUserData();
        if (serverData) {
          if (serverData.profile?.name)          setProfile(serverData.profile);
          if (Array.isArray(serverData.outputs)) setOutputs(serverData.outputs);
          if (Array.isArray(serverData.todos))   setTodos(serverData.todos);
          if (serverData.integrations)           setIntegrations(serverData.integrations);
          if (serverData.creds)                  setCreds(serverData.creds);
          if (serverData.lastSync)               setLastSync(serverData.lastSync);
          setHydrated(true);
          return;
        }
      } catch {
        // Supabase failed — fall back to local cache
      }

      // Fall back to AsyncStorage (offline / first load)
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const data = JSON.parse(raw);
          if (data.profile)                    setProfile(data.profile);
          if (Array.isArray(data.outputs))     setOutputs(data.outputs);
          if (Array.isArray(data.todos))       setTodos(data.todos);
          if (data.integrations)               setIntegrations(data.integrations);
          if (data.creds)                      setCreds(data.creds);
          if (data.lastSync)                   setLastSync(data.lastSync);
        }
      } catch { /* ignore */ }

      setHydrated(true);
    })();
  }, [user.id]);

  // ── 2. Save to both Supabase + AsyncStorage on every change ─
  useEffect(() => {
    if (!hydrated) return;
    const payload = { profile, outputs, todos, integrations, creds, lastSync, lastSaved: new Date().toISOString() };

    // Local cache (instant, offline-safe)
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload)).catch(() => {});

    // Supabase (cross-device sync)
    saveUserData(payload).catch((err) => console.error("Supabase save error:", err));
  }, [hydrated, profile, outputs, todos, integrations, creds, lastSync]);

  // ── 3. Hourly sync ───────────────────────────────────────────
  useEffect(() => {
    if (!hydrated) return;
    const id = setInterval(() => { handleSync(); }, 3600000);
    return () => clearInterval(id);
  }, [hydrated, creds, outputs, integrations]);

  // ── 4. Sync function ─────────────────────────────────────────
  const handleSync = useCallback(async (platform = null) => {
    if (syncing) return;
    setSyncing(true);
    const newIntegrations = { ...integrations };

    const doSync = async (key, fn) => {
      try {
        newIntegrations[key] = { status: "loading", count: 0, error: null };
        setIntegrations({ ...newIntegrations });
        const res = await fn();
        newIntegrations[key] = { status: "ok", count: res.length, error: null };
        setOutputs((prev) => [...prev.filter((o) => o.source !== key), ...res]);
      } catch (e) {
        newIntegrations[key] = { status: "error", count: 0, error: e.message ?? String(e) };
        setIntegrations({ ...newIntegrations });
      }
    };

    try {
      if (!platform || platform === "orcid")    { if (creds.orcidId)        await doSync("orcid",  () => fetchORCID(creds.orcidId).then(enrichWithCitations)); }
      if (!platform || platform === "zenodo")   { if (creds.zenodoToken)    await doSync("zenodo", () => fetchZenodo(creds.zenodoToken)); }
      if (!platform || platform === "github")   { if (creds.githubUsername) await doSync("github", () => fetchGitHub(creds.githubUsername)); }
      if (!platform || platform === "crossref") {
        const existing = outputs.filter((o) => o.doi && ["Paper", "Preprint", "Report"].includes(o.type));
        if (existing.length > 0) {
          newIntegrations.crossref = { status: "loading", count: 0, error: null };
          setIntegrations({ ...newIntegrations });
          const enriched = await enrichWithCitations(existing);
          setOutputs((prev) => prev.map((o) => enriched.find((e) => e.id === o.id) || o));
          newIntegrations.crossref = { status: "ok", count: enriched.length, error: null };
          setIntegrations({ ...newIntegrations });
        }
      }
      setLastSync(new Date().toISOString());
    } finally {
      setSyncing(false);
    }
  }, [syncing, creds, integrations, outputs]);

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" />
      <ExpoStatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.appName}>Reeza</Text>
          <Text style={styles.subtitle}>{profile.name || "Your research hub"}</Text>
        </View>
        <View style={{ alignItems: "flex-end", gap: 4 }}>
          {lastSync && <Text style={styles.lastSync}>synced {new Date(lastSync).toLocaleTimeString()}</Text>}
          <TouchableOpacity onPress={signOut} style={styles.signOutButton}>
            <Text style={styles.signOutText}>Sign out</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {TABS.map((tab) => {
          const active = view === tab.id;
          return (
            <TouchableOpacity key={tab.id} style={[styles.tabButton, active && styles.tabButtonActive]} onPress={() => setView(tab.id)}>
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Content */}
      <View style={styles.content}>
        {view === "dashboard"    && <DashboardScreen    outputs={outputs} todos={todos} integrations={integrations} syncing={syncing} onSync={handleSync} />}
        {view === "projects"     && <ProjectsScreen     outputs={outputs} setOutputs={setOutputs} integrations={integrations} onSync={handleSync} syncing={syncing} />}
        {view === "integrations" && <IntegrationsScreen creds={creds} setCreds={setCreds} integrations={integrations} onSync={handleSync} syncing={syncing} />}
        {view === "todo"         && <TodoScreen         todos={todos} setTodos={setTodos} />}
      </View>
    </SafeAreaView>
  );
}

/* ─── PROJECTS SCREEN (unchanged) ───────────────────────── */
function ProjectsScreen({ outputs, setOutputs, integrations, onSync, syncing }) {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [type, setType] = useState("Paper");

  const grouped = {};
  outputs.forEach((o) => { const k = o.year || "Unknown"; if (!grouped[k]) grouped[k] = []; grouped[k].push(o); });
  const years = Object.keys(grouped).sort((a, b) => b - a);

  const handleAdd = () => {
    if (!title.trim()) return;
    const y = parseInt(year, 10);
    setOutputs((prev) => [...prev, { id: `manual-${Date.now()}`, type: type || "Paper", title: title.trim(), platform: "Manual", year: Number.isNaN(y) ? null : y, citations: 0, downloads: 0, stars: 0, doi: "", version: "", source: "manual" }]);
    setTitle(""); setYear(String(new Date().getFullYear())); setType("Paper"); setShowForm(false);
  };

  const anySyncing = syncing || Object.values(integrations).some((i) => i.status === "loading");

  return (
    <ScrollView contentContainerStyle={styles.projectsScroll}>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>{outputs.length} Research Outputs</Text>
        <TouchableOpacity style={styles.syncButton} onPress={() => onSync(null)} disabled={anySyncing}>
          {anySyncing ? <ActivityIndicator size="small" color="#c4b5fd" /> : <Text style={styles.syncButtonText}>Sync All</Text>}
        </TouchableOpacity>
      </View>

      {outputs.length === 0 && <Text style={styles.mutedText}>No outputs yet. Connect ORCID / Zenodo / GitHub, or add one manually.</Text>}

      <TouchableOpacity style={styles.addTaskButton} onPress={() => setShowForm((v) => !v)}>
        <Text style={styles.addTaskButtonText}>{showForm ? "Cancel" : "+ Add Output"}</Text>
      </TouchableOpacity>

      {showForm && (
        <View style={styles.addForm}>
          <Text style={styles.fieldLabel}>Title</Text>
          <TextInput style={styles.input} placeholder="Full title" placeholderTextColor="#64748b" value={title} onChangeText={setTitle} />
          <View style={styles.addFormRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Type</Text>
              <TextInput style={styles.input} placeholder="Paper, Dataset, Code…" placeholderTextColor="#64748b" value={type} onChangeText={setType} />
            </View>
            <View style={{ width: 90 }}>
              <Text style={styles.fieldLabel}>Year</Text>
              <TextInput style={styles.input} placeholder="2024" placeholderTextColor="#64748b" keyboardType="numeric" value={year} onChangeText={setYear} />
            </View>
          </View>
          <TouchableOpacity style={styles.primaryButton} onPress={handleAdd}>
            <Text style={styles.primaryButtonText}>Save Output</Text>
          </TouchableOpacity>
        </View>
      )}

      {years.map((y) => (
        <View key={y} style={styles.projectYearBlock}>
          <Text style={styles.projectYearLabel}>{y}</Text>
          {grouped[y].map((o) => {
            const inPortfolio = !!o.inPortfolio;
            return (
              <View key={o.id} style={[styles.projectCard, inPortfolio && styles.projectCardPortfolio]}>
                {/* Portfolio checkbox row */}
                <TouchableOpacity
                  onPress={() => setOutputs(prev => prev.map(x => x.id === o.id ? { ...x, inPortfolio: !x.inPortfolio } : x))}
                  style={styles.portfolioRow}
                  activeOpacity={0.7}
                >
                  <View style={[styles.portfolioCheckbox, inPortfolio && styles.portfolioCheckboxChecked]}>
                    {inPortfolio && <Text style={styles.portfolioCheckmark}>✓</Text>}
                  </View>
                  <Text style={[styles.portfolioLabel, inPortfolio && styles.portfolioLabelActive]}>
                    {inPortfolio ? "In portfolio" : "Add to portfolio"}
                  </Text>
                </TouchableOpacity>

                <View style={styles.projectHeaderRow}>
                  <Text style={styles.projectTitle}>{o.title}</Text>
                </View>
                <View style={styles.projectMetaRow}>
                  <View style={styles.pillRow}>
                    <View style={[styles.pill, { backgroundColor: "rgba(15,23,42,0.9)", borderColor: typeColor(o.type) }]}>
                      <Text style={[styles.pillText, { color: typeColor(o.type) }]}>{typeIcon[o.type] || "📄"} {o.type}</Text>
                    </View>
                    {o.platform ? <View style={styles.pillMuted}><Text style={styles.pillMutedText}>{o.platform}</Text></View> : null}
                  </View>
                  <View style={styles.statsRow}>
                    {o.citations > 0 && <Text style={[styles.statText, { color: V }]}>📎 {o.citations}</Text>}
                    {o.downloads > 0 && <Text style={[styles.statText, { color: G }]}>⬇ {o.downloads.toLocaleString()}</Text>}
                    {o.stars > 0    && <Text style={[styles.statText, { color: A }]}>⭐ {o.stars}</Text>}
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      ))}
      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

/* ─── TODO SCREEN (unchanged) ───────────────────────────── */
function TodoScreen({ todos, setTodos }) {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [due, setDue] = useState("");

  const pending = todos.filter((t) => !t.done);
  const done    = todos.filter((t) => t.done);

  const toggle = (id) => setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));

  const handleAdd = () => {
    if (!title.trim()) return;
    setTodos((prev) => [...prev, { id: `todo-${Date.now()}`, title: title.trim(), priority, due, done: false }]);
    setTitle(""); setPriority("Medium"); setDue(""); setShowForm(false);
  };

  const cyclePriority = () => setPriority((p) => p === "Low" ? "Medium" : p === "Medium" ? "High" : "Low");
  const priorityColor = priority === "High" ? "#f97316" : priority === "Medium" ? "#38bdf8" : "#64748b";

  return (
    <ScrollView contentContainerStyle={styles.todoScroll}>
      <View style={styles.todoHeaderRow}>
        <Text style={styles.sectionTitle}>{todos.length} Tasks</Text>
        <TouchableOpacity style={styles.addTaskButton} onPress={() => setShowForm((v) => !v)}>
          <Text style={styles.addTaskButtonText}>{showForm ? "Cancel" : "+ Add Task"}</Text>
        </TouchableOpacity>
      </View>

      {showForm && (
        <View style={styles.addForm}>
          <Text style={styles.fieldLabel}>Title</Text>
          <TextInput style={styles.input} placeholder="What needs to be done?" placeholderTextColor="#64748b" value={title} onChangeText={setTitle} />
          <View style={styles.addFormRow}>
            <TouchableOpacity style={styles.priorityBadge} onPress={cyclePriority}>
              <Text style={[styles.priorityBadgeText, { color: priorityColor }]}>Priority: {priority}</Text>
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Due (optional)</Text>
              <TextInput style={styles.input} placeholder="YYYY-MM-DD" placeholderTextColor="#64748b" value={due} onChangeText={setDue} />
            </View>
          </View>
          <TouchableOpacity style={styles.primaryButton} onPress={handleAdd}>
            <Text style={styles.primaryButtonText}>Save Task</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.todoSectionTitle}>Pending</Text>
      {pending.length === 0 ? <Text style={styles.mutedText}>All caught up. 🎉</Text> : pending.map((t) => (
        <TouchableOpacity key={t.id} style={styles.todoItemRow} onPress={() => toggle(t.id)}>
          <View style={styles.todoDot} />
          <View style={{ flex: 1 }}>
            <Text style={styles.todoItemText}>{t.title}</Text>
            <Text style={styles.todoMetaText}>{t.priority}{t.due ? ` · Due ${t.due}` : ""}</Text>
          </View>
        </TouchableOpacity>
      ))}

      {done.length > 0 && <>
        <Text style={styles.todoSectionTitle}>Completed</Text>
        {done.map((t) => (
          <TouchableOpacity key={t.id} style={[styles.todoItemRow, { opacity: 0.6 }]} onPress={() => toggle(t.id)}>
            <View style={[styles.todoDot, { backgroundColor: "#22c55e" }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.todoItemTextDone}>{t.title}</Text>
              <Text style={styles.todoMetaText}>{t.priority}{t.due ? ` · Due ${t.due}` : ""}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </>}
      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

/* ─── DASHBOARD SCREEN (unchanged) ──────────────────────── */
function DashboardScreen({ outputs, todos, integrations, syncing, onSync }) {
  const pubs      = outputs.filter((o) => ["Paper","Preprint","Report"].includes(o.type)).length;
  const datasets  = outputs.filter((o) => o.type === "Dataset").length;
  const repos     = outputs.filter((o) => ["Code","Software"].includes(o.type)).length;
  const citations = outputs.reduce((s, o) => s + (o.citations || 0), 0);
  const downloads = outputs.reduce((s, o) => s + (o.downloads || 0), 0);
  const stars     = outputs.reduce((s, o) => s + (o.stars || 0), 0);
  const pending   = todos.filter((t) => !t.done);

  const byType = ["Paper","Preprint","Dataset","Code","Software","Talk","Poster","Report"]
    .map((t) => ({ t, n: outputs.filter((o) => o.type === t).length })).filter((x) => x.n > 0);

  return (
    <ScrollView contentContainerStyle={styles.dashboardScroll}>
      <View style={styles.metricRow}>
        <MetricCard icon="📄" label="Publications" value={pubs}     color={V} />
        <MetricCard icon="📊" label="Datasets"     value={datasets} color={G} sub={`${downloads.toLocaleString()} downloads`} />
      </View>
      <View style={styles.metricRow}>
        <MetricCard icon="💻" label="Code"      value={repos}     color={A} sub={`${stars} ⭐`} />
        <MetricCard icon="📎" label="Citations" value={citations} color={B} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Output Types</Text>
        {byType.length === 0
          ? <Text style={styles.mutedText}>No outputs yet — connect a source below.</Text>
          : byType.map((x) => (
            <View key={x.t} style={styles.typeRow}>
              <Text style={styles.typeLabel}>{typeIcon[x.t]} {x.t}</Text>
              <Text style={[styles.typeCount, { color: typeColor(x.t) }]}>{x.n}</Text>
            </View>
          ))
        }
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Pending Tasks</Text>
          <Text style={styles.mutedText}>{pending.length} open</Text>
        </View>
        {pending.length === 0
          ? <Text style={styles.mutedText}>Nothing pending. 🎉</Text>
          : pending.slice(0, 5).map((t) => (
            <View key={t.id} style={styles.todoRow}>
              <View style={styles.todoDot} />
              <Text style={styles.todoText}>{t.title}</Text>
            </View>
          ))
        }
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Live Data Sources</Text>
          <TouchableOpacity style={styles.syncButton} onPress={() => onSync(null)} disabled={syncing}>
            {syncing ? <ActivityIndicator size="small" color="#c4b5fd" /> : <Text style={styles.syncButtonText}>Sync All</Text>}
          </TouchableOpacity>
        </View>
        {["orcid","zenodo","github","crossref"].map((key) => {
          const state = integrations[key] || {};
          const isOk      = state.status === "ok";
          const isLoading = state.status === "loading";
          const label = key === "orcid" ? "ORCID" : key === "zenodo" ? "Zenodo" : key === "github" ? "GitHub" : "CrossRef";
          return (
            <View key={key} style={[styles.integrationRow, isOk && { borderColor: "rgba(34,197,94,0.5)" }]}>
              <Text style={styles.integrationLabel}>{label}</Text>
              <View style={styles.integrationStatusRow}>
                {isLoading && <ActivityIndicator size="small" color="#94a3b8" />}
                <Text style={[styles.integrationStatus, isOk && { color: "#22c55e" }, state.status === "error" && { color: "#f97373" }]}>
                  {state.status === "ok" ? `Connected (${state.count ?? 0})` : state.status === "loading" ? "Syncing…" : state.status === "error" ? "Error" : "Not set"}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

/* ─── INTEGRATIONS SCREEN (unchanged) ───────────────────── */
function IntegrationsScreen({ creds, setCreds, integrations, onSync, syncing }) {
  return (
    <ScrollView contentContainerStyle={styles.integrationsScroll}>
      <Text style={styles.sectionTitle}>Connect your sources</Text>

      {[
        { key: "orcid",   label: "ORCID ID",        credKey: "orcidId",        placeholder: "0000-0001-2345-6789",    secure: false },
        { key: "zenodo",  label: "Zenodo Token",     credKey: "zenodoToken",    placeholder: "Personal access token",  secure: true  },
        { key: "github",  label: "GitHub Username",  credKey: "githubUsername", placeholder: "your-github-handle",     secure: false },
      ].map((s) => (
        <View key={s.key} style={styles.integrationBlock}>
          <Text style={styles.fieldLabel}>{s.label}</Text>
          <TextInput
            style={styles.input}
            placeholder={s.placeholder}
            placeholderTextColor="#64748b"
            value={creds[s.credKey]}
            onChangeText={(text) => setCreds((c) => ({ ...c, [s.credKey]: text }))}
            autoCapitalize="none"
            secureTextEntry={s.secure}
          />
          <TouchableOpacity style={styles.primaryButton} onPress={() => onSync(s.key)} disabled={!creds[s.credKey] || syncing}>
            <Text style={styles.primaryButtonText}>{syncing ? "Syncing…" : `Save & Sync ${s.label.split(" ")[0]}`}</Text>
          </TouchableOpacity>
          {integrations[s.key]?.error && <Text style={styles.errorText}>{integrations[s.key].error}</Text>}
        </View>
      ))}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

/* ─── METRIC CARD (unchanged) ───────────────────────────── */
function MetricCard({ icon, label, value, color, sub }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricIcon}>{icon}</Text>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
      {sub ? <Text style={styles.metricSub}>{sub}</Text> : null}
    </View>
  );
}

/* ─── STYLES ─────────────────────────────────────────────── */
const styles = StyleSheet.create({
  root:              { flex: 1, backgroundColor: "#04080f" },
  header:            { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8, backgroundColor: "#0a0e18", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(148,163,184,0.4)", flexDirection: "row", alignItems: "center" },
  appName:           { color: "#e2e8f0", fontSize: 22, fontWeight: "700" },
  subtitle:          { color: "#64748b", fontSize: 12, marginTop: 4 },
  lastSync:          { color: "#475569", fontSize: 10 },
  signOutButton:     { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.1)" },
  signOutText:       { color: "#475569", fontSize: 12 },
  tabRow:            { flexDirection: "row", paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#020617" },
  tabButton:         { flex: 1, paddingVertical: 8, marginHorizontal: 4, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: "transparent", alignItems: "center" },
  tabButtonActive:   { backgroundColor: "rgba(139,92,246,0.25)", borderColor: "rgba(139,92,246,0.6)" },
  tabLabel:          { color: "#64748b", fontSize: 13, fontWeight: "500" },
  tabLabelActive:    { color: "#c4b5fd" },
  content:           { flex: 1, paddingHorizontal: 20, paddingVertical: 16 },
  dashboardScroll:   { paddingBottom: 40 },
  integrationsScroll:{ paddingBottom: 40 },
  projectsScroll:    { paddingBottom: 40 },
  todoScroll:        { paddingBottom: 40 },
  metricRow:         { flexDirection: "row", gap: 12, marginBottom: 12 },
  metricCard:        { flex: 1, padding: 14, borderRadius: 12, backgroundColor: "rgba(15,23,42,0.9)", borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(148,163,184,0.5)" },
  metricIcon:        { fontSize: 20, marginBottom: 4 },
  metricValue:       { fontSize: 24, fontWeight: "800" },
  metricLabel:       { color: "#e2e8f0", fontSize: 12, marginTop: 4 },
  metricSub:         { color: "#64748b", fontSize: 11, marginTop: 2 },
  section:           { marginTop: 20 },
  sectionTitle:      { color: "#e2e8f0", fontSize: 16, fontWeight: "700", marginBottom: 8 },
  sectionHeaderRow:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  mutedText:         { color: "#64748b", fontSize: 13 },
  typeRow:           { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  typeLabel:         { color: "#cbd5e1", fontSize: 13 },
  typeCount:         { fontSize: 13, fontWeight: "700" },
  todoRow:           { flexDirection: "row", alignItems: "center", marginTop: 4 },
  todoDot:           { width: 6, height: 6, borderRadius: 3, backgroundColor: "#f97316", marginRight: 8 },
  todoText:          { color: "#e5e7eb", fontSize: 13, flex: 1 },
  integrationRow:    { marginTop: 6, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: "rgba(31,41,55,1)", flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  integrationLabel:  { color: "#e5e7eb", fontSize: 13 },
  integrationStatusRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  integrationStatus: { color: "#9ca3af", fontSize: 12 },
  syncButton:        { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(129,140,248,0.8)" },
  syncButtonText:    { color: "#c4b5fd", fontSize: 12, fontWeight: "600" },
  integrationBlock:  { marginTop: 18 },
  fieldLabel:        { color: "#e2e8f0", fontSize: 12, marginBottom: 4 },
  input:             { borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(148,163,184,0.6)", paddingHorizontal: 10, paddingVertical: 8, color: "#e5e7eb", marginBottom: 8, fontSize: 13 },
  primaryButton:     { backgroundColor: "rgba(129,140,248,0.32)", borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  primaryButtonText: { color: "#e0e7ff", fontSize: 13, fontWeight: "700" },
  errorText:         { color: "#f97373", fontSize: 12, marginTop: 4 },
  projectYearBlock:  { marginTop: 18 },
  projectYearLabel:  { color: "#a5b4fc", fontSize: 12, marginBottom: 4 },
  projectCard:       { backgroundColor: "rgba(15,23,42,0.95)", borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(148,163,184,0.5)" },
  projectHeaderRow:  { flexDirection: "row", justifyContent: "space-between" },
  projectTitle:      { color: "#e5e7eb", fontSize: 14, fontWeight: "600" },
  projectMetaRow:    { marginTop: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  pillRow:           { flexDirection: "row", gap: 6 },
  pill:              { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
  pillText:          { fontSize: 11, fontWeight: "600" },
  pillMuted:         { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: "rgba(31,41,55,0.9)" },
  pillMutedText:     { fontSize: 11, color: "#9ca3af" },
  statsRow:          { flexDirection: "row", gap: 8 },
  statText:          { fontSize: 11 },
  todoHeaderRow:     { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  addTaskButton:     { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(129,140,248,0.8)", alignSelf: "flex-start", marginVertical: 4 },
  addTaskButtonText: { color: "#c4b5fd", fontSize: 12, fontWeight: "600" },
  addForm:           { marginTop: 8, padding: 10, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(55,65,81,1)", backgroundColor: "rgba(15,23,42,0.95)" },
  addFormRow:        { flexDirection: "row", gap: 10, alignItems: "center", marginTop: 4, marginBottom: 8 },
  todoSectionTitle:  { color: "#e5e7eb", fontSize: 13, fontWeight: "700", marginTop: 16, marginBottom: 4 },
  todoItemRow:       { flexDirection: "row", alignItems: "center", paddingVertical: 8 },
  todoItemText:      { color: "#e5e7eb", fontSize: 13 },
  todoItemTextDone:  { color: "#9ca3af", fontSize: 13, textDecorationLine: "line-through" },
  todoMetaText:      { color: "#64748b", fontSize: 11, marginTop: 2 },
  priorityBadge:     { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(148,163,184,0.7)" },
  priorityBadgeText: { fontSize: 11, fontWeight: "600" },

  // Portfolio checkbox
  projectCardPortfolio: { borderColor: "rgba(139,92,246,0.5)", backgroundColor: "rgba(139,92,246,0.06)" },
  portfolioRow:         { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  portfolioCheckbox:    { width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center", backgroundColor: "transparent" },
  portfolioCheckboxChecked: { borderColor: "#8b5cf6", backgroundColor: "#8b5cf6", shadowColor: "#8b5cf6", shadowOpacity: 0.5, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
  portfolioCheckmark:   { color: "#fff", fontSize: 12, fontWeight: "800", lineHeight: 14 },
  portfolioLabel:       { fontSize: 11, color: "rgba(255,255,255,0.3)", fontWeight: "600" },
  portfolioLabelActive: { color: "#a78bfa" },
});