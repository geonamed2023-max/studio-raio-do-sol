const db = require('./db');

async function main() {
    try {
        const res = await db.query("SELECT id, client, service_name, time_start, time_end, is_mutual, professional_id, professional_id2 FROM appointments WHERE status != 'Cancelado' ORDER BY date DESC, time_start ASC");
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await db.pool.end();
    }
}

main();
