import React, { useState, useEffect, useCallback, useRef } from "react";
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
  Platform,
} from "react-native";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AuthProvider, useAuth } from "./AuthContext.js";
import AuthScreen from "./AuthScreen.js";
import { fetchUserData, saveUserData, subscribeToUserData } from "./api-client.js";
import { getVisibleItems, markItemUpdated, mergeUserData, normalizeUserData, nowIso, sanitizeIntegrations, stampSection } from "./sync-utils.js";

const V = "#8b5cf6";
const G = "#22d3a5";
const A = "#f59e0b";
const B = "#38bdf8";
const HEADER_FONT = Platform.select({ ios: "AvenirNext-DemiBold", android: "sans-serif-medium", default: "System" });

const STORAGE_KEY = "reeza_user_data";
const SYNC_DEBOUNCE_MS = 450;

const typeIcon = {
  Paper: "P", Preprint: "PR", Dataset: "DS", Code: "<>",
  Software: "SW", Talk: "TK", Poster: "PT", Report: "RP",
};

const typeColor = (t) =>
  ({ Paper: V, Preprint: "#a78bfa", Dataset: G, Code: A, Software: "#fb923c", Talk: "#f472b6", Poster: "#e879f9", Report: B }[t] || "#94a3b8");

function GlyphBadge({ label, color, size = 34, fontSize = 12 }) {
  return (
    <View style={{
      width: size,
      height: size,
      borderRadius: Math.max(12, size * 0.34),
      backgroundColor: `${color}20`,
      borderWidth: 1,
      borderColor: `${color}55`,
      alignItems: "center",
      justifyContent: "center",
    }}>
      <Text style={{ color, fontSize, fontWeight: "800" }}>{label}</Text>
    </View>
  );
}

/* â”€â”€â”€ EXTERNAL API FETCHERS (unchanged) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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
  if (!res.ok) throw new Error(`GitHub error: ${res.status} - check username`);
  const repos = await res.json();
  return repos.filter((r) => !r.fork).map((r) => ({ id: `gh-${r.id}`, type: "Code", title: r.name, platform: "GitHub", year: r.created_at ? +r.created_at.slice(0, 4) : null, citations: 0, downloads: 0, stars: r.stargazers_count || 0, doi: "", version: "", source: "github", description: r.description || "", language: r.language || "" }));
}

/* â”€â”€â”€ TABS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const TABS = [
  { id: "dashboard",    label: "Dashboard"    },
  { id: "projects",     label: "Projects"     },
  { id: "integrations", label: "Integrations" },
  { id: "todo",         label: "Todo"         },
];

/* â”€â”€â”€ AUTH GATE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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
        <View style={{ position: "absolute", top: 90, left: 20, width: 180, height: 180, borderRadius: 999, backgroundColor: "rgba(56,189,248,0.08)" }} />
        <View style={{ position: "absolute", top: 40, right: 16, width: 220, height: 220, borderRadius: 999, backgroundColor: "rgba(139,92,246,0.08)" }} />
        <View style={{ paddingHorizontal: 30, paddingVertical: 26, borderRadius: 28, borderWidth: 1, borderColor: "rgba(139,92,246,0.28)", backgroundColor: "rgba(13,18,32,0.96)", alignItems: "center", shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 24, shadowOffset: { width: 0, height: 16 }, elevation: 18 }}>
          <View style={{ width: 60, height: 60, borderRadius: 20, backgroundColor: V, marginBottom: 16, shadowColor: V, shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 10 }}>
            <View style={{ flex: 1, margin: 2, borderRadius: 20, backgroundColor: B, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "#fff", fontSize: 24, fontWeight: "800" }}>R</Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <ActivityIndicator color="#eef2ff" size="small" />
            <View>
              <Text style={{ color: "#e2e8f0", fontSize: 15, fontWeight: "700" }}>Loading your workspace</Text>
              <Text style={{ color: "#7b8aa5", fontSize: 12, marginTop: 2 }}>Syncing profile, tasks, and research signals</Text>
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (!session) {
    return <AuthScreen signIn={signIn} signUp={signUp} />;
  }

  return <AppInner user={session.user} />;
}

/* â”€â”€â”€ MAIN APP â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function AppInner({ user }) {
  const { signOut } = useAuth();
  const [view, setView] = useState("dashboard");
  const [hydrated, setHydrated] = useState(false);

  const defaultTodos = [
    markItemUpdated({ id: "1", createdAt: nowIso() }, { title: "Finish Q1 research paper", priority: "High", due: "2024-03-15", done: false }),
    markItemUpdated({ id: "2", createdAt: nowIso() }, { title: "Update GitHub repos documentation", priority: "Medium", due: "", done: false }),
    markItemUpdated({ id: "3", createdAt: nowIso() }, { title: "Submit dataset to Zenodo", priority: "High", due: "2024-03-20", done: false }),
  ];
  const defaultIntegrations = sanitizeIntegrations({
    orcid:    { status: "idle", count: 0, error: null },
    zenodo:   { status: "idle", count: 0, error: null },
    github:   { status: "idle", count: 0, error: null },
    crossref: { status: "idle", count: 0, error: null },
  });

  const [profile,      setProfile]      = useState(stampSection({}, { name: "Researcher", affiliation: "", bio: "" }));
  const [outputs,      setOutputs]      = useState([]);
  const [todos,        setTodos]        = useState(defaultTodos);
  const [integrations, setIntegrations] = useState(defaultIntegrations);
  const [creds,    setCreds]    = useState(stampSection({}, { orcidId: "", zenodoToken: "", githubUsername: "" }));
  const [lastSync, setLastSync] = useState(null);
  const [syncing,  setSyncing]  = useState(false);
  const applyingRemoteRef = useRef(false);
  const saveTimerRef = useRef(null);
  const saveInFlightRef = useRef(false);
  const saveQueuedRef = useRef(false);
  const latestSnapshotRef = useRef(null);

  const applySnapshot = useCallback((data) => {
    if (!data) return;
    const normalized = normalizeUserData(data);
    applyingRemoteRef.current = true;
    latestSnapshotRef.current = normalized;
    setProfile(normalized.profile);
    setOutputs(normalized.outputs);
    setTodos(normalized.todos);
    setIntegrations(normalized.integrations);
    setCreds(normalized.creds);
    setLastSync(normalized.lastSync);
  }, []);

  const flushSave = useCallback(async (snapshot) => {
    if (!snapshot) return;
    if (saveInFlightRef.current) {
      saveQueuedRef.current = true;
      return;
    }

    saveInFlightRef.current = true;
    try {
      const saved = await saveUserData(snapshot);
      if (saved) {
        latestSnapshotRef.current = saved;
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(saved)).catch(() => {});
        applySnapshot(saved);
      }
    } catch (err) {
      console.error("Supabase save error:", err);
    } finally {
      saveInFlightRef.current = false;
      if (saveQueuedRef.current) {
        saveQueuedRef.current = false;
        await flushSave(latestSnapshotRef.current);
      }
    }
  }, [applySnapshot]);

  // â”€â”€ 1. Load from Supabase first, fall back to AsyncStorage â”€â”€
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const serverData = await fetchUserData();
        if (!cancelled && serverData) {
          applySnapshot(serverData);
          setHydrated(true);
          return;
        }
      } catch {
        // Supabase failed - fall back to local cache
      }

      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!cancelled && raw) {
          applySnapshot(JSON.parse(raw));
        }
      } catch {
        // ignore local cache parse issues
      }

      if (!cancelled) {
        setHydrated(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [applySnapshot, user.id]);

  useEffect(() => {
    let unsubscribe = null;
    let active = true;

    (async () => {
      try {
        unsubscribe = await subscribeToUserData((remoteData) => {
          if (!active || !remoteData) return;
          applySnapshot(mergeUserData(remoteData, latestSnapshotRef.current));
        });
      } catch {
        // Realtime is optional on mobile, so we can continue without it.
      }
    })();

    return () => {
      active = false;
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [applySnapshot, user.id]);

  // â”€â”€ 2. Save to both Supabase + AsyncStorage on every change â”€
  useEffect(() => {
    const payload = normalizeUserData({ profile, outputs, todos, integrations, creds, lastSync });
    latestSnapshotRef.current = payload;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload)).catch(() => {});

    if (!hydrated) return;

    if (applyingRemoteRef.current) {
      applyingRemoteRef.current = false;
      return;
    }

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      void flushSave(latestSnapshotRef.current);
    }, SYNC_DEBOUNCE_MS);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [creds, flushSave, hydrated, integrations, lastSync, outputs, profile, todos]);

  // â”€â”€ 3. Hourly sync â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    if (!hydrated) return;
    const id = setInterval(() => { handleSync(); }, 3600000);
    return () => clearInterval(id);
  }, [hydrated, creds, outputs, integrations]);

  // â”€â”€ 4. Sync function â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleSync = useCallback(async (platform = null) => {
    if (syncing) return;
    setSyncing(true);
    const workingIntegrations = sanitizeIntegrations(integrations);

    const setIntegrationState = (key, nextState) => {
      workingIntegrations[key] = { ...workingIntegrations[key], ...nextState };
      setIntegrations(stampSection(workingIntegrations, {}));
    };

    const doSync = async (key, fn) => {
      try {
        setIntegrationState(key, { status: "loading", count: 0, error: null });
        const res = await fn();
        setIntegrationState(key, { status: "ok", count: res.length, error: null });
        setOutputs((current) => {
          const previousById = new Map(current.map((output) => [output.id, output]));
          const nextSourceOutputs = res.map((output) => markItemUpdated(previousById.get(output.id) || output, output));
          return [...current.filter((output) => output.source !== key), ...nextSourceOutputs];
        });
      } catch (e) {
        setIntegrationState(key, { status: "error", count: 0, error: e.message ?? String(e) });
      }
    };

    try {
      if (!platform || platform === "orcid")    { if (creds.orcidId)        await doSync("orcid",  () => fetchORCID(creds.orcidId).then(enrichWithCitations)); }
      if (!platform || platform === "zenodo")   { if (creds.zenodoToken)    await doSync("zenodo", () => fetchZenodo(creds.zenodoToken)); }
      if (!platform || platform === "github")   { if (creds.githubUsername) await doSync("github", () => fetchGitHub(creds.githubUsername)); }
      if (!platform || platform === "crossref") {
        const existing = getVisibleItems(outputs).filter((o) => o.doi && ["Paper", "Preprint", "Report"].includes(o.type));
        if (existing.length > 0) {
          setIntegrationState("crossref", { status: "loading", count: 0, error: null });
          const enriched = await enrichWithCitations(existing);
          setOutputs((current) => current.map((output) => {
            const nextOutput = enriched.find((item) => item.id === output.id);
            return nextOutput ? markItemUpdated(output, nextOutput) : output;
          }));
          setIntegrationState("crossref", { status: "ok", count: enriched.length, error: null });
        }
      }
      setLastSync(nowIso());
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
          <Text style={styles.headerEyebrow}>Unified workspace</Text>
          <Text style={styles.appName}>{profile.name || "Researcher"}</Text>
          <Text style={styles.subtitle}>{profile.affiliation || "Cross-device research hub"}</Text>
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

/* â”€â”€â”€ PROJECTS SCREEN (unchanged) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function ProjectsScreen({ outputs, setOutputs, integrations, onSync, syncing }) {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [type, setType] = useState("Paper");
  const visibleOutputs = getVisibleItems(outputs);

  const grouped = {};
  visibleOutputs.forEach((o) => { const k = o.year || "Unknown"; if (!grouped[k]) grouped[k] = []; grouped[k].push(o); });
  const years = Object.keys(grouped).sort((a, b) => b - a);

  const handleAdd = () => {
    if (!title.trim()) return;
    const y = parseInt(year, 10);
    setOutputs((current) => [
      ...current,
      markItemUpdated(
        {
          id: `manual-${Date.now()}`,
          source: "manual",
          createdAt: nowIso(),
        },
        {
          type: type || "Paper",
          title: title.trim(),
          platform: "Manual",
          year: Number.isNaN(y) ? null : y,
          citations: 0,
          downloads: 0,
          stars: 0,
          doi: "",
          version: "",
        },
      ),
    ]);
    setTitle(""); setYear(String(new Date().getFullYear())); setType("Paper"); setShowForm(false);
  };

  const anySyncing = syncing || Object.values(integrations).some((i) => i.status === "loading");

  return (
    <ScrollView contentContainerStyle={styles.projectsScroll}>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>{visibleOutputs.length} Research Outputs</Text>
        <TouchableOpacity style={styles.syncButton} onPress={() => onSync(null)} disabled={anySyncing}>
          {anySyncing ? <ActivityIndicator size="small" color="#c4b5fd" /> : <Text style={styles.syncButtonText}>Sync All</Text>}
        </TouchableOpacity>
      </View>

      {visibleOutputs.length === 0 && <Text style={styles.mutedText}>No outputs yet. Connect ORCID / Zenodo / GitHub, or add one manually.</Text>}

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
              <TextInput style={styles.input} placeholder="Paper, Dataset, Code..." placeholderTextColor="#64748b" value={type} onChangeText={setType} />
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
                  onPress={() => setOutputs((current) => current.map((output) => (
                    output.id === o.id ? markItemUpdated(output, { inPortfolio: !output.inPortfolio }) : output
                  )))}
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
                      <View style={styles.pillTypeWrap}>
                        <GlyphBadge label={typeIcon[o.type] || "P"} color={typeColor(o.type)} size={20} fontSize={8} />
                        <Text style={[styles.pillText, { color: typeColor(o.type) }]}>{o.type}</Text>
                      </View>
                    </View>
                    {o.platform ? <View style={styles.pillMuted}><Text style={styles.pillMutedText}>{o.platform}</Text></View> : null}
                  </View>
                  <View style={styles.statsRow}>
                    {o.citations > 0 && <Text style={[styles.statText, { color: V }]}>CIT {o.citations}</Text>}
                    {o.downloads > 0 && <Text style={[styles.statText, { color: G }]}>DL {o.downloads.toLocaleString()}</Text>}
                    {o.stars > 0    && <Text style={[styles.statText, { color: A }]}>STAR {o.stars}</Text>}
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

/* â”€â”€â”€ TODO SCREEN (unchanged) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function TodoScreen({ todos, setTodos }) {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [due, setDue] = useState("");
  const visibleTodos = getVisibleItems(todos);

  const pending = visibleTodos.filter((t) => !t.done);
  const done    = visibleTodos.filter((t) => t.done);

  const toggle = (id) => setTodos((current) => current.map((todo) => (
    todo.id === id ? markItemUpdated(todo, { done: !todo.done }) : todo
  )));

  const handleAdd = () => {
    if (!title.trim()) return;
    setTodos((current) => [
      ...current,
      markItemUpdated(
        {
          id: `todo-${Date.now()}`,
          done: false,
          createdAt: nowIso(),
        },
        {
          title: title.trim(),
          priority,
          due,
        },
      ),
    ]);
    setTitle(""); setPriority("Medium"); setDue(""); setShowForm(false);
  };

  const cyclePriority = () => setPriority((p) => p === "Low" ? "Medium" : p === "Medium" ? "High" : "Low");
  const priorityColor = priority === "High" ? "#f97316" : priority === "Medium" ? "#38bdf8" : "#64748b";

  return (
    <ScrollView contentContainerStyle={styles.todoScroll}>
      <View style={styles.todoHeaderRow}>
        <Text style={styles.sectionTitle}>{visibleTodos.length} Tasks</Text>
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
      {pending.length === 0 ? <Text style={styles.mutedText}>All caught up.</Text> : pending.map((t) => (
        <TouchableOpacity key={t.id} style={styles.todoItemRow} onPress={() => toggle(t.id)}>
          <View style={styles.todoDot} />
          <View style={{ flex: 1 }}>
            <Text style={styles.todoItemText}>{t.title}</Text>
            <Text style={styles.todoMetaText}>{t.priority}{t.due ? ` - Due ${t.due}` : ""}</Text>
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
              <Text style={styles.todoMetaText}>{t.priority}{t.due ? ` - Due ${t.due}` : ""}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </>}
      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

/* â”€â”€â”€ DASHBOARD SCREEN (unchanged) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function DashboardScreen({ outputs, todos, integrations, syncing, onSync }) {
  const visibleOutputs = getVisibleItems(outputs);
  const visibleTodos = getVisibleItems(todos);
  const pubs      = visibleOutputs.filter((o) => ["Paper","Preprint","Report"].includes(o.type)).length;
  const datasets  = visibleOutputs.filter((o) => o.type === "Dataset").length;
  const repos     = visibleOutputs.filter((o) => ["Code","Software"].includes(o.type)).length;
  const citations = visibleOutputs.reduce((s, o) => s + (o.citations || 0), 0);
  const downloads = visibleOutputs.reduce((s, o) => s + (o.downloads || 0), 0);
  const stars     = visibleOutputs.reduce((s, o) => s + (o.stars || 0), 0);
  const pending   = visibleTodos.filter((t) => !t.done);

  const byType = ["Paper","Preprint","Dataset","Code","Software","Talk","Poster","Report"]
    .map((t) => ({ t, n: visibleOutputs.filter((o) => o.type === t).length })).filter((x) => x.n > 0);

  return (
    <ScrollView contentContainerStyle={styles.dashboardScroll}>
      <View style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>Dashboard</Text>
        <Text style={styles.heroTitle}>Your research signal overview</Text>
        <Text style={styles.heroBody}>
          Track outputs, citations, datasets, code, and outstanding work from one sync-aware workspace.
        </Text>
        <View style={styles.heroChipRow}>
          <View style={styles.heroChip}><Text style={styles.heroChipText}>Outputs {visibleOutputs.length}</Text></View>
          <View style={styles.heroChip}><Text style={styles.heroChipText}>Tasks {pending.length}</Text></View>
          <View style={styles.heroChip}><Text style={styles.heroChipText}>Sources {Object.values(integrations).filter((x) => x.status === "ok").length}</Text></View>
        </View>
      </View>

      <View style={styles.metricRow}>
        <MetricCard icon="P" label="Publications" value={pubs} color={V} />
        <MetricCard icon="DS" label="Datasets" value={datasets} color={G} sub={`${downloads.toLocaleString()} downloads`} />
      </View>
      <View style={styles.metricRow}>
        <MetricCard icon="<>" label="Code" value={repos} color={A} sub={`${stars.toLocaleString()} stars`} />
        <MetricCard icon="C" label="Citations" value={citations} color={B} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Output Types</Text>
        {byType.length === 0
          ? <Text style={styles.mutedText}>No outputs yet â€” connect a source below.</Text>
          : byType.map((x) => (
            <View key={x.t} style={styles.typeRow}>
              <View style={styles.typeLabelRow}>
                <GlyphBadge label={typeIcon[x.t]} color={typeColor(x.t)} size={22} fontSize={8} />
                <Text style={styles.typeLabel}>{x.t}</Text>
              </View>
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
          ? <Text style={styles.mutedText}>Nothing pending.</Text>
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
                  {state.status === "ok" ? `Connected (${state.count ?? 0})` : state.status === "loading" ? "Syncing..." : state.status === "error" ? "Error" : "Not set"}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

/* â”€â”€â”€ INTEGRATIONS SCREEN (unchanged) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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
            onChangeText={(text) => setCreds((current) => stampSection(current, { [s.credKey]: text }))}
            autoCapitalize="none"
            secureTextEntry={s.secure}
          />
          <TouchableOpacity style={styles.primaryButton} onPress={() => onSync(s.key)} disabled={!creds[s.credKey] || syncing}>
            <Text style={styles.primaryButtonText}>{syncing ? "Syncing..." : `Save & Sync ${s.label.split(" ")[0]}`}</Text>
          </TouchableOpacity>
          {integrations[s.key]?.error && <Text style={styles.errorText}>{integrations[s.key].error}</Text>}
        </View>
      ))}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

/* â”€â”€â”€ METRIC CARD (unchanged) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function MetricCard({ icon, label, value, color, sub }) {
  return (
    <View style={styles.metricCard}>
      <GlyphBadge label={icon} color={color} size={40} fontSize={icon.length > 1 ? 10 : 14} />
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
      {sub ? <Text style={styles.metricSub}>{sub}</Text> : null}
    </View>
  );
}

/* â”€â”€â”€ STYLES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const styles = StyleSheet.create({
  root:              { flex: 1, backgroundColor: "#04080f" },
  header:            { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14, backgroundColor: "#09111d", borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)", flexDirection: "row", alignItems: "center", shadowColor: "#000", shadowOpacity: 0.22, shadowRadius: 20, shadowOffset: { width: 0, height: 12 }, elevation: 10 },
  headerEyebrow:     { color: "#8ba3c7", fontSize: 10, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 4 },
  appName:           { color: "#f8fbff", fontSize: 24, fontWeight: "700", fontFamily: HEADER_FONT, letterSpacing: -0.5 },
  subtitle:          { color: "#6f86a8", fontSize: 12, marginTop: 4 },
  lastSync:          { color: "#4b5d79", fontSize: 10 },
  signOutButton:     { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", backgroundColor: "rgba(255,255,255,0.03)" },
  signOutText:       { color: "#cbd5e1", fontSize: 12, fontWeight: "700" },
  tabRow:            { flexDirection: "row", paddingHorizontal: 14, paddingVertical: 10, backgroundColor: "#050b16", borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.04)" },
  tabButton:         { flex: 1, paddingVertical: 10, marginHorizontal: 4, borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.04)", alignItems: "center", backgroundColor: "rgba(255,255,255,0.02)" },
  tabButtonActive:   { backgroundColor: "rgba(139,92,246,0.18)", borderColor: "rgba(139,92,246,0.4)" },
  tabLabel:          { color: "#7f91ae", fontSize: 13, fontWeight: "700", fontFamily: HEADER_FONT },
  tabLabelActive:    { color: "#eef2ff" },
  content:           { flex: 1, paddingHorizontal: 16, paddingVertical: 16 },
  dashboardScroll:   { paddingBottom: 40 },
  integrationsScroll:{ paddingBottom: 40 },
  projectsScroll:    { paddingBottom: 40 },
  todoScroll:        { paddingBottom: 40 },
  heroCard:          { borderRadius: 28, padding: 22, marginBottom: 16, backgroundColor: "rgba(12,18,30,0.96)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  heroEyebrow:       { color: "#8ba3c7", fontSize: 10, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8 },
  heroTitle:         { color: "#f8fbff", fontSize: 24, fontWeight: "700", fontFamily: HEADER_FONT, letterSpacing: -0.6, marginBottom: 8 },
  heroBody:          { color: "#bfd0ea", fontSize: 13, lineHeight: 20, marginBottom: 14 },
  heroChipRow:       { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  heroChip:          { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", backgroundColor: "rgba(255,255,255,0.03)" },
  heroChipText:      { color: "#dbeafe", fontSize: 11, fontWeight: "700" },
  metricRow:         { flexDirection: "row", gap: 12, marginBottom: 12 },
  metricCard:        { flex: 1, padding: 16, borderRadius: 22, backgroundColor: "rgba(12,18,30,0.96)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  metricValue:       { fontSize: 24, fontWeight: "800", marginTop: 14 },
  metricLabel:       { color: "#e2e8f0", fontSize: 12, marginTop: 6, fontWeight: "700", fontFamily: HEADER_FONT },
  metricSub:         { color: "#7c8aa5", fontSize: 11, marginTop: 4 },
  section:           { marginTop: 20 },
  sectionTitle:      { color: "#e2e8f0", fontSize: 17, fontWeight: "700", marginBottom: 10, fontFamily: HEADER_FONT },
  sectionHeaderRow:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  mutedText:         { color: "#64748b", fontSize: 13 },
  typeRow:           { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6 },
  typeLabelRow:      { flexDirection: "row", alignItems: "center", gap: 8 },
  typeLabel:         { color: "#cbd5e1", fontSize: 13 },
  typeCount:         { fontSize: 13, fontWeight: "700" },
  todoRow:           { flexDirection: "row", alignItems: "center", marginTop: 4 },
  todoDot:           { width: 6, height: 6, borderRadius: 3, backgroundColor: "#f97316", marginRight: 8 },
  todoText:          { color: "#e5e7eb", fontSize: 13, flex: 1 },
  integrationRow:    { marginTop: 8, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", backgroundColor: "rgba(255,255,255,0.025)", flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  integrationLabel:  { color: "#e5e7eb", fontSize: 13 },
  integrationStatusRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  integrationStatus: { color: "#9ca3af", fontSize: 12 },
  syncButton:        { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: "rgba(139,92,246,0.42)", backgroundColor: "rgba(139,92,246,0.14)" },
  syncButtonText:    { color: "#c4b5fd", fontSize: 12, fontWeight: "700" },
  integrationBlock:  { marginTop: 18 },
  fieldLabel:        { color: "#e2e8f0", fontSize: 12, marginBottom: 6, fontWeight: "700", fontFamily: HEADER_FONT },
  input:             { borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", backgroundColor: "rgba(255,255,255,0.03)", paddingHorizontal: 12, paddingVertical: 11, color: "#e5e7eb", marginBottom: 8, fontSize: 13 },
  primaryButton:     { backgroundColor: "rgba(129,140,248,0.32)", borderRadius: 14, paddingVertical: 12, alignItems: "center", borderWidth: 1, borderColor: "rgba(139,92,246,0.45)" },
  primaryButtonText: { color: "#e0e7ff", fontSize: 13, fontWeight: "700" },
  errorText:         { color: "#f97373", fontSize: 12, marginTop: 4 },
  projectYearBlock:  { marginTop: 18 },
  projectYearLabel:  { color: "#a5b4fc", fontSize: 12, marginBottom: 8, fontWeight: "700", fontFamily: HEADER_FONT },
  projectCard:       { backgroundColor: "rgba(12,18,30,0.96)", borderRadius: 18, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  projectHeaderRow:  { flexDirection: "row", justifyContent: "space-between" },
  projectTitle:      { color: "#e5e7eb", fontSize: 14, fontWeight: "700" },
  projectMetaRow:    { marginTop: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  pillRow:           { flexDirection: "row", gap: 6 },
  pill:              { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, borderWidth: 1, backgroundColor: "rgba(255,255,255,0.02)" },
  pillTypeWrap:      { flexDirection: "row", alignItems: "center", gap: 6 },
  pillText:          { fontSize: 11, fontWeight: "600" },
  pillMuted:         { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: "rgba(31,41,55,0.9)" },
  pillMutedText:     { fontSize: 11, color: "#9ca3af" },
  statsRow:          { flexDirection: "row", gap: 8 },
  statText:          { fontSize: 11, fontWeight: "700" },
  todoHeaderRow:     { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  addTaskButton:     { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: "rgba(129,140,248,0.8)", alignSelf: "flex-start", marginVertical: 4, backgroundColor: "rgba(129,140,248,0.12)" },
  addTaskButtonText: { color: "#c4b5fd", fontSize: 12, fontWeight: "700" },
  addForm:           { marginTop: 8, padding: 12, borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", backgroundColor: "rgba(12,18,30,0.96)" },
  addFormRow:        { flexDirection: "row", gap: 10, alignItems: "center", marginTop: 4, marginBottom: 8 },
  todoSectionTitle:  { color: "#e5e7eb", fontSize: 14, fontWeight: "700", fontFamily: HEADER_FONT, marginTop: 16, marginBottom: 8 },
  todoItemRow:       { flexDirection: "row", alignItems: "center", paddingVertical: 10 },
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



