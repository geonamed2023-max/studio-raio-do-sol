const fs = require('fs');
const path = require('path');
const https = require('https');

const DATE_STR = new Date().toISOString().split('T')[0];

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
                } catch(e) {
                    reject(e);
                }
            });
        });
        req.on('error', reject);
        req.write(loginData);
        req.end();
    });
}

function getBackup(token) {
    return new Promise((resolve, reject) => {
        https.get('https://studio-raio-do-sol.onrender.com/api/admin/backup-download', {
            headers: { 'Authorization': 'Bearer ' + token },
            timeout: 30000
        }, res => {
            let b = '';
            res.on('data', d => b += d);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(b));
                } catch(e) {
                    reject(new Error('Failed to parse backup JSON: ' + b.substring(0, 200)));
                }
            });
        }).on('error', reject);
    });
}

async function run() {
    console.log('🔄 Conectando ao servidor para extrair backup completo...');
    const token = await login();
    console.log('🔑 Autenticado com sucesso no Render!');

    console.log('📥 Baixando dados completos...');
    const data = await getBackup(token);

    console.log('\n📊 Dados recebidos:');
    console.log(`   - Data da exportação: ${data.exportDate}`);
    console.log(`   - Total de Agendamentos: ${data.totalAppointments}`);
    console.log(`   - Total de Clientes: ${data.totalClients}`);
    console.log(`   - Total de Serviços: ${data.totalServices}`);
    console.log(`   - Total de Usuários/Profissionais: ${data.users ? data.users.length : 0}`);

    // 1. Salvar JSON completo
    const jsonFileName = `backup_completo_studio_${DATE_STR}.json`;
    const jsonFilePath = path.join(__dirname, '..', jsonFileName);
    fs.writeFileSync(jsonFilePath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`\n💾 ✅ Arquivo JSON salvo com sucesso:`);
    console.log(`   ${jsonFilePath}`);

    // 2. Salvar CSV de agendamentos para Excel
    const headers = [
        'id', 'date', 'time_start', 'time_end', 'client', 'phone',
        'professional_name', 'service_name', 'service_price', 'status',
        'created_by', 'is_mutual', 'professional2_name'
    ];
    let csv = headers.join(';') + '\n';
    data.appointments.forEach(row => {
        const line = headers.map(h => {
            let val = row[h] !== null && row[h] !== undefined ? String(row[h]) : '';
            val = val.replace(/;/g, ',').replace(/\n/g, ' ').replace(/\r/g, '');
            return `"${val}"`;
        }).join(';');
        csv += line + '\n';
    });

    const csvFileName = `backup_completo_agendamentos_${DATE_STR}.csv`;
    const csvFilePath = path.join(__dirname, '..', csvFileName);
    fs.writeFileSync(csvFilePath, '\uFEFF' + csv, 'utf8');
    console.log(`💾 ✅ Arquivo CSV (Excel) salvo com sucesso:`);
    console.log(`   ${csvFilePath}`);

    // 3. Salvar CSV de clientes
    if (data.clients && data.clients.length > 0) {
        const clientHeaders = ['id', 'name', 'phone', 'level', 'created_at'];
        let clientCsv = clientHeaders.join(';') + '\n';
        data.clients.forEach(row => {
            const line = clientHeaders.map(h => {
                let val = row[h] !== null && row[h] !== undefined ? String(row[h]) : '';
                val = val.replace(/;/g, ',').replace(/\n/g, ' ').replace(/\r/g, '');
                return `"${val}"`;
            }).join(';');
            clientCsv += line + '\n';
        });
        const clientCsvFileName = `backup_clientes_${DATE_STR}.csv`;
        const clientCsvPath = path.join(__dirname, '..', clientCsvFileName);
        fs.writeFileSync(clientCsvPath, '\uFEFF' + clientCsv, 'utf8');
        console.log(`💾 ✅ Arquivo CSV de Clientes salvo com sucesso:`);
        console.log(`   ${clientCsvPath}`);
    }

    // Intervalo de datas
    const dates = data.appointments.map(a => a.date).filter(Boolean).sort();
    if (dates.length > 0) {
        console.log(`\n📅 Período dos agendamentos:`);
        console.log(`   - Primeiro agendamento: ${dates[0]}`);
        console.log(`   - Último agendamento: ${dates[dates.length - 1]}`);
    }

    // 4. Espelhamento no Supabase Cloud
    console.log('\n☁️  Sincronizando cópia de segurança em nuvem (Supabase)...');
    try {
        const { Pool } = require('pg');
        const supabasePool = new Pool({
            connectionString: 'postgresql://postgres.vvktnslnvqgeznuzmroz:StudioRaio2026%23@aws-0-sa-east-1.pooler.supabase.com:6543/postgres',
            ssl: { rejectUnauthorized: false }
        });
        const client = await supabasePool.connect();

        // Sync Clients
        if (data.clients && data.clients.length > 0) {
            for (const c of data.clients) {
                await client.query(`
                    INSERT INTO clients (id, name, phone, level, avatar)
                    VALUES ($1, $2, $3, $4, $5)
                    ON CONFLICT (id) DO UPDATE SET
                        name=EXCLUDED.name, phone=EXCLUDED.phone, level=EXCLUDED.level, avatar=EXCLUDED.avatar
                `, [c.id, c.name, c.phone, c.level || 'Freguês', c.avatar || null]);
            }
        }

        const usersRes = await client.query('SELECT id FROM users');
        const validUsers = new Set(usersRes.rows.map(u => u.id));
        const servicesRes = await client.query('SELECT id FROM services');
        const validServices = new Set(servicesRes.rows.map(s => s.id));

        for (const a of data.appointments) {
            const pId = a.professional_id && validUsers.has(String(a.professional_id)) ? String(a.professional_id) : null;
            const pId2 = a.professional2_id && validUsers.has(String(a.professional2_id)) ? String(a.professional2_id) : null;
            const sId = a.service_id && validServices.has(String(a.service_id)) ? String(a.service_id) : null;

            await client.query(`
                INSERT INTO appointments (
                    id, professional_id, professional_name, professional_initials, professional_color,
                    client, phone, service_id, service_name, service_price,
                    date, time_start, time_end, status, payout_invoiced, created_by, is_mutual,
                    professional2_id, professional2_name, professional2_initials, professional2_color
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
                ON CONFLICT (id) DO UPDATE SET
                    date=EXCLUDED.date, time_start=EXCLUDED.time_start, time_end=EXCLUDED.time_end,
                    status=EXCLUDED.status, service_price=EXCLUDED.service_price, client=EXCLUDED.client,
                    professional_name=EXCLUDED.professional_name
            `, [
                String(a.id),
                pId,
                a.professional_name || '',
                a.professional_initials || '',
                a.professional_color || '',
                a.client || '',
                a.phone || '',
                sId,
                a.service_name || '',
                parseFloat(a.service_price) || 0,
                a.date, a.time_start, a.time_end,
                a.status || 'Agendado',
                a.payout_invoiced || false,
                a.created_by || '',
                a.is_mutual || false,
                pId2,
                a.professional2_name || '',
                a.professional2_initials || '',
                a.professional2_color || ''
            ]);
        }
        client.release();
        await supabasePool.end();
        console.log('☁️  ✅ Supabase sincronizado com 100% dos dados mais recentes!');
    } catch (supErr) {
        console.warn('⚠️  Aviso ao sincronizar Supabase:', supErr.message);
    }

    console.log('\n🎉 BACKUP CONCLUÍDO COM SUCESSO TOTAL!');
}

run().catch(err => {
    console.error('❌ Erro no backup:', err);
    process.exit(1);
});
