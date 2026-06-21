import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.c93f1b43f57647769e74330986962da2',
  appName: 'arba3een',
  webDir: 'dist',
  // Auto-update: the native shell loads the live deployed web app directly, so
  // every time the app opens it shows the latest published version without
  // re-submitting to the stores. Remove the `server` block for a fully offline,
  // bundled build.
  server: {
    url: 'https://c93f1b43-f576-4776-9e74-330986962da2.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
  plugins: {
    PushNotifications: {
      // Show banner + sound + badge even while the app is in the foreground.
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#0EA5E9',
      sound: 'beep.wav',
    },
    Geolocation: {
      // High accuracy continuous tracking.
    },
  },
};

export default config;
