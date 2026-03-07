import { useState, useEffect, useCallback } from "react";

/* ─── STYLES ─────────────────────────────────────────────── */
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 100%; height: 100%; }
  #root { width: 100%; height: 100%; display: flex; }
  body { background: #04080f; overflow: hidden; }
  ::-webkit-scrollbar { width: 3px; }
  ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 99px; }
  input, textarea, button, select { font-family: inherit; }
  input::placeholder, textarea::placeholder { color: rgba(255,255,255,0.18); opacity: 1; }
  input[type="password"]::placeholder { color: rgba(255,255,255,0.18); opacity: 1; }
  input:focus::placeholder { opacity: 0.5; }
  @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.35; } }
  @keyframes shimmer { 0% { background-position: -400px 0; } 100% { background-position: 400px 0; } }
  .fade-up { animation: fadeUp 0.35s ease both; }
  .spin { animation: spin 0.7s linear infinite; }
  .pulse { animation: pulse 2s ease infinite; }
  .shimmer {
    background: linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%);
    background-size: 400px 100%;
    animation: shimmer 1.4s ease infinite;
  }
  .nav-item:hover { background: rgba(255,255,255,0.05) !important; color: #cbd5e1 !important; }
  .card:hover { border-color: rgba(255,255,255,0.12) !important; }
  .btn:hover { filter: brightness(1.15); }
  .tag { transition: opacity 0.15s; }
  .tag:hover { opacity: 0.7; cursor: default; }
  .hamburger-btn { display: none !important; }
  .desktop-nav { display: flex !important; }
  .mobile-menu { display: none !important; }
  
  @media (max-width: 1024px) {
    main { padding: 16px 16px; }
  }
  
  @media (max-width: 768px) {
    header { padding: 12px 16px; gap: 8px; }
    header > div:first-child { gap: 8px; display: flex; }
    header > div:first-child > div { display: none; }
    header > div:last-child { width: 100%; gap: 4px; justify-content: space-between; align-items: center; display: flex; flex-wrap: wrap; }
    .desktop-nav { flex: 1; gap: 4px; overflow-x: auto; display: flex; }
    .desktop-nav button { padding: 4px 8px; font-size: 10px; white-space: nowrap; }
    main { padding: 12px 12px; }
    main > div { gap: 14px !important; }
    main > div > div { gap: 10px !important; }
  }
  
  @media (max-width: 480px) {
    header { padding: 10px 12px; display: flex; align-items: center; }
    header > div:first-child { gap: 8px; display: flex; align-items: center; }
    header > div:first-child div:first-child { width: 30px; height: 30px; font-size: 14px; }
    header > div:last-child { flex: 1; gap: 4px; justify-content: space-between; align-items: center; display: flex; }
    header > div:last-child > span { display: none !important; }
    header > div:last-child > button:not(.hamburger-btn) { font-size: 12px; padding: 2px 6px; }
    .last-sync { display: none !important; }
    .hamburger-btn { display: flex !important; align-items: center; justify-content: center; }
    .desktop-nav { display: none !important; }
    .mobile-menu { display: flex !important; gap: 4px; padding: 8px 12px; }
    .mobile-menu button { padding: 10px 12px; width: 100%; text-align: left; }
    main { padding: 8px 10px; }
    main > div { gap: 8px !important; }
    main > div > div { gap: 6px !important; }
    section { margin-bottom: 12px; }
    section > div:first-child { font-size: 12px !important; margin-bottom: 8px !important; }
    section > div:nth-child(2) { grid-template-columns: repeat(2, 1fr) !important; gap: 6px !important; }
    section > div:nth-child(2) > div { padding: 10px 8px !important; font-size: 11px !important; }
    .card { padding: 10px 12px; border-radius: 10px; }
  }
  
  @media (max-width: 360px) {
    header { padding: 8px 10px; }
    header > div:first-child div:first-child { width: 28px; height: 28px; }
    main { padding: 6px 8px; }
    section > div:nth-child(2) { grid-template-columns: repeat(1, 1fr) !important; }
    section > div:nth-child(2) > div { padding: 8px 6px !important; font-size: 10px !important; }
    .card { padding: 8px 10px; font-size: 11px !important; }
  }
`;

/* ─── CONSTANTS ──────────────────────────────────────────── */
const V = "#8b5cf6";
const G = "#22d3a5";
const A = "#f59e0b";
const B = "#38bdf8";
const P = "#f472b6";

const typeIcon = { Paper:"📄", Preprint:"📝", Dataset:"📊", Code:"💻", Software:"⚙️", Talk:"🎤", Poster:"🖼️", Report:"📋" };
const typeColor = t => ({ Paper:V, Preprint:"#a78bfa", Dataset:G, Code:A, Software:"#fb923c", Talk:P, Poster:"#e879f9", Report:B }[t] || "#94a3b8");
const prioColor = p => ({ High:"#f87171", Medium:A, Low:"#475569" }[p] || "#475569");

/* ─── API LAYER ──────────────────────────────────────────── */
async function fetchORCID(orcidId) {
  const base = `https://pub.orcid.org/v3.0/${orcidId}`;
  const headers = { Accept: "application/json" };
  // Fetch works summary
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
    const doiObj = extIds.find(e => e["external-id-type"] === "doi");
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
    const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, {
      headers: { "User-Agent": "Reeza/2.0 (mailto:info@Reeza.io)" }
    });
    if (!res.ok) return 0;
    const data = await res.json();
    return data.message?.["is-referenced-by-count"] || 0;
  } catch { return 0; }
}

async function enrichWithCitations(outputs) {
  const enriched = [...outputs];
  const withDoi = enriched.filter(o => o.doi && ["Paper","Preprint","Report"].includes(o.type)).slice(0, 15);
  await Promise.all(withDoi.map(async o => {
    const c = await fetchCrossRefCitations(o.doi);
    const idx = enriched.findIndex(x => x.id === o.id);
    if (idx !== -1) enriched[idx] = { ...enriched[idx], citations: c };
  }));
  return enriched;
}

function parseZenodoHit(h) {
  const rt = h.metadata?.resource_type?.type || h.resource_type?.type || "publication";
  const st = h.metadata?.resource_type?.subtype || h.resource_type?.subtype || "";
  const mapped = rt === "dataset" ? "Dataset"
    : rt === "software" ? "Software"
    : st === "preprint" ? "Preprint"
    : st.includes("conferencepaper") ? "Paper"
    : st.includes("poster") ? "Poster"
    : st.includes("presentation") ? "Talk"
    : "Paper";
  const doi = h.doi || h.metadata?.doi || h.conceptdoi || "";
  const year = (h.metadata?.publication_date || h.created || "").slice(0, 4);
  return {
    id: `zenodo-${h.id}`,
    type: mapped,
    title: h.metadata?.title || h.title || "Untitled",
    platform: "Zenodo", year: year ? +year : null,
    citations: 0,
    downloads: h.stats?.downloads || 0,
    stars: 0, doi,
    version: h.metadata?.version || "",
    source: "zenodo"
  };
}

async function fetchZenodo(tokenOrUsername, isUsername = false) {
  if (isUsername) {
    // Public search by creator name — no token needed
    const url = `https://zenodo.org/api/records?q=creators.name:${encodeURIComponent(tokenOrUsername)}&sort=mostrecent&size=40`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Zenodo error: ${res.status}`);
    const data = await res.json();
    return (data.hits?.hits || []).map(parseZenodoHit);
  } else {
    const headers = { Authorization: `Bearer ${tokenOrUsername}`, "Content-Type": "application/json" };
    const res = await fetch(`https://zenodo.org/api/deposit/depositions?sort=mostrecent&size=40`, { headers });
    if (!res.ok) throw new Error(`Zenodo error: ${res.status}`);
    const data = await res.json();
    return (Array.isArray(data) ? data : data.hits?.hits || []).map(parseZenodoHit);
  }
}

async function fetchGitHub(username) {
  const res = await fetch(`https://api.github.com/users/${username}/repos?sort=updated&per_page=100&type=owner`);
  if (!res.ok) throw new Error(`GitHub error: ${res.status} — check username`);
  const repos = await res.json();
  return repos.filter(r => !r.fork).map(r => ({
    id: `gh-${r.id}`, type: "Code", title: r.name,
    platform: "GitHub", year: r.created_at ? +r.created_at.slice(0, 4) : null,
    citations: 0, downloads: 0, stars: r.stargazers_count || 0,
    doi: "", version: "", source: "github",
    description: r.description || "", language: r.language || ""
  }));
}

/* ─── SMALL UI PRIMITIVES ────────────────────────────────── */
function Spinner({ size = 16, color = V }) {
  return <div className="spin" style={{ width: size, height: size, border: `2px solid ${color}30`, borderTopColor: color, borderRadius: "50%", flexShrink: 0 }} />;
}

function Chip({ color, children, small }) {
  return (
    <span className="tag" style={{
      background: `${color}18`, color, border: `1px solid ${color}30`,
      borderRadius: 6, padding: small ? "1px 6px" : "3px 9px",
      fontSize: small ? 10 : 11, fontWeight: 600,
      fontFamily: "'JetBrains Mono',monospace", whiteSpace: "nowrap",
      display: "inline-block"
    }}>{children}</span>
  );
}

function SkeletonRow() {
  return (
    <div style={{ height: 56, borderRadius: 12, marginBottom: 8 }} className="shimmer" />
  );
}

function Avatar({ name = "?", size = 40 }) {
  const initials = name.split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase() || "?";
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: `linear-gradient(135deg, ${V}, ${G})`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'JetBrains Mono',monospace", fontWeight: 700,
      fontSize: size * 0.33, color: "#fff", flexShrink: 0,
      boxShadow: `0 0 0 1.5px ${V}50`
    }}>{initials}</div>
  );
}

function Modal({ title, onClose, children, width = 520 }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "#0d1220", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20, padding: "28px 30px", width: "100%", maxWidth: width, maxHeight: "88vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#f1f5f9", fontFamily: "'Syne',sans-serif" }}>{title}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#475569", fontSize: 22, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", marginBottom: 5, fontFamily: "'JetBrains Mono',monospace", letterSpacing: "0.08em", textTransform: "uppercase" }}>{label}</div>
      {children}
    </div>
  );
}

const INP = { width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "9px 13px", color: "#e2e8f0", fontSize: 13, outline: "none", transition: "background 0.2s" };
const SEL = { ...INP, cursor: "pointer" };

/* ─── STORAGE HELPERS ────────────────────────────────────── */
const STORAGE_KEY = "Reeza_user_data";
function saveToStorage(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...data, lastSaved: new Date().toISOString() }));
  } catch (e) {
    console.error("Storage error:", e);
  }
}
function loadFromStorage() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    console.error("Storage error:", e);
    return null;
  }
}

/* ─── METRIC CARD ────────────────────────────────────────── */
function MetricCard({ icon, value, label, sub, color, delay = 0 }) {
  return (
    <div className="card fade-up" style={{
      animationDelay: `${delay}ms`,
      background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 16, padding: "18px 18px", flex: 1, minWidth: 110,
      transition: "border-color 0.2s, transform 0.2s", cursor: "default"
    }}>
      <div style={{ fontSize: 20, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color, fontFamily: "'JetBrains Mono',monospace", letterSpacing: "-1.5px", lineHeight: 1 }}>{typeof value === "number" ? value.toLocaleString() : value}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#cbd5e1", marginTop: 5 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: "#475569", marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

/* ─── DASHBOARD VIEW ─────────────────────────────────────── */
function DashboardView({ profile, outputs, todos, integrations }) {
  const pubs = outputs.filter(o => ["Paper", "Preprint", "Report"].includes(o.type)).length;
  const datasets = outputs.filter(o => o.type === "Dataset").length;
  const repos = outputs.filter(o => ["Code", "Software"].includes(o.type)).length;
  const talks = outputs.filter(o => ["Talk", "Poster"].includes(o.type)).length;
  const citations = outputs.reduce((s, o) => s + (o.citations || 0), 0);
  const downloads = outputs.reduce((s, o) => s + (o.downloads || 0), 0);
  const stars = outputs.reduce((s, o) => s + (o.stars || 0), 0);
  const dois = outputs.filter(o => o.doi).length;
  const pending = todos.filter(t => !t.done);
  const highPrio = pending.filter(t => t.priority === "High");

  const byType = ["Paper","Preprint","Dataset","Code","Software","Talk","Poster","Report"]
    .map(t => ({ t, n: outputs.filter(o => o.type === t).length }))
    .filter(x => x.n > 0);
  const maxN = Math.max(...byType.map(x => x.n), 1);

  const connectedSources = Object.values(integrations).filter(i => i.status === "ok").map(i => i.platform);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
      {/* Metrics grid */}
      <section>
        <SectionLabel>Research Footprint · {outputs.length} total outputs</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(115px,1fr))", gap: 10 }}>
          <MetricCard icon="📄" value={pubs}      label="Publications" sub="papers & preprints"                     color={V} delay={0}   />
          <MetricCard icon="📊" value={datasets}  label="Datasets"     sub={`${downloads.toLocaleString()} downloads`} color={G} delay={50}  />
          <MetricCard icon="💻" value={repos}     label="Code"         sub={`${stars} ⭐`}                            color={A} delay={100} />
          <MetricCard icon="🎤" value={talks}     label="Talks"        sub="& posters"                              color={P} delay={150} />
          <MetricCard icon="📎" value={citations} label="Citations"    sub="combined"                               color={B} delay={200} />
          <MetricCard icon="🔗" value={dois}      label="DOIs"         sub="tracked"                                color="#fb923c" delay={250} />
        </div>
      </section>

      {/* Two col */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {/* Breakdown */}
        <div className="card fade-up" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "18px 20px", animationDelay: "80ms" }}>
          <SectionLabel small>Output Types</SectionLabel>
          {byType.length === 0
            ? <Empty>No outputs yet — connect a source or add manually.</Empty>
            : byType.map((x, i) => (
              <div key={x.t} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 9 }}>
                <div style={{ width: 80, fontSize: 11, color: "#64748b", fontFamily: "'JetBrains Mono',monospace", flexShrink: 0 }}>{typeIcon[x.t]} {x.t}</div>
                <div style={{ flex: 1, height: 5, background: "rgba(255,255,255,0.06)", borderRadius: 99, overflow: "hidden" }}>
                  <div style={{ width: `${(x.n / maxN) * 100}%`, height: "100%", background: typeColor(x.t), borderRadius: 99, transition: "width 0.9s cubic-bezier(.22,1,.36,1)", transitionDelay: `${i * 60}ms` }} />
                </div>
                <div style={{ width: 24, textAlign: "right", fontSize: 11, fontWeight: 700, color: typeColor(x.t), fontFamily: "'JetBrains Mono',monospace" }}>{x.n}</div>
              </div>
            ))
          }
        </div>

        {/* Pending todos */}
        <div className="card fade-up" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "18px 20px", animationDelay: "120ms" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <SectionLabel small noMargin>Pending Work</SectionLabel>
            {highPrio.length > 0 && <Chip color="#f87171" small>{highPrio.length} urgent</Chip>}
          </div>
          {pending.length === 0
            ? <Empty>Nothing pending. 🎉</Empty>
            : pending.slice(0, 6).map(t => (
              <div key={t.id} style={{ display: "flex", gap: 8, marginBottom: 9, alignItems: "flex-start" }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: prioColor(t.priority), marginTop: 4, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: "#cbd5e1", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.title}</div>
                  {t.due && <div style={{ fontSize: 10, color: "#334155", fontFamily: "'JetBrains Mono',monospace" }}>Due {t.due}</div>}
                </div>
              </div>
            ))
          }
        </div>
      </div>

      {/* Sources connected */}
      <div className="card fade-up" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "18px 20px", animationDelay: "160ms" }}>
        <SectionLabel small>Live Data Sources</SectionLabel>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {[
            { name: "ORCID", color: "#a6ce39", key: "orcid" },
            { name: "Zenodo", color: G, key: "zenodo" },
            { name: "GitHub", color: A, key: "github" },
            { name: "CrossRef", color: B, key: "crossref" },
          ].map(s => {
            const st = integrations[s.key]?.status;
            const isOk = st === "ok";
            const isLoading = st === "loading";
            return (
              <div key={s.name} style={{
                display: "flex", alignItems: "center", gap: 6, padding: "6px 12px",
                background: isOk ? `${s.color}12` : "rgba(255,255,255,0.03)",
                border: `1px solid ${isOk ? s.color + "35" : "rgba(255,255,255,0.07)"}`,
                borderRadius: 20, fontSize: 12, fontWeight: 600,
                color: isOk ? s.color : "#334155"
              }}>
                {isLoading ? <Spinner size={10} color={s.color} /> : <span className={isOk ? "pulse" : ""} style={{ display: "inline-block", width: 5, height: 5, borderRadius: "50%", background: isOk ? s.color : "#2d3748", flexShrink: 0 }} />}
                {s.name}
                {isOk && integrations[s.key]?.count != null && <span style={{ fontSize: 10, opacity: 0.7, fontFamily: "'JetBrains Mono',monospace" }}>({integrations[s.key].count})</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─── PROJECTS VIEW ──────────────────────────────────────── */
function ProjectsView({ outputs, setOutputs, integrations, onSync }) {
  const [showAdd, setShowAdd] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [form, setForm] = useState({ type: "Paper", title: "", platform: "Zenodo", year: new Date().getFullYear(), citations: 0, downloads: 0, stars: 0, doi: "", version: "" });

  function add() {
    if (!form.title.trim()) return;
    setOutputs(p => [...p, { ...form, id: `manual-${Math.random().toString(36).slice(2)}`, citations: +form.citations, downloads: +form.downloads, stars: +form.stars, source: "manual" }]);
    setShowAdd(false);
    setForm({ type: "Paper", title: "", platform: "Zenodo", year: new Date().getFullYear(), citations: 0, downloads: 0, stars: 0, doi: "", version: "" });
  }

  function remove(id) { setOutputs(p => p.filter(o => o.id !== id)); }

  const grouped = {};
  outputs.forEach(o => { const k = o.year || "Unknown"; if (!grouped[k]) grouped[k] = []; grouped[k].push(o); });
  const years = Object.keys(grouped).sort((a, b) => b - a);
  const isAnySyncing = Object.values(integrations).some(i => i.status === "loading");

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <SectionLabel noMargin>{outputs.length} Research Outputs</SectionLabel>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={onSync} disabled={isAnySyncing} style={{
            display: "flex", alignItems: "center", gap: 6, padding: "8px 14px",
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 10, color: isAnySyncing ? "#334155" : "#94a3b8", fontSize: 12, fontWeight: 600, cursor: isAnySyncing ? "not-allowed" : "pointer", transition: "all 0.15s"
          }}>
            {isAnySyncing ? <Spinner size={12} /> : "↻"} Sync All
          </button>
          <button className="btn" onClick={() => setShowAdd(true)} style={{
            padding: "8px 16px", background: `${V}20`, border: `1px solid ${V}44`,
            borderRadius: 10, color: "#a78bfa", fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "all 0.15s"
          }}>+ Add Output</button>
        </div>
      </div>

      {outputs.length === 0 && !isAnySyncing && (
        <Empty center>No outputs yet. Connect a source in Integrations or add manually.</Empty>
      )}
      {isAnySyncing && [1, 2, 3].map(i => <SkeletonRow key={i} />)}

      {years.map(year => (
        <div key={year} style={{ marginBottom: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: V, fontFamily: "'JetBrains Mono',monospace" }}>{year}</div>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.04)" }} />
            <div style={{ fontSize: 10, color: "#334155", fontFamily: "'JetBrains Mono',monospace" }}>{grouped[year].length} outputs</div>
          </div>
          {grouped[year].map(o => {
            const c = typeColor(o.type);
            const isExp = expanded === o.id;
            const srcColor = o.source === "github" ? A : o.source === "zenodo" ? G : o.source === "orcid" ? "#a6ce39" : "#475569";
            return (
              <div key={o.id} style={{ background: "rgba(255,255,255,0.025)", border: `1px solid ${isExp ? c + "44" : "rgba(255,255,255,0.07)"}`, borderRadius: 13, overflow: "hidden", marginBottom: 7, transition: "border-color 0.2s" }}>
                <div onClick={() => setExpanded(isExp ? null : o.id)} style={{ padding: "12px 15px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 9, background: `${c}18`, border: `1px solid ${c}28`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0 }}>
                    {typeIcon[o.type] || "📄"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap", marginBottom: 3 }}>
                      <Chip color={c} small>{o.type}</Chip>
                      {o.version && <span style={{ fontSize: 9, color: "#475569", fontFamily: "'JetBrains Mono',monospace" }}>{o.version}</span>}
                      <Chip color={srcColor} small>{o.platform}</Chip>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{o.title}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                    {o.citations > 0 && <span style={{ fontSize: 11, color: V, fontFamily: "'JetBrains Mono',monospace" }}>📎{o.citations}</span>}
                    {o.downloads > 0 && <span style={{ fontSize: 11, color: G, fontFamily: "'JetBrains Mono',monospace" }}>⬇{o.downloads.toLocaleString()}</span>}
                    {o.stars > 0 && <span style={{ fontSize: 11, color: A, fontFamily: "'JetBrains Mono',monospace" }}>⭐{o.stars}</span>}
                    <span style={{ color: "#334155", fontSize: 16, transform: isExp ? "rotate(90deg)" : "none", transition: "transform 0.2s" }}>›</span>
                  </div>
                </div>
                {isExp && (
                  <div style={{ padding: "0 15px 14px", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 12 }}>
                    {o.doi && <div style={{ fontSize: 11, color: "#475569", fontFamily: "'JetBrains Mono',monospace", marginBottom: 10, wordBreak: "break-all" }}>DOI: <a href={`https://doi.org/${o.doi}`} target="_blank" rel="noopener noreferrer" style={{ color: B, textDecoration: "none" }}>{o.doi}</a></div>}
                    {o.description && <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10, lineHeight: 1.5 }}>{o.description}</div>}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                      {o.citations > 0 && <StatBadge icon="📎" label="citations" value={o.citations} color={V} />}
                      {o.downloads > 0 && <StatBadge icon="⬇" label="downloads" value={o.downloads} color={G} />}
                      {o.stars > 0 && <StatBadge icon="⭐" label="stars" value={o.stars} color={A} />}
                    </div>
                    {o.source === "manual" && (
                      <button onClick={() => remove(o.id)} style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, color: "#f87171", fontSize: 11, padding: "4px 10px", cursor: "pointer" }}>Remove</button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {showAdd && (
        <Modal title="Add Output Manually" onClose={() => setShowAdd(false)}>
          <Field label="Type"><select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} style={SEL}>{["Paper","Preprint","Dataset","Code","Software","Talk","Poster","Report"].map(t => <option key={t}>{t}</option>)}</select></Field>
          <Field label="Title *"><input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} style={INP} placeholder="Full title" autoFocus /></Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Platform"><select value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value }))} style={SEL}>{["Zenodo","GitHub","arXiv","GitLab","Figshare","Dryad","OSF","Publisher","Other"].map(p => <option key={p}>{p}</option>)}</select></Field>
            <Field label="Year"><input type="number" value={form.year} onChange={e => setForm(f => ({ ...f, year: +e.target.value }))} style={INP} /></Field>
          </div>
          <Field label="DOI (optional)"><input value={form.doi} onChange={e => setForm(f => ({ ...f, doi: e.target.value }))} style={INP} placeholder="10.xxxx/..." /></Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <Field label="Citations"><input type="number" min="0" value={form.citations} onChange={e => setForm(f => ({ ...f, citations: e.target.value }))} style={INP} /></Field>
            <Field label="Downloads"><input type="number" min="0" value={form.downloads} onChange={e => setForm(f => ({ ...f, downloads: e.target.value }))} style={INP} /></Field>
            <Field label="Stars"><input type="number" min="0" value={form.stars} onChange={e => setForm(f => ({ ...f, stars: e.target.value }))} style={INP} /></Field>
          </div>
          <button onClick={add} style={{ width: "100%", padding: "11px", background: `${V}22`, border: `1px solid ${V}55`, borderRadius: 12, color: "#c4b5fd", fontSize: 14, fontWeight: 700, cursor: "pointer", marginTop: 6 }}>Add Output</button>
        </Modal>
      )}
    </div>
  );
}

function StatBadge({ icon, label, value, color }) {
  return (
    <div style={{ background: `${color}12`, border: `1px solid ${color}25`, borderRadius: 8, padding: "6px 12px" }}>
      <div style={{ fontSize: 10, color: "#475569" }}>{icon} {label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color, fontFamily: "'JetBrains Mono',monospace" }}>{value.toLocaleString()}</div>
    </div>
  );
}

/* ─── INTEGRATIONS VIEW ──────────────────────────────────── */
function IntegrationsView({ integrations, creds, setCreds, onSync }) {
  const [showSetup, setShowSetup] = useState(null);
  const [localCreds, setLocalCreds] = useState({ ...creds });

  function saveAndSync(platform) {
    setCreds(localCreds);
    setShowSetup(null);
    onSync(platform, localCreds);
  }

  const sources = [
    {
      key: "orcid", name: "ORCID", icon: "🔬", color: "#a6ce39",
      desc: "Pulls all your publications, preprints and datasets from your public ORCID record.",
      apiNote: "Public API · No authentication required",
      field: { label: "ORCID ID", key: "orcidId", placeholder: "0000-0001-2345-6789", type: "text" }
    },
    {
      key: "zenodo", name: "Zenodo", icon: "🗄️", color: G,
      desc: "Imports all your Zenodo deposits with download statistics.",
      apiNote: "Zenodo REST API · Requires personal access token",
      field: { label: "Personal Access Token", key: "zenodoToken", placeholder: "your token from zenodo.org/account/settings/applications", type: "password" }
    },
    {
      key: "github", name: "GitHub", icon: "🐙", color: A,
      desc: "Fetches your public repos with star counts, languages and descriptions.",
      apiNote: "GitHub REST API · Username only (public repos)",
      field: { label: "GitHub Username", key: "githubUsername", placeholder: "your-github-username", type: "text" }
    },
    {
      key: "crossref", name: "CrossRef", icon: "🔗", color: B,
      desc: "Auto-enriches citation counts for all outputs that have a DOI.",
      apiNote: "CrossRef API · Runs automatically when outputs have DOIs",
      field: null
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <SectionLabel>Live Data Sources</SectionLabel>

      {sources.map(s => {
        const state = integrations[s.key] || {};
        const isOk = state.status === "ok";
        const isLoading = state.status === "loading";
        const isError = state.status === "error";
        const hasKey = s.key === "crossref" || (s.field && localCreds[s.field.key]);

        return (
          <div key={s.key} className="card" style={{
            background: "rgba(255,255,255,0.025)", border: `1px solid ${isOk ? s.color + "35" : "rgba(255,255,255,0.07)"}`,
            borderRadius: 16, padding: "18px 20px", transition: "border-color 0.2s"
          }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
              <div style={{ fontSize: 26, flexShrink: 0, marginTop: 2 }}>{s.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9", marginBottom: 3 }}>{s.name}</div>
                    <div style={{ fontSize: 12, color: "#475569", marginBottom: 2 }}>{s.desc}</div>
                    <div style={{ fontSize: 11, color: "#334155", fontFamily: "'JetBrains Mono',monospace" }}>{s.apiNote}</div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    {isOk && <Chip color={s.color}>✓ Connected</Chip>}
                    {isError && <Chip color="#f87171">⚠ Error</Chip>}
                    {isLoading && <div style={{ display: "flex", alignItems: "center", gap: 6 }}><Spinner size={12} color={s.color} /></div>}
                    {!isOk && !isLoading && <Chip color="#475569">Not Set</Chip>}
                  </div>
                </div>
              </div>
            </div>
            {hasKey && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                <button onClick={() => setShowSetup(s.key)} style={{ padding: "8px 14px", background: `${s.color}30`, border: `1px solid ${s.color}50`, borderRadius: 8, color: s.color, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                  {isOk ? "Update" : "Configure"}
                </button>
                {isOk && <button onClick={() => onSync(s.key, localCreds)} style={{ marginLeft: 8, padding: "8px 14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#94a3b8", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Sync Now</button>}
                {isError && state.error && <div style={{ marginTop: 8, fontSize: 11, color: "#f87171", padding: "8px 12px", background: "rgba(248,113,113,0.1)", borderRadius: 6 }}>{state.error}</div>}
              </div>
            )}
            {!hasKey && s.field && (
              <div style={{ marginTop: 14 }}>
                <input
                  type={s.field.type}
                  value={localCreds[s.field.key] || ""}
                  onChange={e => setLocalCreds(c => ({ ...c, [s.field.key]: e.target.value }))}
                  placeholder={s.field.placeholder}
                  style={{ ...INP, marginBottom: 10 }}
                />
                <button onClick={() => saveAndSync(s.key)} style={{ padding: "8px 14px", background: `${s.color}30`, border: `1px solid ${s.color}50`, borderRadius: 8, color: s.color, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                  Save & Sync
                </button>
              </div>
            )}
            {showSetup === s.key && s.field && (
              <Modal title={`Update ${s.name}`} onClose={() => setShowSetup(null)}>
                <Field label={s.field.label}>
                  <input
                    type={s.field.type}
                    value={localCreds[s.field.key] || ""}
                    onChange={e => setLocalCreds(c => ({ ...c, [s.field.key]: e.target.value }))}
                    placeholder={s.field.placeholder}
                    style={INP}
                    autoFocus
                  />
                </Field>
                <button onClick={() => saveAndSync(s.key)} style={{ width: "100%", padding: "11px", background: `${s.color}22`, border: `1px solid ${s.color}55`, borderRadius: 12, color: s.color, fontSize: 14, fontWeight: 700, cursor: "pointer", marginTop: 6 }}>
                  Save & Sync
                </button>
              </Modal>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── TODO VIEW ──────────────────────────────────────────── */
function TodoView({ todos, setTodos }) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: "", priority: "Medium", due: "" });

  function add() {
    if (!form.title.trim()) return;
    setTodos(p => [...p, { id: `todo-${Date.now()}`, ...form, done: false }]);
    setShowAdd(false);
    setForm({ title: "", priority: "Medium", due: "" });
  }

  function toggle(id) {
    setTodos(p => p.map(t => t.id === id ? { ...t, done: !t.done } : t));
  }

  function remove(id) {
    setTodos(p => p.filter(t => t.id !== id));
  }

  const pending = todos.filter(t => !t.done);
  const done = todos.filter(t => t.done);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <SectionLabel noMargin>{todos.length} Tasks</SectionLabel>
        <button onClick={() => setShowAdd(true)} className="btn" style={{
          padding: "8px 16px", background: `${V}20`, border: `1px solid ${V}44`,
          borderRadius: 10, color: "#a78bfa", fontSize: 12, fontWeight: 700, cursor: "pointer"
        }}>+ Add Task</button>
      </div>

      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", marginBottom: 10, fontFamily: "'JetBrains Mono',monospace", letterSpacing: "0.08em" }}>PENDING</div>
        {pending.length === 0
          ? <Empty>All caught up! 🎉</Empty>
          : pending.map(t => (
            <div key={t.id} style={{
              display: "flex", gap: 12, padding: "10px 14px", marginBottom: 8,
              background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)",
              borderRadius: 10, alignItems: "flex-start"
            }}>
              <input
                type="checkbox"
                checked={t.done}
                onChange={() => toggle(t.id)}
                style={{ marginTop: 3, cursor: "pointer", accentColor: prioColor(t.priority) }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: "#e2e8f0", marginBottom: 2 }}>{t.title}</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <Chip color={prioColor(t.priority)} small>{t.priority}</Chip>
                  {t.due && <span style={{ fontSize: 11, color: "#475569", fontFamily: "'JetBrains Mono',monospace" }}>{t.due}</span>}
                </div>
              </div>
              <button onClick={() => remove(t.id)} style={{ background: "none", border: "none", color: "#334155", cursor: "pointer", fontSize: 16 }}>×</button>
            </div>
          ))}
      </div>

      {done.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", marginBottom: 10, fontFamily: "'JetBrains Mono',monospace", letterSpacing: "0.08em" }}>COMPLETED</div>
          {done.map(t => (
            <div key={t.id} style={{
              display: "flex", gap: 12, padding: "10px 14px", marginBottom: 8,
              background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)",
              borderRadius: 10, alignItems: "flex-start", opacity: 0.6
            }}>
              <input
                type="checkbox"
                checked={t.done}
                onChange={() => toggle(t.id)}
                style={{ marginTop: 3, cursor: "pointer", accentColor: G }}
              />
              <div style={{ flex: 1, minWidth: 0, textDecoration: "line-through" }}>
                <div style={{ fontSize: 13, color: "#64748b", marginBottom: 2 }}>{t.title}</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <Chip color={prioColor(t.priority)} small>{t.priority}</Chip>
                  {t.due && <span style={{ fontSize: 11, color: "#475569", fontFamily: "'JetBrains Mono',monospace" }}>{t.due}</span>}
                </div>
              </div>
              <button onClick={() => remove(t.id)} style={{ background: "none", border: "none", color: "#334155", cursor: "pointer", fontSize: 16 }}>×</button>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <Modal title="Add Task" onClose={() => setShowAdd(false)} width={480}>
          <Field label="Title *"><input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} style={INP} placeholder="What needs to be done?" autoFocus /></Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Priority"><select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} style={SEL}><option>Low</option><option>Medium</option><option>High</option></select></Field>
            <Field label="Due Date"><input type="date" value={form.due} onChange={e => setForm(f => ({ ...f, due: e.target.value }))} style={INP} /></Field>
          </div>
          <button onClick={add} style={{ width: "100%", padding: "11px", background: `${V}22`, border: `1px solid ${V}55`, borderRadius: 12, color: "#c4b5fd", fontSize: 14, fontWeight: 700, cursor: "pointer", marginTop: 6 }}>Add Task</button>
        </Modal>
      )}
    </div>
  );
}

/* ─── EMPTY STATE ────────────────────────────────────────── */
function Empty({ children, center }) {
  return <div style={{ padding: "28px 14px", textAlign: center ? "center" : "left", color: "#334155", fontSize: 13, fontStyle: "italic" }}>{children}</div>;
}

/* ─── SECTION LABEL ──────────────────────────────────────── */
function SectionLabel({ children, small, noMargin }) {
  return <div style={{ fontSize: small ? 12 : 16, fontWeight: 700, color: "#e2e8f0", marginBottom: noMargin ? 0 : 16, fontFamily: "'Syne',sans-serif" }}>{children}</div>;
}

/* ─── LOGIN MODAL ────────────────────────────────────────── */
function LoginModal({ onComplete }) {
  const [form, setForm] = useState({ name: "", affiliation: "", bio: "" });
  const [step, setStep] = useState("welcome"); // welcome, form, or done

  function handleSubmit() {
    if (!form.name.trim() || !form.affiliation.trim()) {
      alert("Please fill in your name and affiliation");
      return;
    }
    onComplete(form);
    setStep("done");
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.95)", zIndex: 9999,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20
    }}>
      <div style={{
        background: "#0d1220", border: "2px solid " + V + "55", borderRadius: 24, padding: "40px 50px",
        maxWidth: 520, textAlign: "center", animation: "fadeUp 0.5s ease both"
      }}>
        {step === "welcome" && (
          <>
            <div style={{ fontSize: 32, marginBottom: 20 }}>👋</div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: "#e2e8f0", marginBottom: 14, fontFamily: "'Syne',sans-serif" }}>
              Welcome to Reeza
            </h1>
            <p style={{ fontSize: 14, color: "#64748b", marginBottom: 28, lineHeight: 1.6 }}>
              Your personal research portfolio & publication tracker. Let's get you set up!
            </p>
            <button onClick={() => setStep("form")} style={{
              width: "100%", padding: "12px", background: `${V}22`, border: `1px solid ${V}55`,
              borderRadius: 12, color: "#a78bfa", fontSize: 14, fontWeight: 700, cursor: "pointer"
            }}>
              Get Started
            </button>
          </>
        )}

        {step === "form" && (
          <>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#e2e8f0", marginBottom: 24, fontFamily: "'Syne',sans-serif" }}>
              Create Your Profile
            </h2>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", marginBottom: 8, fontFamily: "'JetBrains Mono',monospace", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Full Name *
              </div>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Dr. Jane Smith"
                style={{
                  width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 10, padding: "10px 13px", color: "#e2e8f0", fontSize: 13, outline: "none"
                }}
                autoFocus
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", marginBottom: 8, fontFamily: "'JetBrains Mono',monospace", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Affiliation *
              </div>
              <input
                value={form.affiliation}
                onChange={e => setForm(f => ({ ...f, affiliation: e.target.value }))}
                placeholder="MIT, Stanford, etc."
                style={{
                  width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 10, padding: "10px 13px", color: "#e2e8f0", fontSize: 13, outline: "none"
                }}
              />
            </div>
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", marginBottom: 8, fontFamily: "'JetBrains Mono',monospace", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Bio (optional)
              </div>
              <textarea
                value={form.bio}
                onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
                placeholder="AI & ML Research, Climate Science, etc."
                style={{
                  width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 10, padding: "10px 13px", color: "#e2e8f0", fontSize: 13, outline: "none",
                  fontFamily: "inherit", minHeight: 70, resize: "vertical"
                }}
              />
            </div>
            <button onClick={handleSubmit} style={{
              width: "100%", padding: "12px", background: `${V}22`, border: `1px solid ${V}55`,
              borderRadius: 12, color: "#a78bfa", fontSize: 14, fontWeight: 700, cursor: "pointer", marginBottom: 10
            }}>
              Create Profile
            </button>
            <button onClick={() => setStep("welcome")} style={{
              width: "100%", padding: "12px", background: "transparent", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 12, color: "#64748b", fontSize: 14, fontWeight: 600, cursor: "pointer"
            }}>
              Back
            </button>
          </>
        )}

        {step === "done" && (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#e2e8f0", marginBottom: 10, fontFamily: "'Syne',sans-serif" }}>
              All Set!
            </h2>
            <p style={{ fontSize: 13, color: "#64748b", marginBottom: 24 }}>
              Welcome {form.name}! Your profile is ready. Let's explore Reeza.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── MAIN APP ───────────────────────────────────────────── */
export default function App() {
  // Load from storage on mount
  const storedData = loadFromStorage();
  const isFirstVisit = !storedData?.profile;
  
  const defaultTodos = [
    { id: "1", title: "Finish Q1 research paper", priority: "High", due: "2024-03-15", done: false },
    { id: "2", title: "Update GitHub repos documentation", priority: "Medium", due: "", done: false },
    { id: "3", title: "Submit dataset to Zenodo", priority: "High", due: "2024-03-20", done: false },
  ];

  const [view, setView] = useState("dashboard");
  const [showLogin, setShowLogin] = useState(isFirstVisit);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profile, setProfile] = useState(storedData?.profile || { name: "", affiliation: "", bio: "" });
  const [outputs, setOutputs] = useState(storedData?.outputs || []);
  const [todos, setTodos] = useState(storedData?.todos || defaultTodos);
  const [integrations, setIntegrations] = useState(storedData?.integrations || {
    orcid: { status: "idle", count: 0, error: null },
    zenodo: { status: "idle", count: 0, error: null },
    github: { status: "idle", count: 0, error: null },
    crossref: { status: "idle", count: 0, error: null },
  });
  const [creds, setCreds] = useState(storedData?.creds || {
    orcidId: "",
    zenodoToken: "",
    githubUsername: "",
  });
  const [lastSync, setLastSync] = useState(storedData?.lastSync || null);

  function handleLoginComplete(profileData) {
    setProfile(profileData);
    setShowLogin(false);
  }

  // Save to storage whenever data changes
  useEffect(() => {
    saveToStorage({ profile, outputs, todos, integrations, creds, lastSync });
  }, [profile, outputs, todos, integrations, creds, lastSync]);

  // Hourly sync
  useEffect(() => {
    const hourlySync = setInterval(() => {
      console.log("🔄 Hourly sync triggered...");
      setLastSync(new Date().toISOString());
      sync(null, creds);
    }, 3600000); // 1 hour in milliseconds

    return () => clearInterval(hourlySync);
  }, [creds]);

  const sync = useCallback(async (platform, localCreds = creds) => {
    const newIntegrations = { ...integrations };

    const doSync = async (key, fn) => {
      try {
        newIntegrations[key] = { status: "loading", count: 0, error: null };
        setIntegrations({ ...newIntegrations });
        const res = await fn();
        newIntegrations[key] = { status: "ok", count: res.length, error: null };
        setOutputs(p => [...p.filter(o => o.source !== key), ...res]);
      } catch (e) {
        newIntegrations[key] = { status: "error", count: 0, error: e.message };
      }
      setIntegrations({ ...newIntegrations });
    };

    if (!platform || platform === "orcid") {
      if (localCreds.orcidId) await doSync("orcid", () => fetchORCID(localCreds.orcidId).then(enrichWithCitations));
    }
    if (!platform || platform === "zenodo") {
      if (localCreds.zenodoToken) await doSync("zenodo", () => fetchZenodo(localCreds.zenodoToken));
    }
    if (!platform || platform === "github") {
      if (localCreds.githubUsername) await doSync("github", () => fetchGitHub(localCreds.githubUsername));
    }
    if (!platform || platform === "crossref") {
      const existing = outputs.filter(o => o.doi && ["Paper", "Preprint", "Report"].includes(o.type));
      if (existing.length > 0) {
        newIntegrations.crossref = { status: "loading", count: 0, error: null };
        setIntegrations({ ...newIntegrations });
        const enriched = await enrichWithCitations(existing);
        setOutputs(p => [...p.map(o => enriched.find(e => e.id === o.id) || o)]);
        newIntegrations.crossref = { status: "ok", count: enriched.length, error: null };
        setIntegrations({ ...newIntegrations });
      }
    }
  }, [integrations, outputs, creds]);

  return (
    <>
      <style>{CSS}</style>
      {showLogin && <LoginModal onComplete={handleLoginComplete} />}
      <div style={{ display: "flex", flexDirection: "column", width: "100vw", height: "100vh", background: "#04080f", color: "#e2e8f0", fontFamily: "'Syne',sans-serif", overflow: "hidden" }}>
        {/* Header */}
        <header style={{ background: "#0a0e18", borderBottom: "1px solid rgba(255,255,255,0.05)", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 50, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Avatar name={profile.name} size={36} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "'Syne',sans-serif" }}>{profile.name}</div>
              <div style={{ fontSize: 10, color: "#475569" }}>{profile.affiliation}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div className="desktop-nav" style={{ display: "flex", gap: 8 }}>
              {[
                { id: "dashboard", label: "Dashboard", icon: "📊" },
                { id: "projects", label: "Projects", icon: "📁" },
                { id: "integrations", label: "Integrations", icon: "🔗" },
                { id: "todo", label: "Todo", icon: "✓" },
              ].map(tab => (
                <button key={tab.id} onClick={() => { setView(tab.id); setMobileMenuOpen(false); }} className="nav-item" style={{
                  padding: "6px 12px", background: view === tab.id ? `${V}22` : "transparent",
                  border: view === tab.id ? `1px solid ${V}44` : "1px solid transparent",
                  borderRadius: 8, color: view === tab.id ? "#a78bfa" : "#475569", fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.15s"
                }}>{tab.icon} {tab.label}</button>
              ))}
            </div>
            <button onClick={() => setShowLogin(true)} style={{ fontSize: 14, background: "none", border: "none", color: "#64748b", cursor: "pointer", padding: "4px 8px" }} title="Edit profile">✏️</button>
            {lastSync && <span className="last-sync" style={{ fontSize: 9, color: "#334155", fontFamily: "'JetBrains Mono',monospace" }}>Last synced: {new Date(lastSync).toLocaleTimeString()}</span>}
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="hamburger-btn" style={{ display: "none", background: "none", border: "none", color: "#64748b", fontSize: 20, cursor: "pointer", padding: "0 4px" }}>☰</button>
          </div>
        </header>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div style={{ background: "#0a0e18", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", flexDirection: "column", gap: 4, padding: "8px 12px", zIndex: 49 }} className="mobile-menu">
            {[
              { id: "dashboard", label: "Dashboard", icon: "📊" },
              { id: "projects", label: "Projects", icon: "📁" },
              { id: "integrations", label: "Integrations", icon: "🔗" },
              { id: "todo", label: "Todo", icon: "✓" },
            ].map(tab => (
              <button key={tab.id} onClick={() => { setView(tab.id); setMobileMenuOpen(false); }} style={{
                padding: "10px 12px", background: view === tab.id ? `${V}22` : "transparent",
                border: view === tab.id ? `1px solid ${V}44` : "none",
                borderRadius: 8, color: view === tab.id ? "#a78bfa" : "#a0aec0", fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all 0.15s", textAlign: "left"
              }}>{tab.icon} {tab.label}</button>
            ))}
          </div>
        )}

        {/* Content */}
        <main style={{ padding: "20px 24px", width: "100%", flex: 1, overflow: "auto" }}>
          {view === "dashboard" && <DashboardView profile={profile} outputs={outputs} todos={todos} integrations={integrations} />}
          {view === "projects" && <ProjectsView outputs={outputs} setOutputs={setOutputs} integrations={integrations} onSync={sync} />}
          {view === "integrations" && <IntegrationsView integrations={integrations} creds={creds} setCreds={setCreds} onSync={sync} />}
          {view === "todo" && <TodoView todos={todos} setTodos={setTodos} />}
        </main>
      </div>
    </>
  );
}