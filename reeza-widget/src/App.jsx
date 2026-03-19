import { useEffect, useMemo, useRef, useState } from "react";
import { playReminderSound } from "./avatar-utils.js";
import { fetchWidgetData, getSession, onAuthStateChange, signIn, signOut, subscribeToWidgetData } from "./widget-data.js";

const STORAGE_KEYS = {
  avatar: "reeza_widget_avatar",
  sound: "reeza_widget_sound",
};

const FACE_FRAMES = [
  { mood: "smile", mouth: "smile" },
  { mood: "talk", mouth: "grin-big" },
  { mood: "neutral", mouth: "smirk" },
  { mood: "talk", mouth: "grin-soft" },
  { mood: "neutral", mouth: "side" },
];

function WidgetIcon({ name }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };

  switch (name) {
    case "minus":
      return <svg {...common}><path d="M5 12h14" /></svg>;
    case "settings":
      return <svg {...common}><circle cx="12" cy="12" r="3.2" /><path d="M12 2.8v2.4" /><path d="M12 18.8v2.4" /><path d="m4.9 4.9 1.7 1.7" /><path d="m17.4 17.4 1.7 1.7" /><path d="M2.8 12h2.4" /><path d="M18.8 12h2.4" /><path d="m4.9 19.1 1.7-1.7" /><path d="m17.4 6.6 1.7-1.7" /></svg>;
    default:
      return <svg {...common}><circle cx="12" cy="12" r="8" /></svg>;
  }
}

function getDisplayName(profile, session) {
  return profile?.name || session?.user?.email || "friend";
}

function firstNameOf(value) {
  if (!value) return "friend";
  return value.split(/[\s@._-]+/).filter(Boolean)[0] || "friend";
}

function pickRandom(list) {
  if (!list.length) return null;
  return list[Math.floor(Math.random() * list.length)];
}

function buildCompanionMessages(name, todos) {
  const firstName = firstNameOf(name);
  const warmNotes = [
    { id: "hello", title: `Hello ${firstName}, I missed you...`, meta: "your tiny desktop friend" },
    { id: "start", title: "When are we going to start working?", meta: "I can keep you company" },
    { id: "studied", title: "Studied yet?", meta: "even a small step counts" },
    { id: "project", title: "Want to make a cool project?", meta: "we could start tiny" },
    { id: "water", title: "Have some water.", meta: "hydration first" },
    { id: "youcan", title: "You can do it!", meta: "I believe in you" },
    { id: "rest", title: "Do you need some rest?", meta: "gentle pace is still progress" },
    { id: "done", title: "Have you got things done?", meta: "I am cheering for you" },
    { id: "score", title: "Aiming for a good score!", meta: "let's make it happen" },
    { id: "coffee", title: "Let's have a coffee...", meta: "then back to focus" },
  ];

  const taskPrompts = todos.slice(0, 3).map((todo) => ({
    id: `task-${todo.id}`,
    title: todo.title,
    meta: `${todo.priority}${todo.due ? ` - Due ${todo.due}` : ""}`,
    kind: "task",
  }));

  return [
    ...warmNotes.map((note) => ({ ...note, kind: "friend" })),
    ...taskPrompts,
  ];
}

export default function App() {
  const fileInputRef = useRef(null);
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [launchAtLogin, setLaunchAtLogin] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const [todos, setTodos] = useState([]);
  const [profile, setProfile] = useState(null);
  const [dataLoading, setDataLoading] = useState(false);

  const [avatarSrc, setAvatarSrc] = useState(() => localStorage.getItem(STORAGE_KEYS.avatar) || "");
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem(STORAGE_KEYS.sound) !== "off");
  const [currentMessage, setCurrentMessage] = useState(null);
  const [moodIndex, setMoodIndex] = useState(0);

  useEffect(() => {
    window.desktopWidget?.getSettings?.().then((nextSettings) => {
      if (typeof nextSettings?.launchAtLogin === "boolean") {
        setLaunchAtLogin(nextSettings.launchAtLogin);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    let alive = true;

    getSession()
      .then((nextSession) => {
        if (!alive) return;
        setSession(nextSession);
        setAuthLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        setAuthLoading(false);
      });

    const unsubscribe = onAuthStateChange((nextSession) => {
      if (!alive) return;
      setSession(nextSession);
      setError("");
      setAuthLoading(false);
    });

    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) {
      setTodos([]);
      setProfile(null);
      setCurrentMessage(null);
      return undefined;
    }

    let active = true;
    let cleanup = () => {};

    setDataLoading(true);
    fetchWidgetData()
      .then((data) => {
        if (!active) return;
        setTodos(data.todos);
        setProfile(data.profile);
      })
      .finally(() => {
        if (active) setDataLoading(false);
      });

    subscribeToWidgetData((data) => {
      if (!active) return;
      setTodos(data.todos);
      setProfile(data.profile);
    }).then((unsubscribe) => {
      cleanup = unsubscribe;
    });

    return () => {
      active = false;
      cleanup();
    };
  }, [session]);

  useEffect(() => {
    if (!session) return undefined;

    const displayName = getDisplayName(profile, session);
    const messages = buildCompanionMessages(displayName, todos);
    let active = true;
    let showTimer = null;
    let hideTimer = null;

    const scheduleNext = (delay = 5000) => {
      showTimer = window.setTimeout(() => {
        if (!active) return;
        const nextMessage = pickRandom(messages);
        setCurrentMessage(nextMessage);
        if (soundEnabled && nextMessage?.kind === "task") {
          playReminderSound(0.03);
        }
        setMoodIndex((current) => (current + 1) % FACE_FRAMES.length);

        hideTimer = window.setTimeout(() => {
          if (!active) return;
          setCurrentMessage(null);
          scheduleNext(12000 + Math.floor(Math.random() * 8000));
        }, 6500);
      }, delay);
    };

    setCurrentMessage(null);
    scheduleNext(4500);

    return () => {
      active = false;
      if (showTimer) window.clearTimeout(showTimer);
      if (hideTimer) window.clearTimeout(hideTimer);
    };
  }, [session, profile, todos, soundEnabled]);

  const faceFrame = FACE_FRAMES[moodIndex % FACE_FRAMES.length];
  const mood = faceFrame.mood;
  const mouthShape = faceFrame.mouth;
  const displayName = useMemo(() => getDisplayName(profile, session), [profile, session]);

  async function saveAvatarFromDataUrl(dataUrl) {
    setAvatarSrc(dataUrl);
    localStorage.setItem(STORAGE_KEYS.avatar, dataUrl);
    setError("");
    setSettingsOpen(false);
  }

  async function handleAvatarFile(file) {
    if (!file) return;

    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Could not read that image."));
      reader.readAsDataURL(file);
    });

    if (typeof dataUrl !== "string") {
      throw new Error("Could not read that image.");
    }

    await saveAvatarFromDataUrl(dataUrl);
  }

  async function handleSignIn(event) {
    event.preventDefault();
    setSigningIn(true);
    setError("");

    try {
      await signIn(email.trim(), password);
      setPassword("");
    } catch (err) {
      setError(err.message || "Could not sign in.");
    } finally {
      setSigningIn(false);
    }
  }

  async function handlePickAvatar() {
    try {
      if (!window.desktopWidget?.pickAvatar) {
        fileInputRef.current?.click();
        return;
      }
      const picked = await window.desktopWidget.pickAvatar();
      if (!picked?.dataUrl) return;
      await saveAvatarFromDataUrl(picked.dataUrl);
    } catch (err) {
      setError(err.message || "Could not load that image.");
    }
  }

  async function handleFileInputChange(event) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    try {
      await handleAvatarFile(file);
    } catch (err) {
      setError(err.message || "Could not load that image.");
    }
  }

  function toggleSound() {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem(STORAGE_KEYS.sound, next ? "on" : "off");
  }

  async function toggleLaunchAtLogin() {
    const next = !launchAtLogin;
    setLaunchAtLogin(next);
    try {
      const result = await window.desktopWidget?.setLaunchAtLogin?.(next);
      if (typeof result?.launchAtLogin === "boolean") {
        setLaunchAtLogin(result.launchAtLogin);
      }
    } catch {
      setLaunchAtLogin(!next);
    }
  }

  async function handleSignOut() {
    await signOut();
    setSettingsOpen(false);
  }

  async function handleHide() {
    await window.desktopWidget?.hide?.();
  }

  if (authLoading) {
    return (
      <div className="widget-root">
        <div className="widget-shell is-loading">
          <div className="mini-spinner" />
          <p>Waking up your desktop reminder...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="widget-root">
        <div className="widget-shell login-shell">
          <div className="bubble-tag">Desktop Widget</div>
          <div className="login-avatar">
            <div className="login-avatar-inner">R</div>
          </div>
          <h1>Reeza Buddy</h1>
          <p className="login-copy">
            Sign in to pull your task list into a cute desktop reminder.
          </p>
          <form className="login-form" onSubmit={handleSignIn}>
            <label>
              <span>Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </label>
            <label>
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                minLength={6}
                required
              />
            </label>
            {error && <div className="inline-error">{error}</div>}
            <button className="primary-button" type="submit" disabled={signingIn}>
              {signingIn ? "Signing in..." : "Open my widget"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="widget-root">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        tabIndex={-1}
        aria-hidden="true"
        style={{ display: "none" }}
        onChange={handleFileInputChange}
      />
      <div className="widget-shell">
        <div className="drag-zone" aria-hidden="true">
          <div className="drag-grip">
            <span />
            <span />
            <span />
          </div>
        </div>

        <div className="scene">
          {error && <div className="floating-error">{error}</div>}
          {currentMessage && (
            <div className={`chat-bubble ${currentMessage ? "" : "is-empty"}`}>
              {dataLoading ? (
              <span>Syncing your task list...</span>
              ) : (
                <>
                <span className="bubble-title">{currentMessage.title}</span>
                <span className="bubble-meta">
                  {currentMessage.meta || `hello ${firstNameOf(displayName)}`}
                </span>
                </>
              )}
            </div>
          )}

          <div className="avatar-stage">
            <div className={`avatar-shell mood-${mood}`}>
              <div className="avatar-head">
                {avatarSrc ? (
                  <img className="avatar-image" src={avatarSrc} alt="Pixel avatar" />
                ) : (
                  <div className="avatar-placeholder">
                    <span>{firstNameOf(displayName)}</span>
                    <span>add avatar</span>
                  </div>
                )}
                <div className="avatar-shadow" />
                <div className={`mouth-overlay mouth-${mouthShape}`} />
              </div>
            </div>
          </div>
        </div>

        <div className="widget-bottom-bar">
          <button className="icon-button" type="button" onClick={handleHide} aria-label="Minimize widget">
            <WidgetIcon name="minus" />
          </button>
          <div className="settings-wrap">
            <button
              className={`icon-button ${settingsOpen ? "is-active" : ""}`}
              type="button"
              onClick={() => setSettingsOpen((current) => !current)}
              aria-label="Open widget settings"
            >
              <WidgetIcon name="settings" />
            </button>
            {settingsOpen && (
              <div className="settings-panel">
                <div className="settings-title">My little friend</div>
                <button className="settings-item" type="button" onClick={handlePickAvatar}>
                  {avatarSrc ? "Change avatar" : "Add avatar"}
                </button>
                <button className={`settings-item ${soundEnabled ? "is-active" : ""}`} type="button" onClick={toggleSound}>
                  {soundEnabled ? "Sound on" : "Sound off"}
                </button>
                <button className={`settings-item ${launchAtLogin ? "is-active" : ""}`} type="button" onClick={toggleLaunchAtLogin}>
                  {launchAtLogin ? "Auto-start on" : "Auto-start off"}
                </button>
                <button className="settings-item danger" type="button" onClick={handleSignOut}>
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
