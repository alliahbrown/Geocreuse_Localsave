// ── ÉLÉMENTS ──────────────────────────────────
// Références aux éléments du DOM utilisés dans tout le fichier
const btnSync = document.getElementById('btn-sync');
const message = document.getElementById('message');
const statusEl = document.getElementById('status');

const tbodyResults = document.getElementById('tbody-results');
const theadResults = document.getElementById('thead-results');
const countResults = document.getElementById('count-results');

const tbodyAthletes = document.getElementById('tbody-athletes');
const countAthletes = document.getElementById('count-athletes');

const tbodySegments = document.getElementById('tbody-segments');
const countSegments = document.getElementById('count-segments');

// ── STATUT RÉSEAU ─────────────────────────────

// Vérifie la connectivité réelle en tentant un fetch sur Google
async function checkRealConnectivity() {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        await fetch('https://www.google.com/favicon.ico', {
            method: 'HEAD', mode: 'no-cors', signal: controller.signal,
        });
        clearTimeout(timeout);
        return true;
    } catch {
        return false;
    }
}

// Met à jour l'indicateur en ligne/hors ligne et désactive le bouton sync si hors ligne
async function updateOnlineStatus() {
    const isOnline = await checkRealConnectivity();
    statusEl.textContent = isOnline ? '🟢 En ligne' : '🔴 Hors ligne';
    statusEl.className = isOnline ? 'online' : 'offline';
    btnSync.disabled = !isOnline;
}

// Vérifie le statut toutes les 10 secondes
setInterval(updateOnlineStatus, 10000);
updateOnlineStatus();

// ── RENDU DES TABLEAUX ────────────────────────

// Génère le tableau des résultats avec des colonnes dynamiques (sans synced_at)
function renderResults(rows) {
    countResults.textContent = `${rows.length} résultats`;

    if (!rows || rows.length === 0) {
        theadResults.innerHTML = '';
        tbodyResults.innerHTML = `<tr><td style="color:var(--muted);padding:1rem">Aucune donnée</td></tr>`;
        return;
    }

    const cols = Object.keys(rows[0]).filter(c => c !== 'synced_at');
    theadResults.innerHTML = '<tr>' + cols.map(c => `<th>${c}</th>`).join('') + '</tr>';
    tbodyResults.innerHTML = rows.map(r =>
        '<tr>' + cols.map(c => `<td>${r[c] ?? '—'}</td>`).join('') + '</tr>'
    ).join('');
}

// Génère le tableau des athlètes (tokens tronqués, date d'expiration formatée)
function renderAthletes(rows) {
    countAthletes.textContent = `${rows.length} athlètes`;
    tbodyAthletes.innerHTML = rows.length === 0
        ? '<tr><td colspan="6" style="color:var(--muted);padding:1rem">Aucune donnée</td></tr>'
        : rows.map(a => `
            <tr>
                <td>${a.athlete_id ?? '—'}</td>
                <td>${a.firstname ?? '—'}</td>
                <td>${a.lastname ?? '—'}</td>
                <td style="font-size:0.75rem;max-width:150px;overflow:hidden;text-overflow:ellipsis">${a.athlete_access_token ?? '—'}</td>
                <td style="font-size:0.75rem;max-width:150px;overflow:hidden;text-overflow:ellipsis">${a.athlete_refresh_token ?? '—'}</td>
                <td>${a.athlete_token_expires_at ? new Date(a.athlete_token_expires_at * 1000).toLocaleString('fr-FR') : '—'}</td>
            </tr>`).join('');
}

// Génère le tableau des segments avec toutes leurs colonnes géographiques
function renderSegments(rows) {
    countSegments.textContent = `${rows.length} segments`;
    tbodySegments.innerHTML = rows.length === 0
        ? '<tr><td colspan="12" style="color:var(--muted);padding:1rem">Aucune donnée</td></tr>'
        : rows.map(s => `
            <tr>
                <td>${s.etape ?? '—'}</td>
                <td>${s.date_etape ?? '—'}</td>
                <td>${s.segment ?? '—'}</td>
                <td>${s.id_segment ?? '—'}</td>
                <td>${s.nom ?? '—'}</td>
                <td>${s.type ?? '—'}</td>
                <td>${s.sous_type ?? '—'}</td>
                <td>${s.categorie ?? '—'}</td>
                <td>${s.start_lat ?? '—'}</td>
                <td>${s.start_lng ?? '—'}</td>
                <td>${s.end_lat ?? '—'}</td>
                <td>${s.end_lng ?? '—'}</td>
            </tr>`).join('');
}

// ── CHARGEMENT ────────────────────────────────
// Récupère les trois tables en parallèle et rafraîchit l'affichage
async function loadAll() {
    const [results, athletes, segments] = await Promise.all([
        window.api.getResults(),
        window.api.getAthletes(),
        window.api.getSegmentsStages(),
    ]);
    renderResults(results);
    renderAthletes(athletes);
    renderSegments(segments);
}

// ── SYNC MANUELLE ─────────────────────────────
// Déclenche une synchro au clic et rafraîchit les tableaux si succès
btnSync.addEventListener('click', async () => {
    btnSync.disabled = true;
    message.textContent = 'Synchronisation...';
    message.className = '';

    const result = await window.api.sync();

    if (result.success) {
        const c = result.counts;
        message.textContent = `Sync : ${c.athletes} athlètes, ${c.segments} segments, ${c.results} résultats`;
        message.className = 'success';
        await loadAll();
    } else {
        message.textContent = `${result.error}`;
        message.className = 'error';
    }

    setTimeout(() => { message.textContent = ''; message.className = ''; }, 5000);
    btnSync.disabled = false;
});

// ── SYNC AUTO AU DÉMARRAGE ────────────────────
// Reçoit le résultat de la synchro lancée par main.js et met à jour l'affichage
window.api.onAutoSync(async (result) => {
    if (result.success) {
        const c = result.counts;
        message.textContent = `Sync auto : ${c.athletes} athlètes, ${c.segments} segments, ${c.results} résultats`;
        message.className = 'success';
        await loadAll();
    } else {
        message.textContent = `Sync auto ignorée : ${result.error}`;
    }
    setTimeout(() => { message.textContent = ''; message.className = ''; }, 5000);
});

// ── ONGLETS ───────────────────────────────────
// Active l'onglet cliqué et masque les autres
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
    });
});

// ── EXPORT ────────────────────────────────────
// Exporte les résultats en CSV et affiche le chemin du fichier créé
document.getElementById('btn-export-csv').addEventListener('click', async () => {
    const result = await window.api.exportCsv();
    message.textContent = result.success ? `CSV exporté : ${result.filePath}` : `${result.error}`;
    message.className = result.success ? 'success' : 'error';
    setTimeout(() => { message.textContent = ''; message.className = ''; }, 4000);
});

// Exporte les résultats en JSON et affiche le chemin du fichier créé
document.getElementById('btn-export-json').addEventListener('click', async () => {
    const result = await window.api.exportJson();
    message.textContent = result.success ? `JSON exporté : ${result.filePath}` : `${result.error}`;
    message.className = result.success ? 'success' : 'error';
    setTimeout(() => { message.textContent = ''; message.className = ''; }, 4000);
});

// ── SAUVEGARDE AUTOMATIQUE ────────────────────
// Stocke l'intervalle, le chemin et le format choisis pour l'autosave
let autosaveInterval = null;
let autosavePath = null;
let autosaveFormat = null;

// Démarre l'autosave : choisit le fichier, lance une première sauvegarde immédiate
// puis synchro + sauvegarde à chaque intervalle avec un compte à rebours affiché
document.getElementById('btn-start-autosave').addEventListener('click', async () => {

    const format = document.getElementById('autosave-format').value;
    const freqMs = parseInt(document.getElementById('autosave-frequency').value) * 1000;

    const pick = await window.api.autosavePickAndStart({ format });
    if (!pick.success) return;

    autosavePath = pick.filePath;
    autosaveFormat = format;

    document.getElementById('btn-start-autosave').disabled = true;
    document.getElementById('btn-stop-autosave').disabled = false;

    let remaining = freqMs / 1000;

    await window.api.autosaveNow({ filePath: autosavePath, format: autosaveFormat });
    countdownInterval = setInterval(() => {
        document.getElementById('autosave-status').textContent =
            `Prochaine sauvegarde dans ${remaining}s`;
        remaining--;

        if (remaining < 0) remaining = freqMs / 1000;
    }, 1000);
    autosaveInterval = setInterval(async () => {

        const syncRes = await window.api.sync();
        if (syncRes.success) {
            await loadAll();
        }

        const res = await window.api.autosaveNow({ filePath: autosavePath, format: autosaveFormat });

        if (!res.success) {
            document.getElementById('autosave-status').textContent = `Échec`;
        }
        // Reset du compteur après chaque sauvegarde
        remaining = freqMs / 1000;
    }, freqMs);
});

// Arrête les deux intervalles et réinitialise les boutons
document.getElementById('btn-stop-autosave').addEventListener('click', () => {
    clearInterval(autosaveInterval);
    clearInterval(countdownInterval);

    autosaveInterval = null;
    countdownInterval = null;

    document.getElementById('btn-start-autosave').disabled = false;
    document.getElementById('btn-stop-autosave').disabled = true;
    document.getElementById('autosave-status').textContent = 'Sauvegarde automatique arrêtée';
});

// ── SUPPRESSION ───────────────────────────────

// Efface toutes les tables après confirmation et rafraîchit l'affichage
document.getElementById('btn-clear-all').addEventListener('click', async () => {
    if (!confirm('Effacer toutes les données ? Cette action est irréversible.')) return;
    const res = await window.api.clearAll();
    message.textContent = res.success ? 'Toutes les données effacées.' : res.error;
    message.className = res.success ? 'success' : 'error';
    if (res.success) await loadAll();
    setTimeout(() => { message.textContent = ''; message.className = ''; }, 4000);
});

// Efface la table sélectionnée après confirmation et rafraîchit l'affichage
document.getElementById('btn-clear-table').addEventListener('click', async () => {
    const table = document.getElementById('select-clear-table').value;
    if (!table) { message.textContent = 'Sélectionne une table.'; message.className = 'error'; return; }
    if (!confirm(`Effacer la table "${table}" ? Cette action est irréversible.`)) return;
    const res = await window.api.clearTable(table);
    message.textContent = res.success ? `Table "${table}" effacée.` : res.error;
    message.className = res.success ? 'success' : 'error';
    if (res.success) await loadAll();
    setTimeout(() => { message.textContent = ''; message.className = ''; }, 4000);
});

// ── INIT ──────────────────────────────────────
// Charge toutes les données au démarrage de la page
loadAll();