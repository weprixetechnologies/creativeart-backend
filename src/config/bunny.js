require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const bunnyConfig = {
  storageZone: process.env.BUNNY_STORAGE_ZONE || 'cly-bunny',
  storageRegion: process.env.BUNNY_STORAGE_REGION || 'storage.bunnycdn.com',
  pullZoneUrl: process.env.BUNNY_PULL_ZONE_URL || 'https://cly-pull-bunny.b-cdn.net',
  apiKey: process.env.BUNNY_API_KEY || '22cfd8b3-8021-40a3-b100a9d48bc0-7dc3-4654'
};

module.exports = bunnyConfig;
