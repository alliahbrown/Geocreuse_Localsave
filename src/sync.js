const { net } = require('electron');
const db = require('./db');

// ── CONFIGURATION ─────────────────────────────────────────────────
// URL de base de l'API et clé secrète chargée depuis les variables d'environnement
const API_URL = 'https://sauvegarde.leptitbraquet.fr';

function getApiKey() {
    return process.env.API_SECRET_KEY;
}

// ── REQUÊTES ──────────────────────────────────────────────────────
// Effectue un GET sur l'API avec la clé secrète et retourne le JSON
async function fetchJson(path) {
    const res = await fetch(`${API_URL}${path}`, {
        headers: { 'x-api-key': getApiKey() }
    });
    if (!res.ok) throw new Error(`Erreur API ${path} : ${res.status}`);
    return res.json();
}

console.log(getApiKey());

// ── STATUT RÉSEAU ─────────────────────────────────────────────────
// Vérifie la connectivité via l'API Electron
function isOnline() {
    return net.isOnline();
}

// ── SYNCHRONISATION ───────────────────────────────────────────────
// Récupère athlètes, segments et résultats depuis l'API en parallèle
// puis les insère ou met à jour dans la DB locale
async function pull() {
    if (!isOnline()) throw new Error('Hors ligne');
    try {
        const [athletes, segments, results] = await Promise.all([
            fetchJson('/athletes'),
            fetchJson('/segments-stages'),
            fetchJson('/results'),
        ]);

        console.log('Premier athlete reçu :', JSON.stringify(athletes[0]));
        console.log('Clés athlete :', Object.keys(athletes[0]));

        db.upsertAthletes(athletes);
        db.upsertSegmentsStages(segments);
        db.upsertResults(results);

        // Retourne le nombre d'entrées reçues pour chaque table
        return { athletes: athletes.length, segments: segments.length, results: results.length };
    } catch (e) {
        console.error('Erreur pull :', e);
        throw e;
    }
}

// ── EXPORTS ───────────────────────────────────────────────────────
module.exports = { pull, isOnline };