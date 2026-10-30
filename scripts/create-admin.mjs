import { loadEnvFile } from 'node:process';
import { createInterface } from 'node:readline';
import { randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';
import pg from 'pg';

try { loadEnvFile('.env.local'); } catch { /* show a clear message below if DATABASE_URL is missing */ }
const { Pool } = pg;
const scrypt = promisify(scryptCallback);

function ask(question) {
  return new Promise(resolve => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, answer => { rl.close(); resolve(answer.trim()); });
  });
}
function askHidden(question) {
  return new Promise(resolve => {
    if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') return resolve(ask(question));
    const input = process.stdin; process.stdout.write(question); let answer = '';
    const finish = () => { input.setRawMode(false); input.pause(); input.removeListener('data', handler); process.stdout.write('\n'); resolve(answer); };
    const handler = key => {
      const data = key.toString();
      if (data === '\u0003') { process.stdout.write('\nCancelled.\n'); process.exit(130); }
      if (data === '\r' || data === '\n') return finish();
      if (data === '\u007f' || data === '\b') { answer = answer.slice(0, -1); return; }
      if (data >= ' ' && data !== '\u007f') answer += data;
    };
    input.setRawMode(true); input.resume(); input.on('data', handler);
  });
}
async function hashPassword(password) {
  const salt = randomBytes(16); const key = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${Buffer.from(key).toString('hex')}`;
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is missing. Copy .env.example to .env.local and start Docker PostgreSQL first.');
  process.exit(1);
}
const emailInput = process.argv[2] || await ask('Super Admin email [admin@23hotel.com]: ');
const email = (emailInput || 'admin@23hotel.com').trim().toLowerCase();
const name = process.argv[3] || await ask('Super Admin display name [Hotel Administrator]: ') || 'Hotel Administrator';
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { console.error('Enter a valid email address.'); process.exit(1); }
const password = await askHidden('New password (minimum 10 characters): ');
const confirm = await askHidden('Confirm password: ');
if (password.length < 10 || password.length > 256) { console.error('Password must contain 10 to 256 characters.'); process.exit(1); }
if (password !== confirm) { console.error('Passwords do not match.'); process.exit(1); }
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
try {
  const passwordHash = await hashPassword(password);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const userResult = await client.query(
      `INSERT INTO users(email,full_name,password_hash,is_enabled) VALUES($1,$2,$3,true)
       ON CONFLICT(email) DO UPDATE SET full_name=EXCLUDED.full_name,password_hash=EXCLUDED.password_hash,is_enabled=true
       RETURNING id`, [email, name, passwordHash]
    );
    const userId = userResult.rows[0].id;
    await client.query(`INSERT INTO profiles(user_id,full_name) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET full_name=EXCLUDED.full_name`, [userId, name]);
    await client.query(
      `INSERT INTO staff_profiles(user_id,display_name,role,is_active) VALUES($1,$2,'super_admin',true)
       ON CONFLICT(user_id) DO UPDATE SET display_name=EXCLUDED.display_name,role='super_admin',is_active=true`, [userId, name]
    );
    await client.query("INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,metadata) VALUES($1,'bootstrap.super_admin.created','staff_profile',$1,$2::jsonb)", [userId, JSON.stringify({ email })]);
    await client.query('COMMIT');
    console.log(`Super Admin account is ready: ${email}`);
    console.log('Sign in at http://localhost:3000/login?next=/admin');
    console.log('The password was stored as a salted scrypt hash and was not printed.');
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
} catch (error) {
  console.error('Could not create Super Admin. Confirm Docker is healthy and the schema was initialized.');
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally { await pool.end(); }
