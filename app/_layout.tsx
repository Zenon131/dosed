import "react-native-reanimated";
import React, { useEffect } from "react";
import { useFonts } from "expo-font";
import { Redirect, Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { SystemBars } from "react-native-edge-to-edge";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useColorScheme } from "react-native";
import {
  DarkTheme,
  DefaultTheme,
  Theme,
  ThemeProvider,
} from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import { WidgetProvider } from "@/contexts/WidgetContext";
import { UserProvider, useUser } from "@/contexts/UserContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ensurePermissionsAndChannel, rescheduleAll } from "@/utils/notifications";
import { getAllMeds } from "@/utils/medsStore";
// Note: Error logging is auto-initialized via index.ts import

// Only wrap with ErrorBoundary in dev — production apps should not include it
const DevErrorBoundary = __DEV__
  ? ErrorBoundary
  : ({ children }: { children: React.ReactNode }) => <>{children}</>;

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  initialRouteName: "(tabs)",
};

function RootNavigator() {
  const { isLoading, isOnboarded, name } = useUser();
  const colorScheme = useColorScheme();
  const router = useRouter();
  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  useEffect(() => {
    if (loaded && !isLoading) {
      SplashScreen.hideAsync();
    }
  }, [loaded, isLoading]);

  // Request permissions and reschedule all notifications once onboarded
  useEffect(() => {
    if (!isOnboarded || isLoading) return;
    async function initNotifications() {
      console.log('[Layout] Initializing notifications');
      try {
        const granted = await ensurePermissionsAndChannel();
        console.log('[Layout] Notification permission granted:', granted);
        if (granted) {
          const meds = await getAllMeds();
          await rescheduleAll(meds, name);
          console.log('[Layout] Rescheduled all notifications on startup');
        }
      } catch (err) {
        console.error('[Layout] Failed to init notifications:', err);
      }
    }
    initNotifications();
  }, [isOnboarded, isLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for notification taps and deep-link to the medication screen
  useEffect(() => {
    console.log('[Layout] Registering notification tap listener');
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const medId = response.notification.request.content.data?.medicationId;
      console.log('[Layout] Notification tapped, medicationId:', medId);
      if (typeof medId === 'string') {
        router.push(`/med/${medId}`);
      }
    });
    return () => {
      console.log('[Layout] Removing notification tap listener');
      sub.remove();
    };
  }, [router]);

  const CustomDefaultTheme: Theme = {
    ...DefaultTheme,
    dark: false,
    colors: {
      primary: "rgb(0, 122, 255)",
      background: "rgb(242, 242, 247)",
      card: "rgb(255, 255, 255)",
      text: "rgb(0, 0, 0)",
      border: "rgb(216, 216, 220)",
      notification: "rgb(255, 59, 48)",
    },
  };

  const CustomDarkTheme: Theme = {
    ...DarkTheme,
    colors: {
      primary: "rgb(10, 132, 255)",
      background: "rgb(1, 1, 1)",
      card: "rgb(28, 28, 30)",
      text: "rgb(255, 255, 255)",
      border: "rgb(44, 44, 46)",
      notification: "rgb(255, 69, 58)",
    },
  };

  if (!loaded || isLoading) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === "dark" ? CustomDarkTheme : CustomDefaultTheme}>
      <SafeAreaProvider>
        <WidgetProvider>
          <GestureHandlerRootView>
            <Stack>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="welcome" options={{ headerShown: false }} />
              <Stack.Screen
                name="med/[id]"
                options={{
                  headerShown: true,
                  headerBackButtonDisplayMode: 'minimal',
                  headerTransparent: true,
                  headerShadowVisible: false,
                  headerBlurEffect: 'none',
                  title: '',
                }}
              />
              <Stack.Screen
                name="med/new"
                options={{
                  headerShown: true,
                  headerBackButtonDisplayMode: 'minimal',
                  title: 'New Medication',
                  presentation: 'modal',
                }}
              />
              <Stack.Screen
                name="med/edit/[id]"
                options={{
                  headerShown: true,
                  headerBackButtonDisplayMode: 'minimal',
                  title: 'Edit Medication',
                  presentation: 'modal',
                }}
              />
              <Stack.Screen name="+not-found" />
            </Stack>
            {!isOnboarded && <Redirect href="/welcome" />}
            <SystemBars style={"auto"} />
          </GestureHandlerRootView>
        </WidgetProvider>
      </SafeAreaProvider>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <DevErrorBoundary>
      <StatusBar style="auto" animated />
      <UserProvider>
        <RootNavigator />
      </UserProvider>
    </DevErrorBoundary>
  );
}
