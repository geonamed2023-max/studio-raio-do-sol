/**
 * Script de manutenção: Exportar e limpar agendamentos antigos
 * Uso: node cleanup-db.js "postgresql://user:pass@host/dbname"
 */
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = process.argv[2];
const CUTOFF_DATE = '2026-08-01';

if (!DATABASE_URL) {
    console.error('❌ Uso: node cleanup-db.js "postgresql://user:pass@host/dbname"');
    console.error('   Cole a DATABASE_URL (External URL) do painel do Render.');
    process.exit(1);
}

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    const client = await pool.connect();
    
    try {
        // 1. Verificar tamanho do banco
        console.log('\n📊 Verificando tamanho do banco de dados...');
        const sizeRes = await client.query(`
            SELECT pg_size_pretty(pg_database_size(current_database())) as db_size,
                   pg_database_size(current_database()) as db_size_bytes
        `);
        console.log(`   Tamanho atual: ${sizeRes.rows[0].db_size}`);

        // 2. Contar agendamentos
        const countOld = await client.query(
            'SELECT COUNT(*) as total FROM appointments WHERE date < $1', [CUTOFF_DATE]
        );
        const countKeep = await client.query(
            'SELECT COUNT(*) as total FROM appointments WHERE date >= $1', [CUTOFF_DATE]
        );
        
        console.log(`\n📋 Agendamentos encontrados:`);
        console.log(`   🗑️  Para excluir (antes de ${CUTOFF_DATE}): ${countOld.rows[0].total}`);
        console.log(`   ✅ Para manter (a partir de ${CUTOFF_DATE}): ${countKeep.rows[0].total}`);

        if (parseInt(countOld.rows[0].total) === 0) {
            console.log('\n✅ Nenhum agendamento antigo para excluir!');
            
            // Check other tables sizes
            console.log('\n📊 Verificando tamanho de todas as tabelas...');
            const tablesRes = await client.query(`
                SELECT relname as table_name, 
                       pg_size_pretty(pg_total_relation_size(relid)) as total_size,
                       pg_total_relation_size(relid) as size_bytes,
                       n_live_tup as row_count
                FROM pg_stat_user_tables 
                ORDER BY pg_total_relation_size(relid) DESC
            `);
            tablesRes.rows.forEach(t => {
                console.log(`   ${t.table_name}: ${t.total_size} (${t.row_count} linhas)`);
            });
            
            client.release();
            await pool.end();
            return;
        }

        // 3. Exportar como CSV
        console.log('\n📥 Exportando agendamentos antigos para CSV...');
        const exportRes = await client.query(
            'SELECT * FROM appointments WHERE date < $1 ORDER BY date ASC, time_start ASC',
            [CUTOFF_DATE]
        );

        const headers = ['id','professional_name','client','phone','service_name','service_price','date','time_start','time_end','status','created_by','created_at'];
        let csv = headers.join(';') + '\n';
        
        exportRes.rows.forEach(row => {
            const line = headers.map(h => {
                let val = row[h] !== null && row[h] !== undefined ? String(row[h]) : '';
                val = val.replace(/;/g, ',').replace(/\n/g, ' ').replace(/\r/g, '');
                return val;
            }).join(';');
            csv += line + '\n';
        });

        const csvPath = path.join(__dirname, '..', `backup_agendamentos_antes_${CUTOFF_DATE}.csv`);
        fs.writeFileSync(csvPath, '\uFEFF' + csv, 'utf8');
        console.log(`   ✅ Backup salvo em: ${csvPath}`);
        console.log(`   📝 Total de registros exportados: ${exportRes.rows.length}`);

        // 4. Excluir agendamentos antigos
        console.log(`\n🗑️  Excluindo ${countOld.rows[0].total} agendamentos antigos...`);
        const deleteRes = await client.query(
            'DELETE FROM appointments WHERE date < $1',
            [CUTOFF_DATE]
        );
        console.log(`   ✅ ${deleteRes.rowCount} agendamentos excluídos!`);

        // 5. VACUUM para liberar espaço
        console.log('\n🧹 Liberando espaço no banco (VACUUM)...');
        await client.query('VACUUM FULL');
        console.log('   ✅ Espaço liberado!');

        // 6. Verificar tamanho final
        const sizeAfter = await client.query(`
            SELECT pg_size_pretty(pg_database_size(current_database())) as db_size
        `);
        console.log(`\n📊 Tamanho do banco DEPOIS da limpeza: ${sizeAfter.rows[0].db_size}`);
        console.log(`   (Antes era: ${sizeRes.rows[0].db_size})`);

        const remainCount = await client.query('SELECT COUNT(*) as total FROM appointments');
        console.log(`\n✅ Agendamentos restantes no banco: ${remainCount.rows[0].total}`);
        console.log('🎉 Limpeza concluída com sucesso!');

    } catch (err) {
        console.error('❌ Erro:', err.message);
    } finally {
        client.release();
        await pool.end();
    }
}

run();
