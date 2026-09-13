import pg from 'pg';
import { ENV } from './env.js';

const { Pool } = pg;

let pool: pg.Pool | null = null;
let isMockDb = false;

// In-memory data store fallback if Neon connection is unavailable in local dev
interface MockStore {
  users: any[];
  classes: any[];
  students: any[];
  esp32_devices: any[];
  attendance_sessions: any[];
  attendance_records: any[];
  challenge_nonces: any[];
}

export const mockStore: MockStore = {
  users: [],
  classes: [],
  students: [],
  esp32_devices: [],
  attendance_sessions: [],
  attendance_records: [],
  challenge_nonces: [],
};

export function getDbPool(): pg.Pool | null {
  if (!pool && ENV.DATABASE_URL && !ENV.DATABASE_URL.includes('ep-sample-neon-pooler')) {
    try {
      pool = new Pool({
        connectionString: ENV.DATABASE_URL,
        ssl: {
          rejectUnauthorized: false, // Required for Neon PostgreSQL serverless connections
        },
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 15000,
      });

      pool.on('error', (err) => {
        console.error('Unexpected error on idle Neon DB client', err);
      });
    } catch (err) {
      console.warn('Could not initialize PostgreSQL Pool', err);
      pool = null;
    }
  }
  return pool;
}

export async function testDbConnection(): Promise<boolean> {
  const p = getDbPool();
  if (!p) {
    console.log('[DB] No database pool available');
    return false;
  }
  try {
    const client = await p.connect();
    const res = await client.query('SELECT NOW() as current_time');
    client.release();
    console.log('[DB] Successfully connected to Neon PostgreSQL! Time:', res.rows[0].current_time);
    return true;
  } catch (err: any) {
    console.warn('[DB] Neon PostgreSQL connection attempt failed:', err.message);
    return false;
  }
}

export async function query(text: string, params?: any[]): Promise<any> {
  const p = getDbPool();
  if (p) {
    try {
      return await p.query(text, params);
    } catch (err: any) {
      console.error('[DB Query Error]', err.message, 'SQL:', text);
      throw err;
    }
  }

  // Fallback only if database pool is completely unavailable
  return executeMockQuery(text, params || []);
}

// Simple query handler for in-memory fallback
function executeMockQuery(sql: string, params: any[]): { rows: any[]; rowCount: number } {
  const cleanSql = sql.trim().toUpperCase();

  // Basic in-memory routing for common operations
  if (cleanSql.startsWith('SELECT NOW()')) {
    return { rows: [{ current_time: new Date() }], rowCount: 1 };
  }

  // Handle users query
  if (cleanSql.includes('FROM USERS')) {
    let rows = [...mockStore.users];
    if (cleanSql.includes('WHERE EMAIL = $1')) {
      rows = rows.filter((u) => u.email.toLowerCase() === (params[0] || '').toLowerCase());
    } else if (cleanSql.includes('WHERE ID = $1')) {
      rows = rows.filter((u) => u.id === params[0]);
    }
    return { rows, rowCount: rows.length };
  }

  // Handle students query
  if (cleanSql.includes('FROM STUDENTS')) {
    let rows = [...mockStore.students];
    if (cleanSql.includes('WHERE ENROLLMENT_NUMBER = $1')) {
      rows = rows.filter((s) => s.enrollment_number.toUpperCase() === (params[0] || '').toUpperCase());
    } else if (cleanSql.includes('WHERE ID = $1')) {
      rows = rows.filter((s) => s.id === params[0]);
    } else if (cleanSql.includes('WHERE CLASS_ID = $1')) {
      rows = rows.filter((s) => s.class_id === params[0]);
    }
    return { rows, rowCount: rows.length };
  }

  // Handle classes query
  if (cleanSql.includes('FROM CLASSES')) {
    let rows = [...mockStore.classes];
    if (cleanSql.includes('WHERE ID = $1')) {
      rows = rows.filter((c) => c.id === params[0]);
    }
    return { rows, rowCount: rows.length };
  }

  // Handle esp32_devices query
  if (cleanSql.includes('FROM ESP32_DEVICES')) {
    let rows = [...mockStore.esp32_devices];
    if (cleanSql.includes('WHERE ESP32_ID = $1')) {
      rows = rows.filter((d) => d.esp32_id === params[0]);
    } else if (cleanSql.includes('WHERE ID = $1')) {
      rows = rows.filter((d) => d.id === params[0]);
    }
    return { rows, rowCount: rows.length };
  }

  // Handle attendance_sessions query
  if (cleanSql.includes('FROM ATTENDANCE_SESSIONS')) {
    let rows = [...mockStore.attendance_sessions];
    if (cleanSql.includes('WHERE ID = $1')) {
      rows = rows.filter((s) => s.id === params[0]);
    } else if (cleanSql.includes("WHERE STATUS = 'ACTIVE'")) {
      rows = rows.filter((s) => s.status === 'active');
    }
    return { rows, rowCount: rows.length };
  }

  // Handle attendance_records query
  if (cleanSql.includes('FROM ATTENDANCE_RECORDS')) {
    let rows = [...mockStore.attendance_records];
    if (cleanSql.includes('WHERE SESSION_ID = $1 AND STUDENT_ID = $2')) {
      rows = rows.filter((r) => r.session_id === params[0] && r.student_id === params[1]);
    } else if (cleanSql.includes('WHERE SESSION_ID = $1')) {
      rows = rows.filter((r) => r.session_id === params[0]);
    } else if (cleanSql.includes('WHERE STUDENT_ID = $1')) {
      rows = rows.filter((r) => r.student_id === params[0]);
    }
    return { rows, rowCount: rows.length };
  }

  // Handle challenge_nonces query
  if (cleanSql.includes('FROM CHALLENGE_NONCES')) {
    let rows = [...mockStore.challenge_nonces];
    if (cleanSql.includes('WHERE NONCE = $1')) {
      rows = rows.filter((n) => n.nonce === params[0]);
    }
    return { rows, rowCount: rows.length };
  }

  // Inserts
  if (cleanSql.startsWith('INSERT INTO ATTENDANCE_RECORDS')) {
    const newRecord = {
      id: params[0] || crypto.randomUUID(),
      session_id: params[1],
      student_id: params[2],
      class_id: params[3],
      esp32_id: params[4],
      marked_at: new Date(),
      status: params[5] || 'present',
      rejection_reason: params[6] || null,
      verification_nonce: params[7] || null,
      rssi_dbm: params[8] || -65,
      verification_latency_ms: params[9] || 120,
      ip_address: params[10] || '127.0.0.1',
      device_info: params[11] || 'Mobile BLE',
    };
    mockStore.attendance_records.push(newRecord);
    return { rows: [newRecord], rowCount: 1 };
  }

  if (cleanSql.startsWith('INSERT INTO CHALLENGE_NONCES')) {
    const newNonce = {
      id: params[0] || crypto.randomUUID(),
      nonce: params[1],
      student_id: params[2],
      esp32_id: params[3],
      used_at: new Date(),
      expires_at: params[4] || new Date(Date.now() + 120000),
    };
    mockStore.challenge_nonces.push(newNonce);
    return { rows: [newNonce], rowCount: 1 };
  }

  return { rows: [], rowCount: 0 };
}
