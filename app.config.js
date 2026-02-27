const appJson = require('./app.json');

require('dotenv').config();

module.exports = {
  ...appJson,
  expo: {
    ...appJson.expo,
    plugins: [...(appJson.expo.plugins || []), 'expo-audio', 'expo-video'],
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
    },
  },
};
