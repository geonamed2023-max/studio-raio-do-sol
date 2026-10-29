const fs = require('fs');
const { Pool } = require('pg');

const appts = JSON.parse(fs.readFileSync('backup_render_completo.json', 'utf8'));
const supabasePool = new Pool({
    connectionString: 'postgresql://postgres.vvktnslnvqgeznuzmroz:StudioRaio2026%23@aws-0-sa-east-1.pooler.supabase.com:6543/postgres',
    ssl: { rejectUnauthorized: false }
});

async function syncToSupabase() {
    console.log('Syncing', appts.length, 'appointments to Supabase...');
    const client = await supabasePool.connect();
    
    try {
        // Fetch valid user IDs and service IDs
        const usersRes = await client.query('SELECT id FROM users');
        const validUserIds = new Set(usersRes.rows.map(r => r.id));
        
        const servicesRes = await client.query('SELECT id FROM services');
        const validServiceIds = new Set(servicesRes.rows.map(r => r.id));

        let inserted = 0;
        for (const a of appts) {
            const profId = (a.professionalId && validUserIds.has(String(a.professionalId))) ? String(a.professionalId) : null;
            const profId2 = (a.professionalId2 && validUserIds.has(String(a.professionalId2))) ? String(a.professionalId2) : null;
            const svcId = (a.serviceId && validServiceIds.has(String(a.serviceId))) ? String(a.serviceId) : null;

            await client.query(`
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
                String(a.id),
                profId,
                a.professionalName || '',
                a.professionalInitials || '',
                a.professionalColor || '',
                a.client || '',
                a.phone || '',
                svcId,
                a.serviceName || '',
                parseFloat(a.servicePrice) || 0,
                a.date, a.timeStart, a.timeEnd,
                a.status || 'Agendado',
                a.payoutInvoiced || false,
                a.createdBy || '',
                a.isMutual || false,
                profId2,
                a.professionalName2 || '',
                a.professionalInitials2 || '',
                a.professionalColor2 || ''
            ]);
            inserted++;
        }
        console.log('SYNC COMPLETE! Total inserted/updated in Supabase:', inserted);
        process.exit(0);
    } catch(e) {
        console.error('Sync error:', e.message);
        process.exit(1);
    } finally {
        client.release();
        await supabasePool.end();
    }
}
syncToSupabase();
