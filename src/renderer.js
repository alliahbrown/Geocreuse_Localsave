// ── ELEMENTS ─────────────────────────────────
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

// ── ONLINE STATUS ─────────────────────────────
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

async function updateOnlineStatus() {
    const isOnline = await checkRealConnectivity();
    statusEl.textContent = isOnline ? '🟢 En ligne' : '🔴 Hors ligne';
    statusEl.className = isOnline ? 'online' : 'offline';
    btnSync.disabled = !isOnline;
}

setInterval(updateOnlineStatus, 10000);
updateOnlineStatus();

// ── RENDER RESULTS (colonnes dynamiques) ──────
function renderResults(rows) {
    countResults.textContent = `${rows.length} résultats`;

    if (!rows || rows.length === 0) {
        theadResults.innerHTML = '';
        tbodyResults.innerHTML = `<tr><td style="color:var(--muted);padding:1rem">Aucune donnée</td></tr>`;
        return;
    }

    // Génère les titres de colonnes automatiquement (sans synced_at)
    const cols = Object.keys(rows[0]).filter(c => c !== 'synced_at');
    theadResults.innerHTML = '<tr>' + cols.map(c => `<th>${c}</th>`).join('') + '</tr>';
    tbodyResults.innerHTML = rows.map(r =>
        '<tr>' + cols.map(c => `<td>${r[c] ?? '—'}</td>`).join('') + '</tr>'
    ).join('');
}
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
// ── LOADERS ───────────────────────────────────
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

// ── SYNC manuelle ─────────────────────────────
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

// ── SYNC auto au démarrage ────────────────────
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

// ── TABS ──────────────────────────────────────
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
    });
});

// ── EXPORT ────────────────────────────────────
document.getElementById('btn-export-csv').addEventListener('click', async () => {
    const result = await window.api.exportCsv();
    message.textContent = result.success ? `CSV exporté : ${result.filePath}` : `${result.error}`;
    message.className = result.success ? 'success' : 'error';
    setTimeout(() => { message.textContent = ''; message.className = ''; }, 4000);
});

document.getElementById('btn-export-json').addEventListener('click', async () => {
    const result = await window.api.exportJson();
    message.textContent = result.success ? `JSON exporté : ${result.filePath}` : `${result.error}`;
    message.className = result.success ? 'success' : 'error';
    setTimeout(() => { message.textContent = ''; message.className = ''; }, 4000);
});

// ── AUTO-SAUVEGARDE ───────────────────────────
let autosaveInterval = null;
let autosavePath = null;
let autosaveFormat = null;

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
        // reset du compteur après chaque sauvegarde
        remaining = freqMs / 1000;
    }, freqMs);
});

document.getElementById('btn-stop-autosave').addEventListener('click', () => {
    clearInterval(autosaveInterval);
    clearInterval(countdownInterval);

    autosaveInterval = null;
    countdownInterval = null;

    document.getElementById('btn-start-autosave').disabled = false;
    document.getElementById('btn-stop-autosave').disabled = true;
    document.getElementById('autosave-status').textContent = 'Sauvegarde automatique arrêtée';
});
// ── INIT ──────────────────────────────────────
loadAll();