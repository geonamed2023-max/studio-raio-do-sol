const fs = require('fs');
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

async function runDeduplication() {
    console.log('🧹 Iniciando limpeza de duplicatas e sincronização exclusiva das novas marcações da Deise...');

    // 1. Carregar agendamentos originais do Render (2383)
    const renderOriginals = JSON.parse(fs.readFileSync('backup_render_completo.json', 'utf8'));
    console.log(`📦 Carregados ${renderOriginals.length} agendamentos originais do Render.`);

    // 2. Conectar ao Supabase e buscar agendamentos feitos pela Deise / novos
    const client = await supabasePool.connect();
    const supRes = await client.query('SELECT * FROM appointments WHERE id NOT LIKE $1 AND created_by != $2', ['ap_rescued_%', 'Backup Prints']);
    console.log(`📦 Encontrados ${supRes.rows.length} agendamentos legítimos no Supabase (ignorando os prints temporários).`);

    // 3. Fazer login no Render para pegar a lista de profissionais e serviços
    const token = await loginToRender();
    const renderUsers = await httpsGet('https://studio-raio-do-sol.onrender.com/api/users?role=funcionario&status=ativo', token);
    const validRenderUserIds = new Set(['admin']);
    const userByName = { 'deise rose': { id: 'admin', name: 'Deise Rose' } };
    if (Array.isArray(renderUsers)) {
        renderUsers.forEach(u => {
            validRenderUserIds.add(String(u.id));
            if (u.name) userByName[u.name.toLowerCase().trim()] = u;
        });
    }

    const renderServices = await httpsGet('https://studio-raio-do-sol.onrender.com/api/services', token);
    const validRenderServiceIds = new Set();
    if (Array.isArray(renderServices)) {
        renderServices.forEach(s => validRenderServiceIds.add(String(s.id)));
    }

    // 4. Montar mapa final limpo sem nenhuma duplicata
    const finalMap = new Map();

    // Adicionar todos os originais do Render
    for (const a of renderOriginals) {
        if (!String(a.id).startsWith('ap_rescued_') && a.createdBy !== 'Backup Prints') {
            finalMap.set(String(a.id), {
                id: String(a.id),
                professionalId: a.professionalId ? String(a.professionalId) : null,
                professionalName: a.professionalName || '',
                professionalInitials: a.professionalInitials || '',
                professionalColor: a.professionalColor || '',
                client: a.client || '',
                phone: a.phone || '',
                serviceId: a.serviceId ? String(a.serviceId) : null,
                serviceName: a.serviceName || '',
                servicePrice: parseFloat(a.servicePrice) || 0,
                date: a.date,
                timeStart: a.timeStart,
                timeEnd: a.timeEnd,
                status: a.status || 'Agendado',
                payoutInvoiced: a.payoutInvoiced || false,
                createdBy: a.createdBy || '',
                isMutual: a.isMutual || false,
                professionalId2: a.professionalId2 ? String(a.professionalId2) : null,
                professionalName2: a.professionalName2 || '',
                professionalInitials2: a.professionalInitials2 || '',
                professionalColor2: a.professionalColor2 || ''
            });
        }
    }

    // Adicionar novas marcações feitas no Supabase (como as da Deise)
    let newDeiseCount = 0;
    for (const row of supRes.rows) {
        if (!finalMap.has(String(row.id))) {
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

            finalMap.set(String(row.id), {
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
            });
            newDeiseCount++;
            console.log(` ✨ Nova marcação adicionada: ${row.date} ${row.time_start} - ${row.client} (${row.service_name}) [${row.professional_name}] Criado por: ${row.created_by}`);
        }
    }

    const finalList = Array.from(finalMap.values());
    console.log(`\n📊 Total final consolidado SEM duplicatas: ${finalList.length} agendamentos (inclui ${newDeiseCount} novas marcações da Deise!).`);

    // 5. Enviar lista 100% limpa ao Render
    console.log('🚀 Sincronizando com o Render...');
    const syncRes = await syncAppointmentsToRender(token, finalList);
    console.log('   ✅ Resposta do Render:', syncRes);

    // 6. Verificar total no Render
    const verifyAppts = await httpsGet('https://studio-raio-do-sol.onrender.com/api/appointments', token);
    console.log(`\n🎉 CONCLUÍDO! O Render agora tem exatamente ${verifyAppts.length} agendamentos limpos, sem duplicatas e com todas as novas marcações da Deise!`);

    client.release();
    await supabasePool.end();
}

runDeduplication().catch(err => {
    console.error('❌ Erro:', err);
    process.exit(1);
});
