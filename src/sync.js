const { net } = require('electron');
const db = require('./db');

const API_URL = 'https://sauvegarde.leptitbraquet.fr';
// const API_KEY = process.env.API_SECRET_KEY


function getApiKey() {
    return process.env.API_SECRET_KEY;
}

async function fetchJson(path) {
    const res = await fetch(`${API_URL}${path}`, {
        headers: { 'x-api-key': getApiKey() }
    });
    if (!res.ok) throw new Error(`Erreur API ${path} : ${res.status}`);
    return res.json();
}

console.log(getApiKey())
function isOnline() {
    return net.isOnline();
}

// async function fetchJson(path) {
//     const res = await fetch(`${API_URL}${path}`, {
//         headers: { 'x-api-key': API_KEY }
//     });
//     if (!res.ok) throw new Error(`Erreur API ${path} : ${res.status}`);
//     return res.json();
// }

async function pull() {
    if (!isOnline()) throw new Error('Hors ligne');

    const [athletes, segments, results] = await Promise.all([
        fetchJson('/athletes'),
        fetchJson('/segments-stages'),
        fetchJson('/results'),
    ]);
    db.upsertAthletes(athletes);
    db.upsertSegmentsStages(segments);
    db.upsertResults(results);

    console.log(`Sync : ${athletes.length} athlètes, ${segments.length} segments, ${results.length} résultats`);
    return { athletes: athletes.length, segments: segments.length, results: results.length };
}

module.exports = { pull, isOnline };