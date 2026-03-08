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
      <View style={styles.card}>
        <Text style={styles.emoji}>🔐</Text>
        <Text style={styles.title}>Reeza</Text>
        <Text style={styles.subtitle}>
          Sign in on phone and desktop to see the same data everywhere.
        </Text>

        <Text style={styles.label}>Email</Text>
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

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          placeholderTextColor="#64748b"
          secureTextEntry
          autoComplete={isSignUp ? "new-password" : "current-password"}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {message ? <Text style={styles.message}>{message}</Text> : null}

        <TouchableOpacity
          style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#a78bfa" />
          ) : (
            <Text style={styles.primaryButtonText}>
              {isSignUp ? "Sign up" : "Sign in"}
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
  card: {
    backgroundColor: "#0d1220",
    borderRadius: 24,
    padding: 32,
    borderWidth: 2,
    borderColor: "rgba(139, 92, 246, 0.4)",
  },
  emoji:    { fontSize: 36, textAlign: "center", marginBottom: 12 },
  title:    { fontSize: 22, fontWeight: "700", color: "#e2e8f0", textAlign: "center", marginBottom: 6 },
  subtitle: { fontSize: 13, color: "#64748b", textAlign: "center", marginBottom: 24 },
  label:    { fontSize: 11, fontWeight: "700", color: "#64748b", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 },
  input:    { backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", borderRadius: 12, padding: 12, color: "#e2e8f0", fontSize: 14, marginBottom: 16 },
  error:    { color: "#f87171", fontSize: 13, marginBottom: 12, padding: 10, backgroundColor: "rgba(248,113,113,0.1)", borderRadius: 10 },
  message:  { color: "#22c55e", fontSize: 13, marginBottom: 12, padding: 10, backgroundColor: "rgba(34,197,94,0.1)", borderRadius: 10 },
  primaryButton:         { backgroundColor: "rgba(139, 92, 246, 0.25)", borderWidth: 1, borderColor: "rgba(139, 92, 246, 0.5)", borderRadius: 12, padding: 14, alignItems: "center" },
  primaryButtonDisabled: { opacity: 0.7 },
  primaryButtonText:     { color: "#a78bfa", fontSize: 14, fontWeight: "700" },
  switchButton:     { marginTop: 14, padding: 10, alignItems: "center" },
  switchButtonText: { color: "#64748b", fontSize: 13 },
});