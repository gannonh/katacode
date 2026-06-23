import * as SplashScreen from "expo-splash-screen";

let splashScreenReady = false;

void SplashScreen.preventAutoHideAsync().catch(() => {
  // Dev client reloads can race native splash registration.
});

export async function hideSplashScreenWhenReady(): Promise<void> {
  if (splashScreenReady) {
    return;
  }

  splashScreenReady = true;
  try {
    await SplashScreen.hideAsync();
  } catch {
    splashScreenReady = false;
  }
}
