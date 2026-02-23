const appJson = require('./app.json');

require('dotenv').config();

module.exports = {
  ...appJson,
  expo: {
    ...appJson.expo,
    extra: {
      chatApiUrl: process.env.EXPO_PUBLIC_CHAT_API_URL || null,
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || null,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || null,
      authBridgeUrl: process.env.EXPO_PUBLIC_AUTH_BRIDGE_URL || null,
    },
  },
};
