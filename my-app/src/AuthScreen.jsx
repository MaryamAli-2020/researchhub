import { useState } from "react";

const V = "#8b5cf6";

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

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        boxSizing: "border-box",
        background: "linear-gradient(160deg, #04080f 0%, #0a0e18 50%, #04080f 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        fontFamily: "'Syne', sans-serif",
        zIndex: 9999,
      }}
    >
      <div
        style={{
          background: "linear-gradient(180deg, rgba(13,18,32,0.98) 0%, rgba(10,14,24,0.98) 100%)",
          border: "1px solid rgba(139, 92, 246, 0.35)",
          borderRadius: 24,
          padding: "44px 48px",
          maxWidth: 420,
          width: "100%",
          boxShadow: "0 24px 48px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.03)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🔐</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#e2e8f0", marginBottom: 6 }}>
            Reeza
          </h1>
          <p style={{ fontSize: 13, color: "#64748b" }}>
            Sign in on phone and desktop to see the same data everywhere.
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
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
              style={{
                width: "100%",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 12,
                padding: "12px 14px",
                color: "#e2e8f0",
                fontSize: 14,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
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
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              autoComplete={isSignUp ? "new-password" : "current-password"}
              style={{
                width: "100%",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 12,
                padding: "12px 14px",
                color: "#e2e8f0",
                fontSize: 14,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {error && (
            <div
              style={{
                marginBottom: 12,
                padding: "10px 12px",
                background: "rgba(248,113,113,0.1)",
                border: "1px solid rgba(248,113,113,0.3)",
                borderRadius: 10,
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
                borderRadius: 10,
                color: "#22c55e",
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
              padding: 12,
              background: `${V}22`,
              border: `1px solid ${V}55`,
              borderRadius: 12,
              color: "#a78bfa",
              fontSize: 14,
              fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "…" : isSignUp ? "Sign up" : "Sign in"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => { setIsSignUp((v) => !v); setError(""); setMessage(""); }}
          style={{
            width: "100%",
            marginTop: 14,
            padding: 10,
            background: "transparent",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 10,
            color: "#64748b",
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