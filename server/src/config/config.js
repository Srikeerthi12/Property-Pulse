export function getConfig() {
  return {
    port: Number(process.env.PORT || 5000),
    nodeEnv: process.env.NODE_ENV || 'development',
    clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
    databaseUrl: process.env.DATABASE_URL,
    jwtAccessSecret: process.env.JWT_ACCESS_SECRET,
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
    cookieSecure: String(process.env.COOKIE_SECURE || 'false') === 'true',
    emailEnabled: String(process.env.EMAIL_ENABLED || 'false') === 'true',
  };
}
