import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "react-native";

export default function RootLayout() {
  const scheme = useColorScheme();
  return (
    <ThemeProvider value={scheme === "dark" ? DarkTheme : DefaultTheme}>
      <StatusBar style="auto" />
      <Stack>
        <Stack.Screen name="index" options={{ title: "GTA6 Auto-Clipper" }} />
        <Stack.Screen name="monitor" options={{ title: "Live Monitor" }} />
        <Stack.Screen name="clips" options={{ title: "Clips" }} />
      </Stack>
    </ThemeProvider>
  );
}
