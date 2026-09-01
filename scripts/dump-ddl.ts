// @ts-nocheck: dev utility using bun:sqlite (bun runtime only)
// Dump CREATE TABLE / CREATE INDEX DDL from the live SQLite DB
import { Database } from 'bun:sqlite';
const d = new Database('/home/z/my-project/db/custom.db', { readonly: true });
const rows = d.query("SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_migrations%' ORDER BY CASE type WHEN 'table' THEN 0 ELSE 1 END, name").all() as any[];
for (const r of rows) {
  let sql: string = r.sql;
  if (r.type === 'table') sql = sql.replace(/^CREATE TABLE /, 'CREATE TABLE IF NOT EXISTS ');
  if (r.type === 'index') sql = sql.replace(/^CREATE (UNIQUE )?INDEX /, 'CREATE $1INDEX IF NOT EXISTS ');
  console.log(sql + ';');
  console.log('');
}
d.close();
