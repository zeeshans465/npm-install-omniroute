import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useFocusEffect, router } from "expo-router";
import { getJob, clipUrl, type JobStatus } from "../lib/api";

export default function Clips() {
  const { job_id } = useLocalSearchParams<{ job_id: string }>();
  const [job, setJob] = useState<JobStatus | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      getJob(job_id)
        .then(async (j) => {
          if (!alive) return;
          setJob(j);
          const next: Record<string, string> = {};
          for (const c of j.clips) next[c] = await clipUrl(job_id, c);
          setUrls(next);
        })
        .catch(() => {});
      return () => {
        alive = false;
      };
    }, [job_id])
  );

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={styles.content}>
      {job && job.clips.length === 0 && (
        <Text style={styles.empty}>
          No clips yet. The app cuts automatically on hype spikes — or tap “Clip now”
          on the monitor screen.
        </Text>
      )}
      {job?.clips.map((clip) => (
        <View key={clip} style={styles.card}>
          <Text style={styles.clipName} numberOfLines={2}>{clip}</Text>
          <Pressable
            style={({ pressed }) => [styles.open, pressed && { opacity: 0.85 }]}
            onPress={() => router.back()}
            accessibilityLabel={`Open ${clip}`}
          >
            <Text style={styles.openText}>Back to monitor</Text>
          </Pressable>
          {urls[clip] && (
            <Text style={styles.url} selectable>{urls[clip]}</Text>
          )}
        </View>
      ))}
      <Text style={styles.hint}>
        Clips are served by the backend at the URLs above — open one in any browser
        to download the finished 1080×1920 MP4.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#0b0b0f" },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  empty: { color: "#a0a0ad", fontSize: 15, lineHeight: 22, marginTop: 24 },
  card: {
    backgroundColor: "#16161d",
    borderColor: "#2a2a35",
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 10,
  },
  clipName: { color: "#fff", fontWeight: "700", fontSize: 15 },
  open: {
    backgroundColor: "#ff7a18",
    borderRadius: 10,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    alignSelf: "flex-start",
  },
  openText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  url: { color: "#7db4ff", fontSize: 12 },
  hint: { color: "#6e6e7c", fontSize: 12.5, lineHeight: 18, marginTop: 8 },
});
