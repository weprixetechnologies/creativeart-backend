const Redis = require('ioredis');
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const redisHost = process.env.REDIS_HOST || '127.0.0.1';
const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);

const redisClient = new Redis({
  host: redisHost,
  port: redisPort,
  maxRetriesPerRequest: null // Required by BullMQ
});

redisClient.on('connect', () => {
  console.log('Successfully connected to Redis.');
});

redisClient.on('error', (err) => {
  console.error('Redis connection error:', err);
});

module.exports = redisClient;
