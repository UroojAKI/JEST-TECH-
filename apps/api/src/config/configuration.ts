export default () => ({
  app: {
    name: process.env.APP_NAME,
    port: parseInt(process.env.PORT || '3000'),
    environment: process.env.NODE_ENV,
  },

  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
  },

  database: {
    url: process.env.DATABASE_URL,
  },
});
