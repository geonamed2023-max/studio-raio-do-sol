const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const CUTOFF_DATE = '2026-09-20';
const SUPABASE_URI = 'postgresql://postgres.vvktnslnvqgeznuzmroz:StudioRaio2026%23@aws-0-sa-east-1.pooler.supabase.com:6543/postgres';

const pool = new Pool({
    connectionString: SUPABASE_URI,
    ssl: { rejectUnauthorized: false }
});

async function main() {
    console.log('🚀 Iniciando processo de Backup e Limpeza...');
    const client = await pool.connect();

    try {
        // 1. Buscar todos os dados para backup completo
        console.log('\n📦 1. Coletando dados completos para Backup no PC...');
        const allApptsRes = await client.query('SELECT * FROM appointments ORDER BY date ASC, time_start ASC');
        const allClientsRes = await client.query('SELECT * FROM clients ORDER BY name ASC');
        const allServicesRes = await client.query('SELECT * FROM services ORDER BY name ASC');
        const allUsersRes = await client.query('SELECT id, name, email, phone, role, status, specialty, percentual FROM users');

        console.log(`   📊 Total de Agendamentos encontrados: ${allApptsRes.rows.length}`);
        console.log(`   👩 Total de Clientes: ${allClientsRes.rows.length}`);
        console.log(`   💅 Total de Serviços: ${allServicesRes.rows.length}`);
        console.log(`   👥 Total de Profissionais: ${allUsersRes.rows.length}`);

        // 2. Salvar Backup em JSON completo no PC
        const backupJson = {
            exportDate: new Date().toISOString(),
            cutoffDateApplied: CUTOFF_DATE,
            totalAppointments: allApptsRes.rows.length,
            totalClients: allClientsRes.rows.length,
            totalServices: allServicesRes.rows.length,
            totalUsers: allUsersRes.rows.length,
            appointments: allApptsRes.rows,
            clients: allClientsRes.rows,
            services: allServicesRes.rows,
            users: allUsersRes.rows
        };

        const jsonFileName = `backup_completo_studio_${CUTOFF_DATE}.json`;
        const jsonFilePath = path.join(__dirname, '..', jsonFileName);
        fs.writeFileSync(jsonFilePath, JSON.stringify(backupJson, null, 2), 'utf8');
        console.log(`\n💾 ✅ Backup JSON salvo com sucesso em:\n   ${jsonFilePath}`);

        // 3. Salvar Backup em CSV (para Excel) no PC
        const headers = [
            'id', 'date', 'time_start', 'time_end', 'client', 'phone',
            'professional_name', 'service_name', 'service_price', 'status',
            'created_by', 'is_mutual', 'professional2_name'
        ];
        let csv = headers.join(';') + '\n';
        allApptsRes.rows.forEach(row => {
            const line = headers.map(h => {
                let val = row[h] !== null && row[h] !== undefined ? String(row[h]) : '';
                val = val.replace(/;/g, ',').replace(/\n/g, ' ').replace(/\r/g, '');
                return `"${val}"`;
            }).join(';');
            csv += line + '\n';
        });

        const csvFileName = `backup_completo_agendamentos_${CUTOFF_DATE}.csv`;
        const csvFilePath = path.join(__dirname, '..', csvFileName);
        fs.writeFileSync(csvFilePath, '\uFEFF' + csv, 'utf8'); // UTF-8 BOM for Excel
        console.log(`💾 ✅ Backup CSV (Excel) salvo com sucesso em:\n   ${csvFilePath}`);

        // 4. Analisar agendamentos antes e depois de 20/09/2026
        const toDeleteCount = allApptsRes.rows.filter(a => a.date < CUTOFF_DATE).length;
        const toKeepCount = allApptsRes.rows.filter(a => a.date >= CUTOFF_DATE).length;

        console.log(`\n📋 Status da Limpeza:`);
        console.log(`   🗑️  Agendamentos a EXCLUIR (anteriores a ${CUTOFF_DATE}): ${toDeleteCount}`);
        console.log(`   ✅ Agendamentos a MANTER (de ${CUTOFF_DATE} em diante): ${toKeepCount}`);

        // 5. Excluir agendamentos anteriores a 20/09/2026
        console.log(`\n🗑️  Excluindo ${toDeleteCount} agendamentos antigos...`);
        const delRes = await client.query('DELETE FROM appointments WHERE date < $1', [CUTOFF_DATE]);
        console.log(`   ✅ ${delRes.rowCount} agendamentos antigos foram excluídos do banco!`);

        // 6. Verificar total restante no banco
        const finalCountRes = await client.query('SELECT COUNT(*) as total FROM appointments');
        console.log(`\n📊 Total final de agendamentos no banco: ${finalCountRes.rows[0].total}`);

        // 7. VACUUM para liberar espaço de disco
        console.log('\n🧹 Executando VACUUM para liberar espaço físico no banco...');
        try {
            await client.query('VACUUM');
            console.log('   ✅ Espaço liberado com sucesso!');
        } catch (vErr) {
            console.log('   (VACUUM ignorado ou concluído)');
        }

        console.log('\n🎉 LIMPEZA E BACKUP CONCLUÍDOS COM SUCESSO TOTAL!');

    } catch (err) {
        console.error('❌ Erro no processo:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

main();
