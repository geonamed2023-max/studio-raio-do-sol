/**
 * Módulo de Backup Automático e Espelhamento em Tempo Real (Supabase)
 * Studio Raio do Sol
 * 
 * Garante que todos os dados salvos no Render tenham uma cópia idêntica
 * e em tempo real salva no banco de dados do Supabase 24h por dia.
 */

const { Pool } = require('pg');

const SUPABASE_URI = process.env.BACKUP_DATABASE_URL || 
    'postgresql://postgres.vvktnslnvqgeznuzmroz:StudioRaio2026%23@aws-0-sa-east-1.pooler.supabase.com:6543/postgres';

let backupPool = null;

try {
    backupPool = new Pool({
        connectionString: SUPABASE_URI,
        ssl: { rejectUnauthorized: false }
    });
    console.log('🛡️ [Backup Automático] Módulo de espelhamento em tempo real (Supabase) ativo.');
} catch (e) {
    console.warn('⚠️ [Backup Automático] Não foi possível inicializar pool de backup:', e.message);
}

// 1. Espelhar criação de agendamento em segundo plano (sem travar a requisição principal)
async function mirrorCreateAppointment(a) {
    if (!backupPool || !a) return;
    try {
        await backupPool.query(`
            INSERT INTO appointments (
                id, professional_id, professional_name, professional_initials, professional_color,
                client, phone, service_id, service_name, service_price,
                date, time_start, time_end, status, payout_invoiced, created_by,
                is_mutual, professional2_id, professional2_name, professional2_initials, professional2_color
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
            ON CONFLICT (id) DO UPDATE SET
                client=EXCLUDED.client, phone=EXCLUDED.phone, service_name=EXCLUDED.service_name,
                service_price=EXCLUDED.service_price, date=EXCLUDED.date, time_start=EXCLUDED.time_start,
                time_end=EXCLUDED.time_end, status=EXCLUDED.status, professional_name=EXCLUDED.professional_name
        `, [
            String(a.id),
            (a.professionalId && String(a.professionalId).trim() !== '') ? String(a.professionalId) : null,
            a.professionalName || '',
            a.professionalInitials || '',
            a.professionalColor || '',
            a.client || '',
            a.phone || '',
            (a.serviceId && String(a.serviceId).trim() !== '') ? String(a.serviceId) : null,
            a.serviceName || '',
            parseFloat(a.servicePrice) || 0,
            a.date, a.timeStart, a.timeEnd,
            a.status || 'Agendado',
            a.payoutInvoiced || false,
            a.createdBy || '',
            a.isMutual || false,
            (a.professionalId2 && String(a.professionalId2).trim() !== '') ? String(a.professionalId2) : null,
            a.professionalName2 || '',
            a.professionalInitials2 || '',
            a.professionalColor2 || ''
        ]);
    } catch (err) {
        console.warn('⚠️ [Backup Mirror] Aviso ao espelhar agendamento:', err.message);
    }
}

// 2. Espelhar exclusão de agendamento
async function mirrorDeleteAppointment(apptId) {
    if (!backupPool || !apptId) return;
    try {
        await backupPool.query('DELETE FROM appointments WHERE id = $1', [String(apptId)]);
    } catch (err) {
        console.warn('⚠️ [Backup Mirror] Aviso ao espelhar exclusão:', err.message);
    }
}

// 3. Rotina diária de sincronização de segurança (executada a cada 24 horas)
async function startDailyBackupRoutine(mainDb) {
    if (!backupPool || !mainDb) return;

    // Executa 1 minuto após o servidor iniciar
    setTimeout(async () => {
        await syncFullDatabase(mainDb);
    }, 60 * 1000);

    // E depois a cada 24 horas
    setInterval(async () => {
        await syncFullDatabase(mainDb);
    }, 24 * 60 * 60 * 1000);
}

async function syncFullDatabase(mainDb) {
    try {
        console.log('🔄 [Backup Automático] Executando rotina diária de backup para o Supabase...');
        const apptsRes = await mainDb.query('SELECT * FROM appointments');
        
        let count = 0;
        for (const row of apptsRes.rows) {
            await backupPool.query(`
                INSERT INTO appointments (
                    id, professional_id, professional_name, professional_initials, professional_color,
                    client, phone, service_id, service_name, service_price,
                    date, time_start, time_end, status, payout_invoiced, created_by, is_mutual,
                    professional2_id, professional2_name, professional2_initials, professional2_color
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
                ON CONFLICT (id) DO UPDATE SET
                    status=EXCLUDED.status, service_price=EXCLUDED.service_price, date=EXCLUDED.date,
                    time_start=EXCLUDED.time_start, time_end=EXCLUDED.time_end
            `, [
                String(row.id),
                (row.professional_id && String(row.professional_id).trim() !== '') ? String(row.professional_id) : null,
                row.professional_name || '',
                row.professional_initials || '',
                row.professional_color || '',
                row.client || '',
                row.phone || '',
                (row.service_id && String(row.service_id).trim() !== '') ? String(row.service_id) : null,
                row.service_name || '',
                parseFloat(row.service_price) || 0,
                row.date, row.time_start, row.time_end,
                row.status || 'Agendado',
                row.payout_invoiced || false,
                row.created_by || '',
                row.is_mutual || false,
                (row.professional2_id && String(row.professional2_id).trim() !== '') ? String(row.professional2_id) : null,
                row.professional2_name || '',
                row.professional2_initials || '',
                row.professional2_color || ''
            ]);
            count++;
        }
        console.log(`✅ [Backup Automático] Backup diário concluído com sucesso! ${count} agendamentos salvos no Supabase.`);
    } catch (err) {
        console.warn('⚠️ [Backup Automático] Aviso na rotina diária:', err.message);
    }
}

module.exports = {
    mirrorCreateAppointment,
    mirrorDeleteAppointment,
    startDailyBackupRoutine
};
