import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { brand } from "@autoparts/shared";

type HealthState = { status: "checking" | "online" | "offline" };

export default function App() {
  const [health, setHealth] = useState<HealthState>({ status: "checking" });

  useEffect(() => {
    const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000/api";
    fetch(`${apiUrl}/health`)
      .then((res) => res.json())
      .then(() => setHealth({ status: "online" }))
      .catch(() => setHealth({ status: "offline" }));
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: brand.colors.background }]}>
      <Text style={styles.eyebrow}>Foundation build — working name</Text>
      <Text style={[styles.title, { color: brand.colors.ink }]}>{brand.appName}</Text>
      <Text style={[styles.tagline, { color: brand.colors.muted }]}>{brand.tagline}</Text>
      <Text style={styles.status}>
        {health.status === "checking" && "Checking API connection…"}
        {health.status === "online" && "API connected"}
        {health.status === "offline" && "API not reachable — start apps/api first"}
      </Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 12,
  },
  eyebrow: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "#96690A",
  },
  title: {
    fontSize: 28,
    fontWeight: "600",
    textAlign: "center",
  },
  tagline: {
    fontSize: 15,
    textAlign: "center",
    maxWidth: 280,
  },
  status: {
    marginTop: 12,
    fontSize: 13,
    color: "#666D71",
  },
});
