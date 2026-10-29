const https = require('https');
const { Pool } = require('pg');

const supabasePool = new Pool({
    connectionString: 'postgresql://postgres.vvktnslnvqgeznuzmroz:StudioRaio2026%23@aws-0-sa-east-1.pooler.supabase.com:6543/postgres',
    ssl: { rejectUnauthorized: false }
});

function httpsGet(url, token) {
    return new Promise((resolve, reject) => {
        https.get(url, {
            headers: token ? { 'Authorization': 'Bearer ' + token } : {}
        }, res => {
            let body = '';
            res.on('data', d => body += d);
            res.on('end', () => {
                try { resolve(JSON.parse(body)); }
                catch(e) { resolve(body); }
            });
        }).on('error', reject);
    });
}

function loginToRender() {
    return new Promise((resolve, reject) => {
        const loginData = JSON.stringify({ email: 'deise.com', password: 'deise.com' });
        const req = https.request('https://studio-raio-do-sol.onrender.com/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': loginData.length
            }
        }, res => {
            let body = '';
            res.on('data', d => body += d);
            res.on('end', () => {
                try {
                    const json = JSON.parse(body);
                    if (json.token) resolve(json.token);
                    else reject(new Error('Login failed: ' + body));
                } catch(e) { reject(e); }
            });
        });
        req.on('error', reject);
        req.write(loginData);
        req.end();
    });
}

function syncAppointmentsToRender(token, allAppointments) {
    return new Promise((resolve, reject) => {
        const payload = JSON.stringify(allAppointments);
        const req = https.request('https://studio-raio-do-sol.onrender.com/api/appointments/sync', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload),
                'Authorization': 'Bearer ' + token
            }
        }, res => {
            let body = '';
            res.on('data', d => body += d);
            res.on('end', () => {
                try { resolve(JSON.parse(body)); }
                catch(e) { resolve(body); }
            });
        });
        req.on('error', reject);
        req.write(payload);
        req.end();
    });
}

async function main() {
    console.log('🔄 Iniciando sincronização: Supabase ➔ Render...');
    
    // 1. Conectar ao Supabase
    const client = await supabasePool.connect();
    const supRes = await client.query('SELECT * FROM appointments ORDER BY date ASC, time_start ASC');
    console.log(`📦 Supabase tem: ${supRes.rows.length} agendamentos.`);

    // 2. Fazer login no Render
    console.log('🔑 Autenticando no Render...');
    const token = await loginToRender();
    console.log('   ✅ Autenticado com sucesso!');

    // 3. Obter usuários e serviços do Render para mapear chaves estrangeiras
    const renderUsers = await httpsGet('https://studio-raio-do-sol.onrender.com/api/users?role=funcionario&status=ativo', token);
    const validRenderUserIds = new Set();
    const userByName = {};
    if (Array.isArray(renderUsers)) {
        renderUsers.forEach(u => {
            validRenderUserIds.add(String(u.id));
            if (u.name) userByName[u.name.toLowerCase().trim()] = u;
        });
    }

    // Também obter admins do Render
    const adminUser = { id: 'admin', name: 'Deise Rose' };
    validRenderUserIds.add('admin');
    userByName['deise rose'] = adminUser;

    const renderServices = await httpsGet('https://studio-raio-do-sol.onrender.com/api/services', token);
    const validRenderServiceIds = new Set();
    if (Array.isArray(renderServices)) {
        renderServices.forEach(s => validRenderServiceIds.add(String(s.id)));
    }

    console.log(`📋 Render possui ${validRenderUserIds.size} profissionais válidos e ${validRenderServiceIds.size} serviços.`);

    // Mapear campos e corrigir IDs
    const cleanAppointments = supRes.rows.map(row => {
        let pId = (row.professional_id && validRenderUserIds.has(String(row.professional_id))) ? String(row.professional_id) : null;
        if (!pId && row.professional_name) {
            const match = userByName[row.professional_name.toLowerCase().trim()];
            if (match) pId = String(match.id);
        }

        let pId2 = (row.professional2_id && validRenderUserIds.has(String(row.professional2_id))) ? String(row.professional2_id) : null;
        if (!pId2 && row.professional2_name) {
            const match2 = userByName[row.professional2_name.toLowerCase().trim()];
            if (match2) pId2 = String(match2.id);
        }

        let sId = (row.service_id && validRenderServiceIds.has(String(row.service_id))) ? String(row.service_id) : null;

        return {
            id: String(row.id),
            professionalId: pId,
            professionalName: row.professional_name || '',
            professionalInitials: row.professional_initials || '',
            professionalColor: row.professional_color || '',
            client: row.client || '',
            phone: row.phone || '',
            serviceId: sId,
            serviceName: row.service_name || '',
            servicePrice: parseFloat(row.service_price) || 0,
            date: row.date,
            timeStart: row.time_start,
            timeEnd: row.time_end,
            status: row.status || 'Agendado',
            payoutInvoiced: row.payout_invoiced || false,
            createdBy: row.created_by || '',
            isMutual: row.is_mutual || false,
            professionalId2: pId2,
            professionalName2: row.professional2_name || '',
            professionalInitials2: row.professional2_initials || '',
            professionalColor2: row.professional2_color || ''
        };
    });

    console.log(`🚀 Enviando ${cleanAppointments.length} agendamentos limpos e validados para o Render...`);
    const syncRes = await syncAppointmentsToRender(token, cleanAppointments);
    console.log('   ✅ Resposta do Render:', syncRes);

    // 5. Verificar total final no Render
    const finalRenderAppts = await httpsGet('https://studio-raio-do-sol.onrender.com/api/appointments', token);
    console.log(`\n🎉 SUCESSO TOTAL! Agendamentos atualizados no Render: ${finalRenderAppts.length}`);

    client.release();
    await supabasePool.end();
}

main().catch(err => {
    console.error('❌ Erro:', err);
    process.exit(1);
});
