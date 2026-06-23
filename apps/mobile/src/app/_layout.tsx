import "../../global.css";
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
  useFonts,
} from "@expo-google-fonts/dm-sans";
import Stack from "expo-router/stack";
import { useEffect } from "react";
import { StatusBar, useColorScheme } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useResolveClassNames } from "uniwind";

import {
  useRemoteEnvironmentBootstrap,
  useRemoteEnvironmentState,
} from "../state/use-remote-environment-registry";
import { RegistryContext } from "@effect/atom-react";
import { appAtomRegistry } from "../state/atom-registry";
import { CloudAuthProvider } from "../features/cloud/CloudAuthProvider";
import { useAgentNotificationNavigation } from "../features/agent-awareness/notificationNavigation";
import { hideSplashScreenWhenReady } from "../lib/splashScreen";

function AppNavigator() {
  const colorScheme = useColorScheme();
  const statusBarBg = colorScheme === "dark" ? "#0a0a0a" : "#f2f2f7";
  const sheetStyle = useResolveClassNames("bg-sheet");
  useAgentNotificationNavigation();

  const newTaskScreenOptions = {
    contentStyle: sheetStyle,
    gestureEnabled: true,
    headerShown: false,
    presentation: "formSheet" as const,
    sheetAllowedDetents: [0.92],
    sheetGrabberVisible: true,
  };

  const connectionSheetScreenOptions = {
    contentStyle: sheetStyle,
    gestureEnabled: true,
    headerShown: false,
    presentation: "formSheet" as const,
    sheetAllowedDetents: [0.55, 0.7],
    sheetGrabberVisible: true,
  };

  const settingsSheetScreenOptions = {
    ...connectionSheetScreenOptions,
    sheetAllowedDetents: [0.7],
  };

  return (
    <>
      <StatusBar
        barStyle={colorScheme === "dark" ? "light-content" : "dark-content"}
        backgroundColor={statusBarBg as string}
        translucent
      />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen
          name="index"
          options={{
            contentStyle: { backgroundColor: "transparent" },
            headerShown: true,
            headerTransparent: true,
            headerShadowVisible: false,
          }}
        />
        <Stack.Screen name="settings" options={settingsSheetScreenOptions} />
        <Stack.Screen name="connections" options={connectionSheetScreenOptions} />
        <Stack.Screen name="new" options={newTaskScreenOptions} />
        <Stack.Screen
          name="threads/[environmentId]/[threadId]"
          options={{
            animation: "slide_from_right",
            contentStyle: { backgroundColor: "transparent" },
            gestureEnabled: true,
            headerShown: false,
          }}
        />
      </Stack>
    </>
  );
}

function RootLayoutShell(props: { readonly fontsLoaded: boolean }) {
  const { isLoadingSavedConnection } = useRemoteEnvironmentState();
  const isAppReady = props.fontsLoaded && !isLoadingSavedConnection;

  useEffect(() => {
    if (isAppReady) {
      void hideSplashScreenWhenReady();
    }
  }, [isAppReady]);

  if (!isAppReady) {
    return null;
  }

  return <AppNavigator />;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
  });
  useRemoteEnvironmentBootstrap();

  return (
    <RegistryContext.Provider value={appAtomRegistry}>
      <CloudAuthProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <KeyboardProvider statusBarTranslucent>
            <SafeAreaProvider>
              <RootLayoutShell fontsLoaded={fontsLoaded} />
            </SafeAreaProvider>
          </KeyboardProvider>
        </GestureHandlerRootView>
      </CloudAuthProvider>
    </RegistryContext.Provider>
  );
}
