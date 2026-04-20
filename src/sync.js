
const db = require('./db');

const API_URL = 'https://sauvegarde.leptitbraquet.fr';



async function pull() {
    const res = await fetch(`${API_URL}/results`, {
        headers: { 'x-api-key': process.env.API_SECRET_KEY }
    });
    if (!res.ok) {
        const body = await res.text();
        throw new Error(`Erreur API : ${res.status} — ${body}`);
    }
    const rows = await res.json();
    db.upsertMany(rows);
    console.log(`Sync : ${rows.length} résultats importés`);
    return rows.length;
}

module.exports = { pull };