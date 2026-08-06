import {Pool} from 'pg';

const connectionString = process.env.DATABASE_URL;
if (connectionString === undefined) {
  throw new Error('DATABASE_URL is required.');
}

const pool = new Pool({connectionString, max: 1});
try {
  const result = await pool.query<{
    key: string;
    value: {live: boolean; mode: string};
  }>('SELECT key, value FROM foundation_metadata WHERE key = $1', ['installation_mode']);

  if (result.rowCount !== 1) {
    throw new Error('Foundation migration marker is missing.');
  }
  console.info(JSON.stringify({status: 'ok', marker: result.rows[0]}));
} finally {
  await pool.end();
}
