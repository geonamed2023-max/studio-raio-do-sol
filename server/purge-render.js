const https = require('https');

function login() {
    return new Promise((resolve, reject) => {
        const loginData = JSON.stringify({ email: 'deise.com', password: 'deise.com' });
        const req = https.request('https://studio-raio-do-sol.onrender.com/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(loginData)
            },
            timeout: 15000
        }, res => {
            let b = '';
            res.on('data', d => b += d);
            res.on('end', () => {
                try {
                    const j = JSON.parse(b);
                    if (j.token) resolve(j.token);
                    else reject(new Error('Login failed: ' + b));
                } catch(e) { reject(e); }
            });
        });
        req.on('error', reject);
        req.write(loginData);
        req.end();
    });
}

function countOld(token, beforeDate) {
    return new Promise((resolve, reject) => {
        https.get('https://studio-raio-do-sol.onrender.com/api/admin/count-old-appointments?before=' + beforeDate, {
            headers: { 'Authorization': 'Bearer ' + token },
            timeout: 15000
        }, res => {
            let b = '';
            res.on('data', d => b += d);
            res.on('end', () => {
                try { resolve(JSON.parse(b)); }
                catch(e) { reject(e); }
            });
        }).on('error', reject);
    });
}

function purgeOld(token, beforeDate) {
    return new Promise((resolve, reject) => {
        const req = https.request('https://studio-raio-do-sol.onrender.com/api/admin/purge-old-appointments?before=' + beforeDate, {
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer ' + token },
            timeout: 30000
        }, res => {
            let b = '';
            res.on('data', d => b += d);
            res.on('end', () => {
                try { resolve(JSON.parse(b)); }
                catch(e) { resolve(b); }
            });
        });
        req.on('error', reject);
        req.end();
    });
}

async function run() {
    const CUTOFF = '2026-10-08';
    console.log('🔑 1. Autenticando como Admin no Render...');
    const token = await login();
    console.log('   ✅ Autenticado com sucesso!');

    console.log('\n📊 2. Analisando agendamentos no banco do Render...');
    const countData = await countOld(token, CUTOFF);
    console.log('   - 🗑️  A serem excluídos (anteriores a ' + CUTOFF + '): ' + countData.toDelete);
    console.log('   - ✅ A serem mantidos (de ' + CUTOFF + ' em diante): ' + countData.toKeep);
    console.log('   - Tamanho atual do banco: ' + countData.dbSize);

    console.log('\n🗑️  3. Executando exclusão e VACUUM no Render...');
    const purgeResult = await purgeOld(token, CUTOFF);
    console.log('   ✅ Resposta do servidor:', purgeResult);

    console.log('\n🔍 4. Verificação pós-limpeza no Render...');
    const finalCount = await countOld(token, CUTOFF);
    console.log('   - Total de agendamentos mantidos (de ' + CUTOFF + ' em diante): ' + finalCount.toKeep);
    console.log('   - Restantes anteriores a ' + CUTOFF + ': ' + finalCount.toDelete);
    console.log('   - Tamanho atualizado do banco: ' + finalCount.dbSize);

    // 5. Limpar também no Supabase (espelho)
    console.log('\n☁️  5. Limpando também no Supabase (banco espelho)...');
    try {
        const { Pool } = require('pg');
        const supabasePool = new Pool({
            connectionString: 'postgresql://postgres.vvktnslnvqgeznuzmroz:StudioRaio2026%23@aws-0-sa-east-1.pooler.supabase.com:6543/postgres',
            ssl: { rejectUnauthorized: false }
        });
        const client = await supabasePool.connect();
        const supDel = await client.query('DELETE FROM appointments WHERE date < $1', [CUTOFF]);
        console.log('   ✅ ' + supDel.rowCount + ' agendamentos antigos excluídos no Supabase.');
        const supRemain = await client.query('SELECT COUNT(*) as total FROM appointments');
        console.log('   ✅ Restantes no Supabase: ' + supRemain.rows[0].total);
        client.release();
        await supabasePool.end();
    } catch(supErr) {
        console.warn('   ⚠️  Aviso ao limpar Supabase:', supErr.message);
    }

    console.log('\n🎉 LIMPEZA CONCLUÍDA COM SUCESSO TOTAL!');
}

run().catch(e => {
    console.error('❌ Erro:', e.message);
    process.exit(1);
});
