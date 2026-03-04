const appJson = require('./app.json');

require('dotenv').config();

function deriveGoogleIosUrlScheme(iosClientId) {
  if (!iosClientId || typeof iosClientId !== 'string') return null;
  const suffix = '.apps.googleusercontent.com';
  if (!iosClientId.endsWith(suffix)) return null;
  const appId = iosClientId.slice(0, -suffix.length).trim();
  if (!appId) return null;
  return `com.googleusercontent.apps.${appId}`;
}

const basePlugins = [...(appJson.expo.plugins || [])];
const hasGooglePlugin = basePlugins.some((plugin) =>
  Array.isArray(plugin) ? plugin[0] === '@react-native-google-signin/google-signin' : plugin === '@react-native-google-signin/google-signin'
);

const googleIosUrlScheme =
  process.env.GOOGLE_IOS_URL_SCHEME || deriveGoogleIosUrlScheme(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID);

if (!hasGooglePlugin && googleIosUrlScheme) {
  basePlugins.push([
    '@react-native-google-signin/google-signin',
    {
      iosUrlScheme: googleIosUrlScheme,
    },
  ]);
}

module.exports = {
  ...appJson,
  expo: {
    ...appJson.expo,
    android: {
      ...(appJson.expo.android || {}),
      package: 'com.khido.app',
    },
    plugins: [...basePlugins, 'expo-audio', 'expo-video'],
    extra: {
      rewardVideoPaths: process.env.EXPO_PUBLIC_REWARD_VIDEO_PATHS
        ? process.env.EXPO_PUBLIC_REWARD_VIDEO_PATHS.split(',').map((v) => v.trim()).filter(Boolean)
        : [],
      rewardYoutubeUrls: process.env.EXPO_PUBLIC_REWARD_YOUTUBE_URLS
        ? process.env.EXPO_PUBLIC_REWARD_YOUTUBE_URLS.split(',').map((v) => v.trim()).filter(Boolean)
        : [],
      chatApiUrl: process.env.EXPO_PUBLIC_CHAT_API_URL || null,
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || null,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || null,
      authBridgeUrl: process.env.EXPO_PUBLIC_AUTH_BRIDGE_URL || null,
      googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || null,
      googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || null,
      googleAndroidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || null,
    },
  },
};
