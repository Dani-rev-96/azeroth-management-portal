/**
 * Example API route showing how to use database credentials
 * 
 * Credentials are loaded from .db.<env>.env and injected into useRuntimeConfig()
 * They are SERVER-SIDE ONLY and never exposed to the browser
 */

export default defineEventHandler(async (event) => {
  // Get database credentials from runtimeConfig (server-side only)
  const config = useRuntimeConfig()
  
  const credentials = {
    auth: {
      user: config.db.authUser,
      password: config.db.authPassword,
    },
    blizzlike: {
      user: config.db.blizzlikeWorldUser,
      password: config.db.blizzlikeWorldPassword,
    },
    ip: {
      user: config.db.ipWorldUser,
      password: config.db.ipWorldPassword,
    },
    ipBoosted: {
      user: config.db.ipBoostedWorldUser,
      password: config.db.ipBoostedWorldPassword,
    },
  }

  // Now use these credentials to connect to databases
  // Example:
  // const connection = await mysql.createConnection({
  //   host: 'localhost',
  //   port: 3306,
  //   user: credentials.auth.user,
  //   password: credentials.auth.password,
  //   database: 'acore_auth',
  // })

  return {
    message: 'Database credentials are available via useRuntimeConfig().db',
    note: 'Credentials are server-side only and never sent to the client',
  }
})
