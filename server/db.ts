/**
 * Acesso ao PostgreSQL. Em produção usa `pg` (pool pequeno, adequado a funções
 * serverless atrás do pooler do Supabase); nos testes e no servidor local usa PGlite
 * (PostgreSQL embutido), com o mesmo SQL. Toda consulta é parametrizada.
 */
import pg from 'pg';

export interface Queryer {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

export interface Db extends Queryer {
  /** Executa `fn` dentro de uma transação (BEGIN/COMMIT, ROLLBACK em erro). */
  tx<T>(fn: (q: Queryer) => Promise<T>): Promise<T>;
}

let pool: pg.Pool | null = null;

export function poolDb(connectionString: string): Db {
  if (!pool) {
    const ca = process.env.DATABASE_CA;
    pool = new pg.Pool({
      connectionString,
      max: 3,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 8_000,
      // TLS sempre; com DATABASE_CA (certificado raiz do Supabase) o servidor também é verificado
      ssl: ca ? { ca, rejectUnauthorized: true } : { rejectUnauthorized: false },
    });
  }
  const p = pool;
  return {
    query: (text, params) => p.query(text, params) as never,
    async tx(fn) {
      const client = await p.connect();
      try {
        await client.query('begin');
        const out = await fn({ query: (t, ps) => client.query(t, ps) as never });
        await client.query('commit');
        return out;
      } catch (e) {
        await client.query('rollback').catch(() => undefined);
        throw e;
      } finally {
        client.release();
      }
    },
  };
}

let cached: Db | null = null;

/** Banco configurado pelo ambiente (DATABASE_URL). */
export function getDb(): Db {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL não configurada');
  cached = poolDb(url);
  return cached;
}

/** Permite injetar outro banco (testes / servidor local com PGlite). */
export function setDb(db: Db): void {
  cached = db;
}
