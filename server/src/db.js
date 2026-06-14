import mysql from 'mysql2/promise';
import { assertDbConfig, config } from './config.js';

let pool;

export function getPool() {
  if (!pool) {
    assertDbConfig();
    pool = mysql.createPool({
      host: config.db.host,
      port: config.db.port,
      database: config.db.database,
      user: config.db.user,
      password: config.db.password,
      connectionLimit: config.db.connectionLimit,
      waitForConnections: true,
      namedPlaceholders: true,
      charset: 'utf8mb4'
    });
  }
  return pool;
}

export async function query(sql, params = []) {
  const [rows] = await getPool().query(sql, params);
  return rows;
}

export async function execute(sql, params = []) {
  const [result] = await getPool().execute(sql, params);
  return result;
}

export async function withTransaction(work) {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function pingDatabase() {
  try {
    await query('SELECT 1 AS ok');
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error.message };
  }
}

