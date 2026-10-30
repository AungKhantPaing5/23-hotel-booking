import { Pool, type QueryResultRow } from "pg";

const globalForPg = globalThis as unknown as { hotelPgPool?: Pool };

function getPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured. Start Docker PostgreSQL and copy .env.example to .env.local.");
  }
  if (!globalForPg.hotelPgPool) {
    globalForPg.hotelPgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: Number(process.env.PGPOOL_MAX || 10),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 8_000,
      ...(process.env.DATABASE_SSL === "true" ? { ssl: { rejectUnauthorized: true } } : {}),
    });
    globalForPg.hotelPgPool.on("error", (error) => console.error("Unexpected PostgreSQL pool error", error));
  }
  return globalForPg.hotelPgPool;
}

export async function query<T extends QueryResultRow = Record<string, unknown>>(text: string, values: unknown[] = []) {
  return getPool().query<T>(text, values);
}

export async function withTransaction<T>(callback: (client: import("pg").PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
