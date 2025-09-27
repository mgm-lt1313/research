import { Pool } from 'pg';

// DATABASE_URL 環境変数が設定されているか確認
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

// PostgreSQL接続プールを作成
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // 本番環境ではSSL接続を推奨
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// データベース接続テスト (起動時に一度だけ実行)
pool.on('connect', () => {
  console.log('Database connected!');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

export default pool;