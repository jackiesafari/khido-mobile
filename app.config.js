const appJson = require('./app.json');

require('dotenv').config();

module.exports = {
  ...appJson,
  expo: {
    ...appJson.expo,
    extra: {
      chatApiUrl: process.env.EXPO_PUBLIC_CHAT_API_URL || null,
    },
  },
};
