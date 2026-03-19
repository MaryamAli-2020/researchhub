import { useState, useEffect, useCallback, useRef } from "react";
import { fetchUserData, saveUserData, subscribeToUserData } from "./api-client.js";
import { useAuth } from "./AuthContext.jsx";
import AuthScreen from "./AuthScreen.jsx";
import { getVisibleItems, markItemDeleted, markItemUpdated, mergeUserData, normalizeUserData, nowIso, sanitizeIntegrations, stampSection } from "./sync-utils.js";

/* â”€â”€â”€ STYLES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@500;600;700;800&family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap');
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
    main { padding: 6px 8px; }
    section > div:nth-child(2) { grid-template-columns: repeat(1, 1fr) !important; }
    section > div:nth-child(2) > div { padding: 8px 6px !important; font-size: 10px !important; }
    .card { padding: 8px 10px; font-size: 11px !important; }
  }
`;

/* â”€â”€â”€ CONSTANTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const V = "#8b5cf6";
const G = "#22d3a5";
const A = "#f59e0b";
const B = "#38bdf8";
const P = "#f472b6";
const HEADER_FONT = "'Poppins','Syne',sans-serif";

const typeIcon = { Paper:"paper", Preprint:"preprint", Dataset:"dataset", Code:"code", Software:"software", Talk:"talk", Poster:"poster", Report:"report" };
const typeColor = t => ({ Paper:V, Preprint:"#a78bfa", Dataset:G, Code:A, Software:"#fb923c", Talk:P, Poster:"#e879f9", Report:B }[t] || "#94a3b8");
const prioColor = p => ({ High:"#f87171", Medium:A, Low:"#475569" }[p] || "#475569");
const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: "dashboard" },
  { id: "projects", label: "Projects", icon: "folder" },
  { id: "integrations", label: "Integrations", icon: "nodes" },
  { id: "todo", label: "Tasks", icon: "checklist" },
];

/* â”€â”€â”€ API LAYER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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
    id: `zenodo-${h.id}`, type: mapped,
    title: h.metadata?.title || h.title || "Untitled",
    platform: "Zenodo", year: year ? +year : null,
    citations: 0, downloads: h.stats?.downloads || 0,
    stars: 0, doi, version: h.metadata?.version || "", source: "zenodo"
  };
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
    const res = await fetch(`https://zenodo.org/api/deposit/depositions?sort=mostrecent&size=40`, { headers });
    if (!res.ok) throw new Error(`Zenodo error: ${res.status}`);
    const data = await res.json();
    return (Array.isArray(data) ? data : data.hits?.hits || []).map(parseZenodoHit);
  }
}

async function fetchGitHub(username) {
  const res = await fetch(`https://api.github.com/users/${username}/repos?sort=updated&per_page=100&type=owner`);
  if (!res.ok) throw new Error(`GitHub error: ${res.status} - check username`);
  const repos = await res.json();
  return repos.filter(r => !r.fork).map(r => ({
    id: `gh-${r.id}`, type: "Code", title: r.name,
    platform: "GitHub", year: r.created_at ? +r.created_at.slice(0, 4) : null,
    citations: 0, downloads: 0, stars: r.stargazers_count || 0,
    doi: "", version: "", source: "github",
    description: r.description || "", language: r.language || ""
  }));
}

/* â”€â”€â”€ SMALL UI PRIMITIVES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function Icon({ name, size = 18, color = "currentColor", stroke = 1.9 }) {
  const props = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color,
    strokeWidth: stroke,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: { display: "block", flexShrink: 0 },
  };

  switch (name) {
    case "logo":
      return <svg {...props}><path d="M5 12.5 12 4l7 8.5"/><path d="M8 12.5V19h8v-6.5"/><path d="M10.5 19v-3.5h3V19"/></svg>;
    case "dashboard":
      return <svg {...props}><rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="5" rx="2"/><rect x="13" y="11" width="7" height="9" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/></svg>;
    case "folder":
      return <svg {...props}><path d="M4 8.5A2.5 2.5 0 0 1 6.5 6H10l2 2h5.5A2.5 2.5 0 0 1 20 10.5v6A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5z"/></svg>;
    case "nodes":
      return <svg {...props}><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="6.5" r="2.5"/><circle cx="12" cy="17.5" r="2.5"/><path d="M8.8 7.6 15.2 7.4"/><path d="M8 8.7 10.5 14.9"/><path d="M16 8.7 13.5 14.9"/></svg>;
    case "checklist":
      return <svg {...props}><path d="m8.5 7 1.7 1.8L13.5 5.5"/><path d="m8.5 13 1.7 1.8 3.3-3.3"/><path d="M15.5 7H19"/><path d="M15.5 13H19"/><path d="M5 5h1v4H5z"/><path d="M5 11h1v4H5z"/></svg>;
    case "paper":
      return <svg {...props}><path d="M8 3.5h6l4 4v13H8a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2Z"/><path d="M14 3.5v4h4"/><path d="M10 12h6"/><path d="M10 16h6"/></svg>;
    case "preprint":
      return <svg {...props}><path d="M7 4.5h8a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2Z"/><path d="M8.5 9h7"/><path d="M8.5 12h7"/><path d="M8.5 15h4.5"/></svg>;
    case "dataset":
      return <svg {...props}><ellipse cx="12" cy="6.5" rx="6.5" ry="3.5"/><path d="M5.5 6.5v5c0 1.9 2.9 3.5 6.5 3.5s6.5-1.6 6.5-3.5v-5"/><path d="M5.5 11.5v5c0 1.9 2.9 3.5 6.5 3.5s6.5-1.6 6.5-3.5v-5"/></svg>;
    case "code":
      return <svg {...props}><path d="m9 8-4 4 4 4"/><path d="m15 8 4 4-4 4"/><path d="m13 5-2 14"/></svg>;
    case "software":
      return <svg {...props}><circle cx="12" cy="12" r="3.2"/><path d="M12 3.8v2.4"/><path d="M12 17.8v2.4"/><path d="m18.2 5.8-1.7 1.7"/><path d="m7.5 16.5-1.7 1.7"/><path d="M20.2 12h-2.4"/><path d="M6.2 12H3.8"/><path d="m18.2 18.2-1.7-1.7"/><path d="m7.5 7.5-1.7-1.7"/></svg>;
    case "talk":
      return <svg {...props}><path d="M5 9.5a7 7 0 0 1 14 0"/><path d="M8 19h8"/><path d="M10 15.5h4"/><path d="M12 8v7.5"/></svg>;
    case "poster":
      return <svg {...props}><rect x="5" y="4" width="14" height="11" rx="2"/><path d="m8 12 2.2-2.2a1 1 0 0 1 1.4 0l1.5 1.5 2.7-2.7a1 1 0 0 1 1.4 0L19 10.4"/><path d="M9 18h6"/><path d="M12 15v3"/></svg>;
    case "report":
      return <svg {...props}><path d="M7.5 4.5h9a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2Z"/><path d="M9 9.5h6"/><path d="M9 13h6"/><path d="M9 16.5h4"/></svg>;
    case "citations":
      return <svg {...props}><path d="M7 7.5h3v3H7z"/><path d="M14 13.5h3v3h-3z"/><path d="M10 9h4"/><path d="M14 9a4 4 0 0 1 4 4v.5"/><path d="M6 15a4 4 0 0 0 4 4h4"/></svg>;
    case "link":
      return <svg {...props}><path d="M10 13.5 14 9.5"/><path d="M8.5 16.5H7a4 4 0 0 1 0-8h3"/><path d="M13.5 7.5H17a4 4 0 0 1 0 8h-3"/></svg>;
    case "refresh":
      return <svg {...props}><path d="M20 6v5h-5"/><path d="M4 18v-5h5"/><path d="M19 11a7 7 0 0 0-12-4L5 9"/><path d="M5 13a7 7 0 0 0 12 4l2-2"/></svg>;
    case "edit":
      return <svg {...props}><path d="m4 20 4.2-1 8.8-8.8a2.2 2.2 0 0 0-3.1-3.1L5 15.9 4 20Z"/><path d="m12.5 6.5 5 5"/></svg>;
    case "logout":
      return <svg {...props}><path d="M9 4.5H6.5A2.5 2.5 0 0 0 4 7v10a2.5 2.5 0 0 0 2.5 2.5H9"/><path d="M14 8.5 19 12l-5 3.5"/><path d="M18.5 12H9"/></svg>;
    case "menu":
      return <svg {...props}><path d="M4.5 7.5h15"/><path d="M4.5 12h15"/><path d="M4.5 16.5h15"/></svg>;
    case "close":
      return <svg {...props}><path d="m7 7 10 10"/><path d="m17 7-10 10"/></svg>;
    case "check":
      return <svg {...props}><path d="m5.5 12.5 4 4L18.5 7.5"/></svg>;
    case "alert":
      return <svg {...props}><path d="M12 8v5"/><path d="M12 16.5h.01"/><path d="M10.2 4.8 4.9 14a2 2 0 0 0 1.7 3h10.8a2 2 0 0 0 1.7-3l-5.3-9.2a2 2 0 0 0-3.4 0Z"/></svg>;
    case "science":
      return <svg {...props}><path d="M9 4.5h6"/><path d="M10 4.5v4l-4.8 7.6a2.2 2.2 0 0 0 1.9 3.4h9.8a2.2 2.2 0 0 0 1.9-3.4L14 8.5v-4"/><path d="M9 12h6"/></svg>;
    case "archive":
      return <svg {...props}><path d="M4.5 7.5h15"/><path d="M6 7.5v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-10"/><path d="M10 12h4"/></svg>;
    case "github":
      return <svg {...props}><path d="M9 18.5c-4 .8-4-2-5.5-2.5"/><path d="M15 18.5v-3.1a3.2 3.2 0 0 0-.9-2.5c3 0 6-1.5 6-6a4.7 4.7 0 0 0-1.3-3.2 4.3 4.3 0 0 0-.1-3.2S17.5 0 15 1.8a11.5 11.5 0 0 0-6 0C6.5 0 5.3.5 5.3.5a4.3 4.3 0 0 0-.1 3.2A4.7 4.7 0 0 0 4 6.9c0 4.5 3 6 6 6a3.2 3.2 0 0 0-.9 2.5v3.1"/><path d="M9 18.5h6"/></svg>;
    case "download":
      return <svg {...props}><path d="M12 4.5v10" /><path d="m8 11.5 4 4 4-4" /><path d="M5 19.5h14" /></svg>;
    case "star":
      return <svg {...props}><path d="m12 4.5 2.2 4.4 4.8.7-3.5 3.4.8 4.8-4.3-2.3-4.3 2.3.8-4.8-3.5-3.4 4.8-.7z" /></svg>;
    case "chevron-right":
      return <svg {...props}><path d="m9 6 6 6-6 6" /></svg>;
    case "spark":
      return <svg {...props}><path d="m12 3.5 1.8 4.7 4.7 1.8-4.7 1.8L12 16.5l-1.8-4.7-4.7-1.8 4.7-1.8z"/><path d="M18.5 16.5 19.5 19l2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1z"/></svg>;
    default:
      return <svg {...props}><circle cx="12" cy="12" r="7"/></svg>;
  }
}

function Spinner({ size = 16, color = V }) {
  return (
    <div style={{ width: size, height: size, position: "relative", flexShrink: 0 }}>
      <div className="spin" style={{ position: "absolute", inset: 0, border: `2px solid ${color}20`, borderTopColor: color, borderRadius: "50%" }} />
      <div style={{ position: "absolute", inset: size * 0.28, borderRadius: "50%", background: color, boxShadow: `0 0 ${size * 0.5}px ${color}66` }} />
    </div>
  );
}

function BrandMark({ size = 40 }) {
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: size * 0.32,
      background: `radial-gradient(circle at 30% 30%, #ffffff 0%, ${V} 38%, ${B} 100%)`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: `0 18px 40px ${V}55, inset 0 1px 0 rgba(255,255,255,0.35)`,
      flexShrink: 0,
    }}>
      <Icon name="logo" size={size * 0.5} color="#fff" stroke={2.1} />
    </div>
  );
}

function LoadingScreen() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(circle at top, rgba(139,92,246,0.22), transparent 38%), linear-gradient(180deg, #04080f 0%, #07111f 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
      overflow: "hidden",
    }}>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 20% 20%, rgba(56,189,248,0.16), transparent 24%), radial-gradient(circle at 80% 10%, rgba(34,211,165,0.12), transparent 18%)" }} />
      <div style={{
        position: "relative",
        padding: "30px 34px",
        borderRadius: 28,
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(6,10,18,0.72)",
        boxShadow: "0 22px 60px rgba(0,0,0,0.45)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 14,
      }}>
        <div className="pulse"><BrandMark size={58} /></div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#dbeafe" }}>
          <Spinner size={20} color={B} />
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Loading your workspace</div>
            <div style={{ fontSize: 11, color: "#7c8aa5", marginTop: 2 }}>Syncing profile, tasks, and research signals</div>
          </div>
        </div>
      </div>
    </div>
  );
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
  return <div style={{ height: 56, borderRadius: 12, marginBottom: 8 }} className="shimmer" />;
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
          <div style={{ fontSize: 16, fontWeight: 700, color: "#f1f5f9", fontFamily: HEADER_FONT }}>{title}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 2 }}>
            <Icon name="close" size={18} color="#64748b" />
          </button>
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

/* â”€â”€â”€ STORAGE HELPERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const STORAGE_KEY = "Reeza_user_data";
const SYNC_DEBOUNCE_MS = 450;
function saveToStorage(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...data, lastSaved: new Date().toISOString() })); }
  catch (e) { console.error("Storage error:", e); }
}
function loadFromStorage() {
  try { const d = localStorage.getItem(STORAGE_KEY); return d ? JSON.parse(d) : null; }
  catch (e) { console.error("Storage error:", e); return null; }
}

/* â”€â”€â”€ METRIC CARD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function MetricCard({ icon, value, label, sub, color, delay = 0 }) {
  return (
    <div className="card fade-up" style={{
      animationDelay: `${delay}ms`,
      background: `linear-gradient(180deg, ${color}14 0%, rgba(8,12,20,0.88) 72%)`,
      border: `1px solid ${color}30`,
      borderRadius: 22,
      padding: "18px 18px",
      flex: 1,
      minWidth: 140,
      boxShadow: `inset 0 1px 0 rgba(255,255,255,0.05), 0 18px 34px ${color}12`,
      transition: "border-color 0.2s, transform 0.2s, box-shadow 0.2s",
      cursor: "default"
    }}>
      <div style={{
        width: 42,
        height: 42,
        borderRadius: 14,
        background: `${color}18`,
        border: `1px solid ${color}38`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 14,
      }}>
        <Icon name={icon} size={18} color={color} />
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color, fontFamily: "'JetBrains Mono',monospace", letterSpacing: "-1.5px", lineHeight: 1 }}>{typeof value === "number" ? value.toLocaleString() : value}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0", marginTop: 8 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: "#7c8aa5", marginTop: 5, lineHeight: 1.4 }}>{sub}</div>}
    </div>
  );
}

/* â”€â”€â”€ DASHBOARD VIEW â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function DashboardView({ profile, outputs, todos, integrations }) {
  const visibleOutputs = getVisibleItems(outputs);
  const visibleTodos = getVisibleItems(todos);
  const pubs = visibleOutputs.filter(o => ["Paper","Preprint","Report"].includes(o.type)).length;
  const datasets = visibleOutputs.filter(o => o.type === "Dataset").length;
  const repos = visibleOutputs.filter(o => ["Code","Software"].includes(o.type)).length;
  const talks = visibleOutputs.filter(o => ["Talk","Poster"].includes(o.type)).length;
  const citations = visibleOutputs.reduce((s, o) => s + (o.citations || 0), 0);
  const downloads = visibleOutputs.reduce((s, o) => s + (o.downloads || 0), 0);
  const stars = visibleOutputs.reduce((s, o) => s + (o.stars || 0), 0);
  const dois = visibleOutputs.filter(o => o.doi).length;
  const pending = visibleTodos.filter(t => !t.done);
  const highPrio = pending.filter(t => t.priority === "High");
  const byType = ["Paper","Preprint","Dataset","Code","Software","Talk","Poster","Report"]
    .map(t => ({ t, n: visibleOutputs.filter(o => o.type === t).length })).filter(x => x.n > 0);
  const maxN = Math.max(...byType.map(x => x.n), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
      <section style={{
        background: "linear-gradient(135deg, rgba(139,92,246,0.18) 0%, rgba(56,189,248,0.1) 45%, rgba(4,8,15,0.92) 100%)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 28,
        padding: "24px 24px 22px",
        boxShadow: "0 28px 60px rgba(2,6,23,0.45)",
        overflow: "hidden",
        position: "relative",
      }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at top right, rgba(34,211,165,0.16), transparent 28%), radial-gradient(circle at left center, rgba(139,92,246,0.18), transparent 34%)" }} />
        <div style={{ position: "relative", display: "grid", gridTemplateColumns: "1.7fr 1fr", gap: 18, alignItems: "stretch" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <BrandMark size={46} />
              <div>
                <div style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "#8ba3c7", fontFamily: "'JetBrains Mono',monospace" }}>Research Dashboard</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: "#f8fbff", marginTop: 2, fontFamily: HEADER_FONT, letterSpacing: "-0.03em" }}>{profile?.name || "Your"} signal overview</div>
              </div>
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.7, color: "#bfd0ea", maxWidth: 640 }}>
              Track publications, datasets, code, and pending work in one place with a cleaner sync-aware workspace.
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18 }}>
              <Chip color={V}>Outputs {visibleOutputs.length}</Chip>
              <Chip color={B}>Citations {citations}</Chip>
              <Chip color={G}>Datasets {datasets}</Chip>
              <Chip color={A}>Open Tasks {pending.length}</Chip>
            </div>
          </div>
          <div style={{
            background: "rgba(8,12,20,0.64)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 22,
            padding: "16px 18px",
            backdropFilter: "blur(10px)",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <SectionLabel small noMargin>Live Snapshot</SectionLabel>
              <Chip color={highPrio.length > 0 ? "#f87171" : G} small>{highPrio.length > 0 ? `${highPrio.length} urgent` : "In flow"}</Chip>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[
                { label: "Portfolio", value: visibleOutputs.filter(o => o.inPortfolio).length, color: V },
                { label: "Connected", value: Object.values(integrations).filter(s => s?.status === "ok").length, color: G },
                { label: "Talks", value: talks, color: P },
                { label: "Code Stars", value: stars, color: A },
              ].map((item) => (
                <div key={item.label} style={{ padding: "12px 13px", borderRadius: 16, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <div style={{ fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "#70819e", fontFamily: "'JetBrains Mono',monospace" }}>{item.label}</div>
                  <div style={{ marginTop: 8, fontSize: 21, fontWeight: 800, color: item.color, fontFamily: "'JetBrains Mono',monospace" }}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 12, marginTop: 18, position: "relative" }}>
          <MetricCard icon="paper" value={pubs}      label="Publications" sub="papers & preprints"                        color={V} delay={0}   />
          <MetricCard icon="dataset" value={datasets}  label="Datasets"     sub={`${downloads.toLocaleString()} downloads`} color={G} delay={50}  />
          <MetricCard icon="code" value={repos}     label="Code"         sub={`${stars.toLocaleString()} tracked stars`}                             color={A} delay={100} />
          <MetricCard icon="talk" value={talks}     label="Talks"        sub="talks & posters"                                 color={P} delay={150} />
          <MetricCard icon="citations" value={citations} label="Citations"    sub="combined across outputs"                                  color={B} delay={200} />
          <MetricCard icon="link" value={dois}      label="DOIs"         sub="linked records"                                   color="#fb923c" delay={250} />
        </div>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div className="card fade-up" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "18px 20px", animationDelay: "80ms" }}>
          <SectionLabel small>Output Types</SectionLabel>
          {byType.length === 0
            ? <Empty>No outputs yet â€” connect a source or add manually.</Empty>
            : byType.map((x, i) => (
              <div key={x.t} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 9 }}>
                <div style={{ width: 94, fontSize: 11, color: "#64748b", fontFamily: "'JetBrains Mono',monospace", flexShrink: 0, display: "flex", alignItems: "center", gap: 6 }}>
                  <Icon name={typeIcon[x.t]} size={14} color={typeColor(x.t)} />
                  {x.t}
                </div>
                <div style={{ flex: 1, height: 5, background: "rgba(255,255,255,0.06)", borderRadius: 99, overflow: "hidden" }}>
                  <div style={{ width: `${(x.n / maxN) * 100}%`, height: "100%", background: typeColor(x.t), borderRadius: 99, transition: "width 0.9s cubic-bezier(.22,1,.36,1)", transitionDelay: `${i * 60}ms` }} />
                </div>
                <div style={{ width: 24, textAlign: "right", fontSize: 11, fontWeight: 700, color: typeColor(x.t), fontFamily: "'JetBrains Mono',monospace" }}>{x.n}</div>
              </div>
            ))
          }
        </div>

        <div className="card fade-up" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "18px 20px", animationDelay: "120ms" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <SectionLabel small noMargin>Pending Work</SectionLabel>
            {highPrio.length > 0 && <Chip color="#f87171" small>{highPrio.length} urgent</Chip>}
          </div>
          {pending.length === 0
            ? <Empty><span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Icon name="spark" size={14} color={G} />Nothing pending.</span></Empty>
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

      <div className="card fade-up" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "18px 20px", animationDelay: "160ms" }}>
        <SectionLabel small>Live Data Sources</SectionLabel>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {[
            { name: "ORCID",    color: "#a6ce39", key: "orcid"    },
            { name: "Zenodo",   color: G,         key: "zenodo"   },
            { name: "GitHub",   color: A,         key: "github"   },
            { name: "CrossRef", color: B,         key: "crossref" },
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

/* â”€â”€â”€ PROJECTS VIEW â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function ProjectsView({ outputs, setOutputs, integrations, onSync }) {
  const [showAdd, setShowAdd] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [form, setForm] = useState({ type: "Paper", title: "", platform: "Zenodo", year: new Date().getFullYear(), citations: 0, downloads: 0, stars: 0, doi: "", version: "" });
  const visibleOutputs = getVisibleItems(outputs);

  function add() {
    if (!form.title.trim()) return;
    setOutputs((current) => [
      ...current,
      markItemUpdated(
        {
          id: `manual-${Math.random().toString(36).slice(2)}`,
          source: "manual",
          createdAt: nowIso(),
        },
        {
          ...form,
          citations: +form.citations,
          downloads: +form.downloads,
          stars: +form.stars,
        },
      ),
    ]);
    setShowAdd(false);
    setForm({ type: "Paper", title: "", platform: "Zenodo", year: new Date().getFullYear(), citations: 0, downloads: 0, stars: 0, doi: "", version: "" });
  }

  function remove(id) {
    setOutputs((current) => current.map((output) => (
      output.id === id ? markItemDeleted(output) : output
    )));
  }

  const grouped = {};
  visibleOutputs.forEach(o => { const k = o.year || "Unknown"; if (!grouped[k]) grouped[k] = []; grouped[k].push(o); });
  const years = Object.keys(grouped).sort((a, b) => b - a);
  const isAnySyncing = Object.values(integrations).some(i => i.status === "loading");

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <SectionLabel noMargin>{visibleOutputs.length} Research Outputs</SectionLabel>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={onSync} disabled={isAnySyncing} style={{
            display: "flex", alignItems: "center", gap: 6, padding: "8px 14px",
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 10, color: isAnySyncing ? "#334155" : "#94a3b8", fontSize: 12, fontWeight: 600, cursor: isAnySyncing ? "not-allowed" : "pointer", transition: "all 0.15s"
          }}>
            {isAnySyncing ? <Spinner size={12} /> : <Icon name="refresh" size={14} color="#94a3b8" />} Sync All
          </button>
          <button className="btn" onClick={() => setShowAdd(true)} style={{
            padding: "8px 16px", background: `${V}20`, border: `1px solid ${V}44`,
            borderRadius: 10, color: "#a78bfa", fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "all 0.15s"
          }}>+ Add Output</button>
        </div>
      </div>

      {visibleOutputs.length === 0 && !isAnySyncing && <Empty center>No outputs yet. Connect a source in Integrations or add manually.</Empty>}
      {isAnySyncing && [1,2,3].map(i => <SkeletonRow key={i} />)}

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
            const inPortfolio = !!o.inPortfolio;
            return (
              <div key={o.id} style={{ background: inPortfolio ? "rgba(139,92,246,0.06)" : "rgba(255,255,255,0.025)", border: `1px solid ${inPortfolio ? V+"44" : isExp ? c+"44" : "rgba(255,255,255,0.07)"}`, borderRadius: 13, overflow: "hidden", marginBottom: 7, transition: "border-color 0.2s, background 0.2s" }}>
                <div style={{ padding: "12px 15px", display: "flex", alignItems: "center", gap: 12 }}>

                  {/* Portfolio checkbox */}
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      setOutputs((current) => current.map((output) => (
                        output.id === o.id ? markItemUpdated(output, { inPortfolio: !output.inPortfolio }) : output
                      )));
                    }}
                    title={inPortfolio ? "Remove from portfolio" : "Add to portfolio"}
                    style={{ flexShrink: 0, width: 22, height: 22, borderRadius: 6, border: `2px solid ${inPortfolio ? V : "rgba(255,255,255,0.15)"}`, background: inPortfolio ? V : "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.18s", boxShadow: inPortfolio ? `0 0 8px ${V}66` : "none" }}
                  >
                    {inPortfolio && (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </button>

                  <div onClick={() => setExpanded(isExp ? null : o.id)} style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, cursor: "pointer", minWidth: 0 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 9, background: `${c}18`, border: `1px solid ${c}28`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon name={typeIcon[o.type] || "paper"} size={16} color={c} />
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
                    {o.citations > 0 && <span style={{ fontSize: 11, color: V, fontFamily: "'JetBrains Mono',monospace", display: "inline-flex", alignItems: "center", gap: 4 }}><Icon name="citations" size={12} color={V} />{o.citations}</span>}
                    {o.downloads > 0 && <span style={{ fontSize: 11, color: G, fontFamily: "'JetBrains Mono',monospace", display: "inline-flex", alignItems: "center", gap: 4 }}><Icon name="download" size={12} color={G} />{o.downloads.toLocaleString()}</span>}
                    {o.stars > 0 && <span style={{ fontSize: 11, color: A, fontFamily: "'JetBrains Mono',monospace", display: "inline-flex", alignItems: "center", gap: 4 }}><Icon name="star" size={12} color={A} />{o.stars}</span>}
                    <span style={{ color: "#334155", display: "inline-flex", transform: isExp ? "rotate(90deg)" : "none", transition: "transform 0.2s" }}><Icon name="chevron-right" size={15} color="#475569" /></span>
                  </div>
                  </div>{/* end clickable row */}
                </div>
                {isExp && (
                  <div style={{ padding: "0 15px 14px", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 12 }}>
                    {o.doi && <div style={{ fontSize: 11, color: "#475569", fontFamily: "'JetBrains Mono',monospace", marginBottom: 10, wordBreak: "break-all" }}>DOI: <a href={`https://doi.org/${o.doi}`} target="_blank" rel="noopener noreferrer" style={{ color: B, textDecoration: "none" }}>{o.doi}</a></div>}
                    {o.description && <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10, lineHeight: 1.5 }}>{o.description}</div>}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                      {o.citations > 0 && <StatBadge icon="citations" label="citations" value={o.citations} color={V} />}
                      {o.downloads > 0 && <StatBadge icon="download" label="downloads" value={o.downloads} color={G} />}
                      {o.stars > 0 && <StatBadge icon="star" label="stars" value={o.stars} color={A} />}
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
      <div style={{ fontSize: 10, color: "#475569", display: "flex", alignItems: "center", gap: 6 }}>
        <Icon name={icon} size={11} color={color} />
        {label}
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color, fontFamily: "'JetBrains Mono',monospace" }}>{value.toLocaleString()}</div>
    </div>
  );
}

/* â”€â”€â”€ INTEGRATIONS VIEW â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function IntegrationsView({ integrations, creds, setCreds, onSync }) {
  const [showSetup, setShowSetup] = useState(null);
  const [localCreds, setLocalCreds] = useState({ ...creds });

  useEffect(() => {
    setLocalCreds({ ...creds });
  }, [creds]);

  function saveAndSync(platform) {
    setCreds((current) => stampSection(current, localCreds));
    setShowSetup(null);
    onSync(platform, localCreds);
  }

  const sources = [
    { key: "orcid",    name: "ORCID",    icon: "science", color: "#a6ce39", desc: "Pulls all your publications, preprints and datasets from your public ORCID record.", apiNote: "Public API · No authentication required",               field: { label: "ORCID ID",              key: "orcidId",        placeholder: "0000-0001-2345-6789",                                          type: "text"     } },
    { key: "zenodo",   name: "Zenodo",   icon: "archive", color: G,         desc: "Imports all your Zenodo deposits with download statistics.",                          apiNote: "Zenodo REST API · Requires personal access token",         field: { label: "Personal Access Token", key: "zenodoToken",    placeholder: "your token from zenodo.org/account/settings/applications",    type: "password" } },
    { key: "github",   name: "GitHub",   icon: "github",  color: A,         desc: "Fetches your public repos with star counts, languages and descriptions.",             apiNote: "GitHub REST API · Username only (public repos)",           field: { label: "GitHub Username",       key: "githubUsername", placeholder: "your-github-username",                                         type: "text"     } },
    { key: "crossref", name: "CrossRef", icon: "link",    color: B,         desc: "Auto-enriches citation counts for all outputs that have a DOI.",                     apiNote: "CrossRef API · Runs automatically when outputs have DOIs", field: null },
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
          <div key={s.key} className="card" style={{ background: "rgba(255,255,255,0.025)", border: `1px solid ${isOk ? s.color+"35" : "rgba(255,255,255,0.07)"}`, borderRadius: 16, padding: "18px 20px", transition: "border-color 0.2s" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
              <div style={{ width: 48, height: 48, borderRadius: 16, flexShrink: 0, marginTop: 2, display: "flex", alignItems: "center", justifyContent: "center", background: `${s.color}16`, border: `1px solid ${s.color}30`, boxShadow: `inset 0 1px 0 rgba(255,255,255,0.04), 0 10px 24px ${s.color}12` }}>
                <Icon name={s.icon} size={21} color={s.color} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9", marginBottom: 3 }}>{s.name}</div>
                    <div style={{ fontSize: 12, color: "#475569", marginBottom: 2 }}>{s.desc}</div>
                    <div style={{ fontSize: 11, color: "#334155", fontFamily: "'JetBrains Mono',monospace" }}>{s.apiNote}</div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    {isOk && (
                      <Chip color={s.color}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <Icon name="check" size={12} color={s.color} />
                          Connected
                        </span>
                      </Chip>
                    )}
                    {isError && (
                      <Chip color="#f87171">
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <Icon name="alert" size={12} color="#f87171" />
                          Error
                        </span>
                      </Chip>
                    )}
                    {isLoading && <div style={{ display: "flex", alignItems: "center", gap: 6 }}><Spinner size={12} color={s.color} /></div>}
                    {!isOk && !isLoading && <Chip color="#475569">Not Set</Chip>}
                  </div>
                </div>
              </div>
            </div>
            {hasKey && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                <button onClick={() => setShowSetup(s.key)} style={{ padding: "8px 14px", background: `${s.color}30`, border: `1px solid ${s.color}50`, borderRadius: 8, color: s.color, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>{isOk ? "Update" : "Configure"}</button>
                {isOk && <button onClick={() => onSync(s.key, localCreds)} style={{ marginLeft: 8, padding: "8px 14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#94a3b8", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Sync Now</button>}
                {isError && state.error && <div style={{ marginTop: 8, fontSize: 11, color: "#f87171", padding: "8px 12px", background: "rgba(248,113,113,0.1)", borderRadius: 6 }}>{state.error}</div>}
              </div>
            )}
            {!hasKey && s.field && (
              <div style={{ marginTop: 14 }}>
                <input type={s.field.type} value={localCreds[s.field.key] || ""} onChange={e => setLocalCreds(c => ({ ...c, [s.field.key]: e.target.value }))} placeholder={s.field.placeholder} style={{ ...INP, marginBottom: 10 }} />
                <button onClick={() => saveAndSync(s.key)} style={{ padding: "8px 14px", background: `${s.color}30`, border: `1px solid ${s.color}50`, borderRadius: 8, color: s.color, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Save & Sync</button>
              </div>
            )}
            {showSetup === s.key && s.field && (
              <Modal title={`Update ${s.name}`} onClose={() => setShowSetup(null)}>
                <Field label={s.field.label}>
                  <input type={s.field.type} value={localCreds[s.field.key] || ""} onChange={e => setLocalCreds(c => ({ ...c, [s.field.key]: e.target.value }))} placeholder={s.field.placeholder} style={INP} autoFocus />
                </Field>
                <button onClick={() => saveAndSync(s.key)} style={{ width: "100%", padding: "11px", background: `${s.color}22`, border: `1px solid ${s.color}55`, borderRadius: 12, color: s.color, fontSize: 14, fontWeight: 700, cursor: "pointer", marginTop: 6 }}>Save & Sync</button>
              </Modal>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* â”€â”€â”€ TODO VIEW â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function TodoView({ todos, setTodos }) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: "", priority: "Medium", due: "" });
  const visibleTodos = getVisibleItems(todos);

  function add() {
    if (!form.title.trim()) return;
    setTodos((current) => [
      ...current,
      markItemUpdated(
        {
          id: `todo-${Date.now()}`,
          done: false,
          createdAt: nowIso(),
        },
        form,
      ),
    ]);
    setShowAdd(false);
    setForm({ title: "", priority: "Medium", due: "" });
  }
  function toggle(id) {
    setTodos((current) => current.map((todo) => (
      todo.id === id ? markItemUpdated(todo, { done: !todo.done }) : todo
    )));
  }
  function remove(id) {
    setTodos((current) => current.map((todo) => (
      todo.id === id ? markItemDeleted(todo) : todo
    )));
  }

  const pending = visibleTodos.filter(t => !t.done);
  const done = visibleTodos.filter(t => t.done);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <SectionLabel noMargin>{visibleTodos.length} Tasks</SectionLabel>
        <button onClick={() => setShowAdd(true)} className="btn" style={{ padding: "8px 16px", background: `${V}20`, border: `1px solid ${V}44`, borderRadius: 10, color: "#a78bfa", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>+ Add Task</button>
      </div>

      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", marginBottom: 10, fontFamily: "'JetBrains Mono',monospace", letterSpacing: "0.08em" }}>PENDING</div>
        {pending.length === 0 ? <Empty><span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Icon name="spark" size={14} color={G} />All caught up!</span></Empty> : pending.map(t => (
          <div key={t.id} style={{ display: "flex", gap: 12, padding: "10px 14px", marginBottom: 8, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10, alignItems: "flex-start" }}>
            <input type="checkbox" checked={t.done} onChange={() => toggle(t.id)} style={{ marginTop: 3, cursor: "pointer", accentColor: prioColor(t.priority) }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: "#e2e8f0", marginBottom: 2 }}>{t.title}</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <Chip color={prioColor(t.priority)} small>{t.priority}</Chip>
                {t.due && <span style={{ fontSize: 11, color: "#475569", fontFamily: "'JetBrains Mono',monospace" }}>{t.due}</span>}
              </div>
            </div>
            <button onClick={() => remove(t.id)} style={{ background: "none", border: "none", color: "#334155", cursor: "pointer", fontSize: 16 }}>Ã—</button>
          </div>
        ))}
      </div>

      {done.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", marginBottom: 10, fontFamily: "'JetBrains Mono',monospace", letterSpacing: "0.08em" }}>COMPLETED</div>
          {done.map(t => (
            <div key={t.id} style={{ display: "flex", gap: 12, padding: "10px 14px", marginBottom: 8, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10, alignItems: "flex-start", opacity: 0.6 }}>
              <input type="checkbox" checked={t.done} onChange={() => toggle(t.id)} style={{ marginTop: 3, cursor: "pointer", accentColor: G }} />
              <div style={{ flex: 1, minWidth: 0, textDecoration: "line-through" }}>
                <div style={{ fontSize: 13, color: "#64748b", marginBottom: 2 }}>{t.title}</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <Chip color={prioColor(t.priority)} small>{t.priority}</Chip>
                  {t.due && <span style={{ fontSize: 11, color: "#475569", fontFamily: "'JetBrains Mono',monospace" }}>{t.due}</span>}
                </div>
              </div>
              <button onClick={() => remove(t.id)} style={{ background: "none", border: "none", color: "#334155", cursor: "pointer", fontSize: 16 }}>Ã—</button>
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

/* â”€â”€â”€ HELPERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function Empty({ children, center }) {
  return <div style={{ padding: "28px 14px", textAlign: center ? "center" : "left", color: "#334155", fontSize: 13, fontStyle: "italic" }}>{children}</div>;
}
function SectionLabel({ children, small, noMargin }) {
  return <div style={{ fontSize: small ? 12 : 16, fontWeight: 700, color: "#e2e8f0", marginBottom: noMargin ? 0 : 16, fontFamily: HEADER_FONT, letterSpacing: "-0.02em" }}>{children}</div>;
}

/* â”€â”€â”€ PROFILE SETUP MODAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function LoginModal({ onComplete }) {
  const [form, setForm] = useState({ name: "", affiliation: "", bio: "" });
  const [step, setStep] = useState("welcome");

  function handleSubmit() {
    if (!form.name.trim() || !form.affiliation.trim()) { alert("Please fill in your name and affiliation"); return; }
    onComplete(form);
    setStep("done");
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.95)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#0d1220", border: "2px solid " + V + "55", borderRadius: 24, padding: "40px 50px", maxWidth: 520, textAlign: "center", animation: "fadeUp 0.5s ease both" }}>
        {step === "welcome" && <>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}><BrandMark size={56} /></div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#e2e8f0", marginBottom: 14, fontFamily: HEADER_FONT }}>Welcome to Reeza</h1>
          <p style={{ fontSize: 14, color: "#64748b", marginBottom: 28, lineHeight: 1.6 }}>Your personal research portfolio & publication tracker. Let's get you set up!</p>
          <button onClick={() => setStep("form")} style={{ width: "100%", padding: "12px", background: `${V}22`, border: `1px solid ${V}55`, borderRadius: 12, color: "#a78bfa", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Get Started</button>
        </>}
        {step === "form" && <>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#e2e8f0", marginBottom: 24, fontFamily: HEADER_FONT }}>Create Your Profile</h2>
          {[
            { label: "Full Name *",      key: "name",        placeholder: "Dr. Jane Smith",               type: "input"    },
            { label: "Affiliation *",    key: "affiliation", placeholder: "MIT, Stanford, etc.",           type: "input"    },
            { label: "Bio (optional)",   key: "bio",         placeholder: "AI & ML Research, ...",        type: "textarea" },
          ].map(f => (
            <div key={f.key} style={{ marginBottom: 16, textAlign: "left" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", marginBottom: 8, fontFamily: "'JetBrains Mono',monospace", letterSpacing: "0.08em", textTransform: "uppercase" }}>{f.label}</div>
              {f.type === "textarea"
                ? <textarea value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder} style={{ ...INP, fontFamily: "inherit", minHeight: 70, resize: "vertical" }} />
                : <input value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder} style={INP} autoFocus={f.key === "name"} />
              }
            </div>
          ))}
          <button onClick={handleSubmit} style={{ width: "100%", padding: "12px", background: `${V}22`, border: `1px solid ${V}55`, borderRadius: 12, color: "#a78bfa", fontSize: 14, fontWeight: 700, cursor: "pointer", marginBottom: 10 }}>Create Profile</button>
          <button onClick={() => setStep("welcome")} style={{ width: "100%", padding: "12px", background: "transparent", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#64748b", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Back</button>
        </>}
        {step === "done" && <>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}><Icon name="spark" size={34} color={G} /></div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#e2e8f0", marginBottom: 10, fontFamily: HEADER_FONT }}>All Set!</h2>
          <p style={{ fontSize: 13, color: "#64748b" }}>Welcome {form.name}! Your profile is ready.</p>
        </>}
      </div>
    </div>
  );
}

/* â”€â”€â”€ AUTH GATE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
export default function App() {
  const { session, loading: authLoading, signIn, signUp } = useAuth();

  if (authLoading) {
    return <LoadingScreen />;
  }

  if (!session) {
    return <AuthScreen signIn={signIn} signUp={signUp} />;
  }

  return <AppInner user={session.user} />;
}

/* â”€â”€â”€ MAIN APP â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function AppInner({ user }) {
  const { signOut } = useAuth();

  const storedData = useRef(normalizeUserData(loadFromStorage())).current;
  const isFirstVisit = !storedData?.profile?.name;

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

  const [view, setView]                 = useState("dashboard");
  const [showLogin, setShowLogin]       = useState(isFirstVisit);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [hydrated, setHydrated]         = useState(false);
  const [profile, setProfile]           = useState(storedData?.profile       || stampSection({}, { name: "", affiliation: "", bio: "" }));
  const [outputs, setOutputs]           = useState(storedData?.outputs       || []);
  const [todos, setTodos]               = useState(storedData?.todos?.length ? storedData.todos : defaultTodos);
  const [integrations, setIntegrations] = useState(storedData?.integrations  || defaultIntegrations);
  const [creds, setCreds]               = useState(storedData?.creds         || stampSection({}, { orcidId: "", zenodoToken: "", githubUsername: "" }));
  const [lastSync, setLastSync]         = useState(storedData?.lastSync      || null);
  const applyingRemoteRef = useRef(false);
  const saveTimerRef = useRef(null);
  const saveInFlightRef = useRef(false);
  const saveQueuedRef = useRef(false);
  const latestSnapshotRef = useRef(storedData);
  const syncRef = useRef(null);

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
    setShowLogin(!normalized.profile?.name);
  }, []);

  const flushSave = useCallback(async (snapshot) => {
    if (!snapshot) return;
    if (saveInFlightRef.current) {
      saveQueuedRef.current = true;
      return;
    }

    saveInFlightRef.current = true;
    try {
      const saved = await saveUserData(null, snapshot);
      if (saved) {
        saveToStorage(saved);
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

  // â”€â”€ Load from Supabase on mount â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
      } catch (err) {
        console.warn("Could not fetch from Supabase, using local cache:", err);
      }

      if (!cancelled && storedData) {
        applySnapshot(storedData);
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
      } catch (err) {
        console.warn("Realtime sync unavailable:", err);
      }
    })();

    return () => {
      active = false;
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, [applySnapshot, user.id]);

  // â”€â”€ Save to Supabase + localStorage on every change â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    const snapshot = normalizeUserData({ profile, outputs, todos, integrations, creds, lastSync });
    latestSnapshotRef.current = snapshot;
    saveToStorage(snapshot);

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

  // â”€â”€ Hourly sync â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    if (!hydrated) return undefined;
    const timer = setInterval(() => {
      setLastSync(nowIso());
      if (syncRef.current) {
        syncRef.current(null, creds);
      }
    }, 3600000);
    return () => clearInterval(timer);
  }, [creds, hydrated]);

  const sync = useCallback(async (platform, localCreds = creds) => {
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
        setIntegrationState(key, { status: "error", count: 0, error: e.message });
      }
    };

    if (!platform || platform === "orcid")    { if (localCreds.orcidId)        await doSync("orcid",  () => fetchORCID(localCreds.orcidId).then(enrichWithCitations)); }
    if (!platform || platform === "zenodo")   { if (localCreds.zenodoToken)    await doSync("zenodo", () => fetchZenodo(localCreds.zenodoToken)); }
    if (!platform || platform === "github")   { if (localCreds.githubUsername) await doSync("github", () => fetchGitHub(localCreds.githubUsername)); }
    if (!platform || platform === "crossref") {
      const existing = getVisibleItems(outputs).filter(o => o.doi && ["Paper","Preprint","Report"].includes(o.type));
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
  }, [creds, integrations, outputs]);
  syncRef.current = sync;

  return (
    <>
      <style>{CSS}</style>
      {showLogin && <LoginModal onComplete={p => { setProfile((current) => stampSection(current, p)); setShowLogin(false); }} />}
      <div style={{ display: "flex", flexDirection: "column", width: "100vw", height: "100vh", background: "radial-gradient(circle at top, rgba(139,92,246,0.18), transparent 24%), linear-gradient(180deg, #030712 0%, #07101d 100%)", color: "#e2e8f0", fontFamily: "'Inter','Syne',sans-serif", overflow: "hidden" }}>
        {/* Header */}
        <header style={{ background: "linear-gradient(180deg, rgba(6,10,18,0.96), rgba(6,10,18,0.82))", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 50, flexShrink: 0, boxShadow: "0 18px 40px rgba(0,0,0,0.22)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, fontFamily: HEADER_FONT, letterSpacing: "-0.03em" }}>{profile.name || "Researcher"}</div>
              <div style={{ fontSize: 10, color: "#6f86a8" }}>{profile.affiliation || "Unified research workspace"}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div className="desktop-nav" style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {NAV_ITEMS.map(tab => {
                const active = view === tab.id;
                return (
                  <button key={tab.id} onClick={() => { setView(tab.id); setMobileMenuOpen(false); }} className="nav-item" style={{
                    padding: "9px 13px",
                    background: active ? "linear-gradient(180deg, rgba(139,92,246,0.18), rgba(139,92,246,0.08))" : "rgba(255,255,255,0.02)",
                    border: active ? "1px solid rgba(139,92,246,0.4)" : "1px solid rgba(255,255,255,0.05)",
                    borderRadius: 12,
                    color: active ? "#eef2ff" : "#8ea0bc",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    transition: "all 0.15s",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    boxShadow: active ? "0 12px 28px rgba(139,92,246,0.16)" : "none"
                  }}>
                    <Icon name={tab.icon} size={14} color={active ? "#c4b5fd" : "#70839f"} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
            <button onClick={() => setShowLogin(true)} style={{ width: 36, height: 36, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, color: "#94a3b8", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }} title="Edit profile">
              <Icon name="edit" size={15} color="#94a3b8" />
            </button>
            <button onClick={signOut} style={{ fontSize: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, color: "#cbd5e1", cursor: "pointer", padding: "8px 12px", display: "flex", alignItems: "center", gap: 8, fontWeight: 700 }}>
              <Icon name="logout" size={14} color="#94a3b8" />
              <span>Sign out</span>
            </button>
            {lastSync && <span className="last-sync" style={{ fontSize: 9, color: "#4b5d79", fontFamily: "'JetBrains Mono',monospace" }}>synced {new Date(lastSync).toLocaleTimeString()}</span>}
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="hamburger-btn" style={{ display: "none", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, color: "#94a3b8", cursor: "pointer", padding: 8, alignItems: "center", justifyContent: "center" }}>
              <Icon name="menu" size={18} color="#94a3b8" />
            </button>
          </div>
        </header>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div style={{ background: "rgba(6,10,18,0.98)", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", flexDirection: "column", gap: 6, padding: "10px 12px", zIndex: 49 }} className="mobile-menu">
            {NAV_ITEMS.map(tab => {
              const active = view === tab.id;
              return (
                <button key={tab.id} onClick={() => { setView(tab.id); setMobileMenuOpen(false); }} style={{
                  padding: "11px 12px",
                  background: active ? "rgba(139,92,246,0.16)" : "transparent",
                  border: active ? "1px solid rgba(139,92,246,0.36)" : "1px solid rgba(255,255,255,0.04)",
                  borderRadius: 12,
                  color: active ? "#eef5ff" : "#a0aec0",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all 0.15s",
                  textAlign: "left",
                  display: "flex",
                  alignItems: "center",
                  gap: 10
                }}>
                  <Icon name={tab.icon} size={15} color={active ? "#c4b5fd" : "#7f91ae"} />
                  {tab.label}
                </button>
              );
            })}
            <button onClick={signOut} style={{ padding: "11px 12px", background: "transparent", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 12, color: "#a0aec0", fontSize: 13, fontWeight: 700, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 10 }}>
              <Icon name="logout" size={15} color="#7f91ae" />
              Sign out
            </button>
          </div>
        )}

        {/* Content */}
        <main style={{ padding: "20px 24px", width: "100%", flex: 1, overflow: "auto" }}>
          {view === "dashboard"    && <DashboardView    profile={profile} outputs={outputs} todos={todos} integrations={integrations} />}
          {view === "projects"     && <ProjectsView     outputs={outputs} setOutputs={setOutputs} integrations={integrations} onSync={sync} />}
          {view === "integrations" && <IntegrationsView integrations={integrations} creds={creds} setCreds={setCreds} onSync={sync} />}
          {view === "todo"         && <TodoView         todos={todos} setTodos={setTodos} />}
        </main>
      </div>
    </>
  );
}


