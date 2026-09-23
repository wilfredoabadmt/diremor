import fs from 'fs';
import path from 'path';
import { pool } from './db.js';

async function runMigrations() {
  console.log('[Migraciones]: Iniciando ejecución de scripts DDL en PostgreSQL...');
  const client = await pool.connect();

  try {
    const migrationsDir = path.resolve(process.cwd(), 'database', 'migrations');
    const seedsDir = path.resolve(process.cwd(), 'database', 'seeds');

    if (fs.existsSync(migrationsDir)) {
      const migrationFiles = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
      for (const file of migrationFiles) {
        console.log(`[Migraciones]: Aplicando ${file}...`);
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
        await client.query(sql);
      }
    }

    if (fs.existsSync(seedsDir)) {
      const seedFiles = fs.readdirSync(seedsDir).filter(f => f.endsWith('.sql')).sort();
      for (const file of seedFiles) {
        console.log(`[Semillas]: Aplicando datos iniciales ${file}...`);
        const sql = fs.readFileSync(path.join(seedsDir, file), 'utf-8');
        await client.query(sql);
      }
    }

    console.log('[Migraciones]: Base de datos de DIREMOR SAC inicializada con éxito.');
  } catch (err: any) {
    console.error('[Error Crítico en Migraciones]:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations();
