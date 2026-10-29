const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const uri = 'postgresql://postgres.vvktnslnvqgeznuzmroz:StudioRaio2026%23@aws-0-sa-east-1.pooler.supabase.com:6543/postgres';
const pool = new Pool({ connectionString: uri, ssl: { rejectUnauthorized: false } });

async function test() {
    try {
        const res = await pool.query('SELECT * FROM users WHERE email = $1', ['deise.com']);
        console.log('User found:', res.rows[0].name);
        const valid = await bcrypt.compare('deise.com', res.rows[0].password);
        console.log('Password valid:', valid);
        process.exit(0);
    } catch(e) {
        console.error('Error:', e.message);
        process.exit(1);
    }
}
test();
