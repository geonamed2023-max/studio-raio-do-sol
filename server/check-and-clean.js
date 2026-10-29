const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const CUTOFF_DATE = '2026-10-20';
const SUPABASE_URI = 'postgresql://postgres.vvktnslnvqgeznuzmroz:StudioRaio2026%23@aws-0-sa-east-1.pooler.supabase.com:6543/postgres';

const pool = new Pool({
    connectionString: SUPABASE_URI,
    ssl: { rejectUnauthorized: false }
});

async function main() {
    console.log('🔍 1. Conectando ao banco de dados Supabase...');
    const client = await pool.connect();

    try {
        const totalRes = await client.query('SELECT COUNT(*) FROM appointments');
        const total = parseInt(totalRes.rows[0].count);
        console.log(`📊 Total de agendamentos no banco: ${total}`);

        const beforeRes = await client.query('SELECT COUNT(*) FROM appointments WHERE date < $1', [CUTOFF_DATE]);
        const countBefore = parseInt(beforeRes.rows[0].count);

        const afterRes = await client.query('SELECT COUNT(*) FROM appointments WHERE date >= $1', [CUTOFF_DATE]);
        const countAfter = parseInt(afterRes.rows[0].count);

        console.log(`   - 🗑️  Anteriores a ${CUTOFF_DATE} (para limpar): ${countBefore}`);
        console.log(`   - ✅ A partir de ${CUTOFF_DATE} (para manter): ${countAfter}`);

        // Fazer backup completo antes de deletar qualquer coisa
        console.log('\n💾 2. Coletando dados completos para BACKUP no seu computador...');
        const allAppts = await client.query('SELECT * FROM appointments ORDER BY date ASC, time_start ASC');
        const allClients = await client.query('SELECT * FROM clients ORDER BY name ASC');
        const allServices = await client.query('SELECT * FROM services ORDER BY name ASC');
        const allUsers = await client.query('SELECT id, name, email, phone, role, status, specialty FROM users');

        const dateStr = new Date().toISOString().split('T')[0];
        const backupJson = {
            exportDate: new Date().toISOString(),
            cutoffDateApplied: CUTOFF_DATE,
            totalAppointments: allAppts.rows.length,
            totalClients: allClients.rows.length,
            totalServices: allServices.rows.length,
            totalUsers: allUsers.rows.length,
            appointments: allAppts.rows,
            clients: allClients.rows,
            services: allServices.rows,
            users: allUsers.rows
        };

        const jsonFileName = `backup_studio_antes_${CUTOFF_DATE}_gerado_${dateStr}.json`;
        const jsonFilePath = path.join(__dirname, '..', jsonFileName);
        fs.writeFileSync(jsonFilePath, JSON.stringify(backupJson, null, 2), 'utf8');
        console.log(`   ✅ Backup JSON salvo em:\n   ${jsonFilePath}`);

        // CSV para Excel
        const headers = [
            'id', 'date', 'time_start', 'time_end', 'client', 'phone',
            'professional_name', 'service_name', 'service_price', 'status',
            'created_by', 'is_mutual', 'professional2_name'
        ];
        let csv = headers.join(';') + '\n';
        allAppts.rows.forEach(row => {
            const line = headers.map(h => {
                let val = row[h] !== null && row[h] !== undefined ? String(row[h]) : '';
                val = val.replace(/;/g, ',').replace(/\n/g, ' ').replace(/\r/g, '');
                return `"${val}"`;
            }).join(';');
            csv += line + '\n';
        });

        const csvFileName = `backup_agendamentos_antes_${CUTOFF_DATE}_gerado_${dateStr}.csv`;
        const csvFilePath = path.join(__dirname, '..', csvFileName);
        fs.writeFileSync(csvFilePath, '\uFEFF' + csv, 'utf8');
        console.log(`   ✅ Backup CSV (Excel) salvo em:\n   ${csvFilePath}`);

        // 3. Executar a limpeza
        console.log(`\n🗑️  3. Limpando agendamentos anteriores a ${CUTOFF_DATE}...`);
        const delRes = await client.query('DELETE FROM appointments WHERE date < $1', [CUTOFF_DATE]);
        console.log(`   ✅ ${delRes.rowCount} agendamentos antigos excluídos com sucesso!`);

        // 4. Verificar total pós-limpeza
        const finalCountRes = await client.query('SELECT COUNT(*) FROM appointments');
        console.log(`\n🎉 4. Limpeza concluída!`);
        console.log(`   - Agendamentos restantes no banco (de ${CUTOFF_DATE} em diante): ${finalCountRes.rows[0].count}`);

        // Range de datas restantes
        const rangeRes = await client.query('SELECT MIN(date) as min_date, MAX(date) as max_date FROM appointments');
        console.log(`   - Período ativo: de ${rangeRes.rows[0].min_date} até ${rangeRes.rows[0].max_date}`);

    } catch (err) {
        console.error('❌ Erro:', err.message);
    } finally {
        client.release();
        await pool.end();
    }
}

main();
