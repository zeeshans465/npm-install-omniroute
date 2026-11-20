import { useCallback, useRef, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Link, useLocalSearchParams, useFocusEffect } from "expo-router";
import { getJob, stopJob, clipNow, type JobStatus } from "../lib/api";

export default function Monitor() {
  const { job_id } = useLocalSearchParams<{ job_id: string }>();
  const [job, setJob] = useState<JobStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList<string>>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      async function tick() {
        try {
          const j = await getJob(job_id);
          if (alive) {
            setJob(j);
            setError(null);
          }
        } catch (e: any) {
          if (alive) setError(e.message || "Lost connection to the backend.");
        }
      }
      tick();
      const t = setInterval(tick, 3000);
      return () => {
        alive = false;
        clearInterval(t);
      };
    }, [job_id])
  );

  async function handleStop() {
    await stopJob(job_id).catch(() => {});
  }
  async function handleClipNow() {
    await clipNow(job_id).catch((e) => setError(e.message));
  }

  if (error) return <Center><Text style={styles.error}>{error}</Text></Center>;
  if (!job) return <Center><Text style={styles.muted}>Connecting…</Text></Center>;

  const live = job.status === "monitoring";

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View style={styles.badgeRow}>
          <View style={[styles.dot, { backgroundColor: live ? "#3ddc84" : "#ffb020" }]} />
          <Text style={styles.statusText}>
            {live ? "Monitoring chat" : job.status.toUpperCase()}
          </Text>
        </View>
        <Text style={styles.meta}>{job.clips.length} clip(s) ready</Text>
      </View>

      <FlatList
        ref={listRef}
        data={job.log}
        keyExtractor={(_, i) => String(i)}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => (
          <Text style={styles.logLine} selectable>{item}</Text>
        )}
        contentContainerStyle={styles.log}
      />

      <View style={styles.actions}>
        <Pressable style={styles.secondary} onPress={handleClipNow}>
          <Text style={styles.secondaryText}>Clip now</Text>
        </Pressable>
        <Pressable style={styles.secondary} onPress={handleStop}>
          <Text style={styles.secondaryText}>Stop</Text>
        </Pressable>
        <Link href={`/clips?job_id=${job_id}`} asChild>
          <Pressable style={styles.primary}>
            <Text style={styles.primaryText}>Clips ({job.clips.length})</Text>
          </Pressable>
        </Link>
      </View>
    </View>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <View style={[styles.wrap, { alignItems: "center", justifyContent: "center" }]}>{children}</View>;
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#0b0b0f" },
  header: { padding: 16, borderBottomWidth: 1, borderBottomColor: "#1e1e28" },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  statusText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  meta: { color: "#a0a0ad", marginTop: 4, fontSize: 13 },
  log: { padding: 16, gap: 6 },
  logLine: { color: "#b8b8c6", fontSize: 12.5, lineHeight: 18 },
  muted: { color: "#a0a0ad" },
  error: { color: "#ff6b6b", padding: 20 },
  actions: {
    flexDirection: "row",
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#1e1e28",
  },
  secondary: {
    flex: 1,
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2a2a35",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#16161d",
  },
  secondaryText: { color: "#e6e6ef", fontWeight: "600" },
  primary: {
    flex: 1.2,
    minHeight: 48,
    borderRadius: 10,
    backgroundColor: "#ff7a18",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { color: "#fff", fontWeight: "700" },
});
