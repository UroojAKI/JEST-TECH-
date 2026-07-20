export default () => ({
  app: {
    name: process.env.APP_NAME,
    port: parseInt(process.env.PORT || '3000'),
    environment: process.env.NODE_ENV,
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'fallback-secret',
    expiresIn: '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret',
    refreshExpiresIn: '7d',
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  database: {
    url: process.env.DATABASE_URL,
  },
});
