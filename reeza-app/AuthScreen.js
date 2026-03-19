import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";

const V = "#8b5cf6";
const B = "#38bdf8";
const HEADER_FONT = Platform.select({ ios: "AvenirNext-DemiBold", android: "sans-serif-medium", default: "System" });

function BrandMark() {
  return (
    <View style={styles.brandMark}>
      <View style={styles.brandInner}>
        <Text style={styles.brandLetter}>R</Text>
      </View>
    </View>
  );
}

function FieldIcon({ label }) {
  return (
    <View style={styles.fieldIcon}>
      <Text style={styles.fieldIconText}>{label}</Text>
    </View>
  );
}

export default function AuthScreen({ signIn, signUp }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function handleSubmit() {
    setError("");
    setMessage("");
    setLoading(true);
    try {
      if (isSignUp) {
        await signUp(email, password);
        setMessage("Check your email to confirm, then sign in.");
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
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <View style={styles.glowOne} />
      <View style={styles.glowTwo} />
      <View style={styles.card}>
        <BrandMark />
        <View style={styles.pill}>
          <Text style={styles.pillText}>Unified Sync</Text>
        </View>
        <Text style={styles.title}>Reeza</Text>
        <Text style={styles.subtitle}>
          Sign in on phone and desktop to keep your workspace consistent everywhere.
        </Text>

        <Text style={styles.label}>Email</Text>
        <View style={styles.inputShell}>
          <FieldIcon label="@" />
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor="#64748b"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
        </View>

        <Text style={styles.label}>Password</Text>
        <View style={styles.inputShell}>
          <FieldIcon label="*" />
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Enter your password"
            placeholderTextColor="#64748b"
            secureTextEntry
            autoComplete={isSignUp ? "new-password" : "current-password"}
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {message ? <Text style={styles.message}>{message}</Text> : null}

        <TouchableOpacity
          style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#eef2ff" />
              <Text style={styles.primaryButtonText}>Syncing access</Text>
            </View>
          ) : (
            <Text style={styles.primaryButtonText}>
              {isSignUp ? "Create account" : "Sign in"}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.switchButton}
          onPress={() => {
            setIsSignUp((v) => !v);
            setError("");
            setMessage("");
          }}
        >
          <Text style={styles.switchButtonText}>
            {isSignUp ? "Already have an account? Sign in" : "No account? Sign up"}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#04080f",
    justifyContent: "center",
    padding: 20,
  },
  glowOne: {
    position: "absolute",
    top: 80,
    left: 10,
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: "rgba(56,189,248,0.08)",
  },
  glowTwo: {
    position: "absolute",
    top: 30,
    right: 20,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: "rgba(139,92,246,0.08)",
  },
  card: {
    backgroundColor: "rgba(13,18,32,0.98)",
    borderRadius: 28,
    padding: 32,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.3)",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 16 },
    elevation: 16,
  },
  brandMark: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignSelf: "center",
    marginBottom: 16,
    backgroundColor: V,
    shadowColor: V,
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  brandInner: {
    flex: 1,
    borderRadius: 20,
    backgroundColor: B,
    margin: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  brandLetter: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "800",
  },
  pill: {
    alignSelf: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.03)",
    marginBottom: 14,
  },
  pillText: {
    color: "#cbd5e1",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    fontFamily: HEADER_FONT,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#e2e8f0",
    textAlign: "center",
    marginBottom: 8,
    fontFamily: HEADER_FONT,
  },
  subtitle: {
    fontSize: 13,
    color: "#7b8aa5",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748b",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontFamily: HEADER_FONT,
  },
  inputShell: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 14,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  fieldIcon: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: "rgba(139,92,246,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  fieldIconText: {
    color: "#c4b5fd",
    fontSize: 12,
    fontWeight: "700",
  },
  input: {
    flex: 1,
    color: "#e2e8f0",
    fontSize: 14,
    paddingVertical: 13,
  },
  error: {
    color: "#f87171",
    fontSize: 13,
    marginBottom: 12,
    padding: 10,
    backgroundColor: "rgba(248,113,113,0.1)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.24)",
  },
  message: {
    color: "#4ade80",
    fontSize: 13,
    marginBottom: 12,
    padding: 10,
    backgroundColor: "rgba(34,197,94,0.1)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.24)",
  },
  primaryButton: {
    backgroundColor: "rgba(139, 92, 246, 0.28)",
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.5)",
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50,
  },
  primaryButtonDisabled: {
    opacity: 0.85,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  primaryButtonText: {
    color: "#eef2ff",
    fontSize: 14,
    fontWeight: "700",
  },
  switchButton: {
    marginTop: 14,
    padding: 10,
    alignItems: "center",
  },
  switchButtonText: {
    color: "#94a3b8",
    fontSize: 13,
  },
});
