import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { createJob, getBase, setBase } from "../lib/api";

export default function Setup() {
  const [url, setUrl] = useState("");
  const [credit, setCredit] = useState("@CarryisLive");
  const [base, setBaseState] = useState("");
  const [spike, setSpike] = useState("2.5");
  const [minMsgs, setMinMsgs] = useState("15");
  const [cooldown, setCooldown] = useState("90");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!base) setBaseState(await getBase());
    })();
  }, []);

  async function start() {
    setError(null);
    if (!url.startsWith("http")) {
      setError("Paste a full YouTube live URL.");
      return;
    }
    setBusy(true);
    try {
      if (base) await setBase(base);
      const { job_id } = await createJob({
        url,
        credit: credit || "@unknown",
        spike_multiplier: parseFloat(spike) || 2.5,
        min_messages_per_5sec: parseInt(minMsgs, 10) || 15,
        cooldown_seconds: parseInt(cooldown, 10) || 90,
      });
      router.push({ pathname: "/monitor", params: { job_id } });
    } catch (e: any) {
      setError(e.message || "Could not reach the backend.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.wrap}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.h1}>Live Auto-Clipper</Text>
        <Text style={styles.sub}>
          Watches the stream chat, catches hype spikes and cuts vertical Reel-ready
          clips with burned subtitles and your credit.
        </Text>

        <Text style={styles.label}>YouTube live URL</Text>
        <TextInput
          style={styles.input}
          placeholder="https://www.youtube.com/watch?v=…"
          autoCapitalize="none"
          autoCorrect={false}
          value={url}
          onChangeText={setUrl}
        />

        <Text style={styles.label}>Streamer credit</Text>
        <TextInput style={styles.input} value={credit} onChangeText={setCredit} />

        <View style={styles.row}>
          <View style={styles.field}>
            <Text style={styles.label}>Spike ×</Text>
            <TextInput style={styles.input} keyboardType="decimal-pad" value={spike} onChangeText={setSpike} />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Min msgs / 5s</Text>
            <TextInput style={styles.input} keyboardType="number-pad" value={minMsgs} onChangeText={setMinMsgs} />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Cooldown s</Text>
            <TextInput style={styles.input} keyboardType="number-pad" value={cooldown} onChangeText={setCooldown} />
          </View>
        </View>

        <Text style={styles.label}>Backend URL</Text>
        <TextInput
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
          value={base}
          onChangeText={setBaseState}
          placeholder="http://your-server:8000"
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable style={({ pressed }) => [styles.button, busy && styles.busy, pressed && { opacity: 0.85 }]}
          onPress={start} disabled={busy} accessibilityLabel="Start clipping">
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Start clipping</Text>}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#0b0b0f" },
  content: { padding: 20, paddingBottom: 48 },
  h1: { color: "#fff", fontSize: 30, fontWeight: "800", letterSpacing: -0.5 },
  sub: { color: "#a0a0ad", fontSize: 15, lineHeight: 22, marginTop: 6, marginBottom: 20 },
  label: { color: "#c9c9d4", fontSize: 13, fontWeight: "600", marginTop: 14, marginBottom: 6 },
  input: {
    backgroundColor: "#16161d",
    borderColor: "#2a2a35",
    borderWidth: 1,
    borderRadius: 10,
    color: "#fff",
    paddingHorizontal: 14,
    minHeight: 48,
    fontSize: 15,
  },
  row: { flexDirection: "row", gap: 10 },
  field: { flex: 1 },
  button: {
    backgroundColor: "#ff7a18",
    borderRadius: 12,
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
  },
  busy: { opacity: 0.7 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  error: { color: "#ff6b6b", marginTop: 14, fontSize: 14 },
});
