/** Banco PostgreSQL embutido (PGlite) para testes e para o servidor local de desenvolvimento. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import type { Db } from './db';

export async function pgliteDb(dataDir?: string): Promise<Db & { raw: PGlite }> {
  const pg = new PGlite(dataDir);
  const schema = readFileSync(fileURLToPath(new URL('./schema.sql', import.meta.url)), 'utf8');
  await pg.exec(schema);
  return {
    raw: pg,
    query: (text, params) => pg.query(text, params as unknown[]) as never,
    tx: (fn) => pg.transaction((t) => fn({ query: (text, params) => t.query(text, params as unknown[]) as never })),
  };
}
