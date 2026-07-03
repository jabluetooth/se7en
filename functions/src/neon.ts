/**
 * Lazy, cached Neon SQL client.
 *
 * Unlike the old client-side version, no `neonConfig.webSocketConstructor`
 * override is needed here — that shim existed only to make the driver work
 * inside React Native. In the Node 20 Cloud Functions runtime the
 * `@neondatabase/serverless` package already uses the HTTP (fetch-based)
 * driver by default, which is what we want for short-lived callable
 * functions anyway (no persistent connection to manage).
 */

import { neon } from '@neondatabase/serverless';

let cachedSql: ReturnType<typeof neon> | null = null;
let cachedUrl: string | null = null;

export function getSql(databaseUrl: string): ReturnType<typeof neon> {
  if (!cachedSql || cachedUrl !== databaseUrl) {
    cachedSql = neon(databaseUrl);
    cachedUrl = databaseUrl;
  }
  return cachedSql;
}
