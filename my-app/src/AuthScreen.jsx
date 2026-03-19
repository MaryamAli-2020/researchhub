import { useState } from "react";

const V = "#8b5cf6";
const B = "#38bdf8";
const HEADER_FONT = "'Poppins','Syne',sans-serif";

function AuthIcon({ name, size = 18, color = "currentColor" }) {
  const props = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color,
    strokeWidth: 1.9,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: { display: "block" },
  };

  switch (name) {
    case "logo":
      return <svg {...props}><path d="M5 12.5 12 4l7 8.5" /><path d="M8 12.5V19h8v-6.5" /><path d="M10.5 19v-3.5h3V19" /></svg>;
    case "mail":
      return <svg {...props}><rect x="4" y="6" width="16" height="12" rx="2.5" /><path d="m5.5 8 6.5 5 6.5-5" /></svg>;
    case "lock":
      return <svg {...props}><rect x="6" y="10" width="12" height="10" rx="2.5" /><path d="M8.5 10V8a3.5 3.5 0 0 1 7 0v2" /></svg>;
    case "spark":
      return <svg {...props}><path d="m12 3.5 1.8 4.7 4.7 1.8-4.7 1.8L12 16.5l-1.8-4.7-4.7-1.8 4.7-1.8z" /><path d="M18.5 16.5 19.5 19l2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1z" /></svg>;
    default:
      return <svg {...props}><circle cx="12" cy="12" r="7" /></svg>;
  }
}

function AuthSpinner({ size = 16, color = B }) {
  return (
    <span style={{ width: size, height: size, borderRadius: "50%", border: `2px solid ${color}25`, borderTopColor: color, display: "inline-block", animation: "auth-spin 0.7s linear infinite" }} />
  );
}

function BrandMark({ size = 58 }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.32,
        background: `radial-gradient(circle at 30% 30%, #ffffff 0%, ${V} 38%, ${B} 100%)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: `0 18px 40px ${V}45, inset 0 1px 0 rgba(255,255,255,0.35)`,
        margin: "0 auto 18px",
      }}
    >
      <AuthIcon name="logo" size={size * 0.48} color="#fff" />
    </div>
  );
}

export default function AuthScreen({ signIn, signUp }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      if (isSignUp) {
        await signUp(email, password);
        setMessage("Check your email to confirm your account, then sign in.");
      } else {
        await signIn(email, password);
      }
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const inputShell = {
    width: "100%",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 14,
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "0 14px",
  };

  const inputStyle = {
    width: "100%",
    background: "transparent",
    border: "none",
    padding: "13px 0",
    color: "#e2e8f0",
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        boxSizing: "border-box",
        background: "radial-gradient(circle at top, rgba(139,92,246,0.18), transparent 30%), linear-gradient(160deg, #04080f 0%, #0a0f1d 52%, #04080f 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        fontFamily: "'Inter', 'Syne', sans-serif",
        zIndex: 9999,
        overflow: "hidden",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@500;600;700;800&display=swap');
        @keyframes auth-spin { to { transform: rotate(360deg); } }
      `}</style>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 18% 18%, rgba(56,189,248,0.14), transparent 18%), radial-gradient(circle at 82% 10%, rgba(34,211,165,0.12), transparent 16%)" }} />
      <div
        style={{
          position: "relative",
          background: "linear-gradient(180deg, rgba(13,18,32,0.98) 0%, rgba(10,14,24,0.98) 100%)",
          border: "1px solid rgba(139, 92, 246, 0.25)",
          borderRadius: 28,
          padding: "44px 48px",
          maxWidth: 440,
          width: "100%",
          boxShadow: "0 30px 80px rgba(0,0,0,0.48), inset 0 1px 0 rgba(255,255,255,0.04)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <BrandMark />
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.03)", marginBottom: 14 }}>
            <AuthIcon name="spark" size={13} color="#c4b5fd" />
            <span style={{ fontSize: 11, fontWeight: 700, color: "#cbd5e1", letterSpacing: "0.04em", textTransform: "uppercase", fontFamily: HEADER_FONT }}>Unified Sync</span>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#e2e8f0", marginBottom: 8, fontFamily: HEADER_FONT }}>
            Reeza
          </h1>
          <p style={{ fontSize: 13, color: "#7b8aa5", lineHeight: 1.6 }}>
            Sign in on phone and desktop to keep your workspace consistent everywhere.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: "block",
                fontSize: 11,
                fontWeight: 700,
                color: "#64748b",
                marginBottom: 6,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Email
            </label>
            <div style={inputShell}>
              <AuthIcon name="mail" size={15} color="#64748b" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label
              style={{
                display: "block",
                fontSize: 11,
                fontWeight: 700,
                color: "#64748b",
                marginBottom: 6,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Password
            </label>
            <div style={inputShell}>
              <AuthIcon name="lock" size={15} color="#64748b" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                minLength={6}
                autoComplete={isSignUp ? "new-password" : "current-password"}
                style={inputStyle}
              />
            </div>
          </div>

          {error && (
            <div
              style={{
                marginBottom: 12,
                padding: "10px 12px",
                background: "rgba(248,113,113,0.1)",
                border: "1px solid rgba(248,113,113,0.3)",
                borderRadius: 12,
                color: "#f87171",
                fontSize: 13,
              }}
            >
              {error}
            </div>
          )}

          {message && (
            <div
              style={{
                marginBottom: 12,
                padding: "10px 12px",
                background: "rgba(34,197,94,0.1)",
                border: "1px solid rgba(34,197,94,0.3)",
                borderRadius: 12,
                color: "#4ade80",
                fontSize: 13,
              }}
            >
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: 13,
              background: "linear-gradient(135deg, rgba(139,92,246,0.28), rgba(56,189,248,0.2))",
              border: "1px solid rgba(139,92,246,0.45)",
              borderRadius: 14,
              color: "#eef2ff",
              fontSize: 14,
              fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.8 : 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              minHeight: 48,
            }}
          >
            {loading ? (
              <>
                <AuthSpinner />
                <span>Syncing access</span>
              </>
            ) : (
              isSignUp ? "Create account" : "Sign in"
            )}
          </button>
        </form>

        <button
          type="button"
          onClick={() => { setIsSignUp((v) => !v); setError(""); setMessage(""); }}
          style={{
            width: "100%",
            marginTop: 14,
            padding: 11,
            background: "transparent",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 12,
            color: "#94a3b8",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          {isSignUp ? "Already have an account? Sign in" : "No account? Sign up"}
        </button>
      </div>
    </div>
  );
}
