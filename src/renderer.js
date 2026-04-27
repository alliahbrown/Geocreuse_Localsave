const btnSync = document.getElementById('btn-sync');
const tbody = document.getElementById('tbody');
const message = document.getElementById('message');
const statusEl = document.getElementById('status');
const countEl = document.getElementById('count');


// ── Détection online/offline ────────────────────────────────────
async function checkRealConnectivity() {
    try {
        // Un fetch léger vers un endpoint fiable, avec timeout court
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);

        await fetch('https://www.google.com/favicon.ico', {
            method: 'HEAD',
            mode: 'no-cors',
            signal: controller.signal,
            cache: 'no-store',
        });

        clearTimeout(timeout);
        return true;
    } catch {
        return false;
    }
}

async function updateOnlineStatus() {
    const isOnline = await checkRealConnectivity();

    if (isOnline) {
        statusEl.textContent = '🟢 En ligne';
        statusEl.className = 'online';
        btnSync.disabled = false;
    } else {
        statusEl.textContent = '🔴 Hors ligne';
        statusEl.className = 'offline';
        btnSync.disabled = true;
    }
}

// Garder les events natifs comme déclencheurs, mais vérifier vraiment
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);

// Vérification périodique (toutes les 10s)
setInterval(updateOnlineStatus, 10_000);

updateOnlineStatus();
// ── Affichage des données ───────────────────────────────────────
function formatTemps(secondes) {
    if (!secondes) return '—';
    const h = Math.floor(secondes / 3600);
    const m = Math.floor((secondes % 3600) / 60);
    const s = secondes % 60;
    return `${h}h${String(m).padStart(2, '0')}m${String(s).padStart(2, '0')}s`;
}

function renderResults(rows) {
    tbody.innerHTML = '';
    countEl.textContent = `${rows.length} athlète(s) en base locale`;

    if (rows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:#aaa">Aucune donnée — cliquez sur Synchroniser</td></tr>';
        return;
    }

    for (const r of rows) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
      <td>${r.athlete_id ?? '—'}</td>
      <td>${r.nom ?? '—'}</td>
      <td>${r.prenom ?? '—'}</td>
      <td>${r.sexe ?? '—'}</td>
      <td>${r.age ?? '—'}</td>
      <td>${r.equipe ?? '—'}</td>
      <td>${r.peloton ?? '—'}</td>
      <td>${r.distance_totale != null ? r.distance_totale.toFixed(2) : '—'}</td>
    `;
        tbody.appendChild(tr);
    }
}

// ── Chargement initial depuis SQLite local ──────────────────────
async function loadLocal() {
    console.log("LOAD");
    const rows = await window.api.getResults();
    console.log("rows :", rows);
    renderResults(rows);
}

// ── Synchronisation ─────────────────────────────────────────────
btnSync.addEventListener('click', async () => {
    btnSync.disabled = true;
    message.textContent = 'Synchronisation en cours...';
    const result = await window.api.sync();
    if (result.success) {
        const c = result.counts;
        message.textContent = `Sync : ${c.athletes} athlètes, ${c.segments} segments, ${c.results} résultats`;
        message.className = 'success';
        await loadAll();

    } else {
        message.textContent = ` Erreur : ${result.error}`;
    }

    btnSync.disabled = !navigator.onLine; // ← débloque si online
    setTimeout(() => { message.textContent = ''; }, 4000);
});

// ── Démarrage ───────────────────────────────────────────────────
loadLocal();


// ── Export ──────────────────────────────────────────────────────
document.getElementById('btn-export-csv').addEventListener('click', async () => {
    const result = await window.api.exportCsv();
    if (result.success) {
        message.textContent = `CSV exporté : ${result.filePath}`;
    } else {
        message.textContent = `${result.error}`;
    }
    setTimeout(() => { message.textContent = ''; }, 4000);
});

document.getElementById('btn-export-json').addEventListener('click', async () => {
    const result = await window.api.exportJson();
    if (result.success) {
        message.textContent = `JSON exporté : ${result.filePath}`;
    } else {
        message.textContent = `${result.error}`;
    }
    setTimeout(() => { message.textContent = ''; }, 4000);
});


// ── Auto-save ────────────────────────────────────────────────────
let autosaveInterval = null;
let autosaveFilePath = null;
let autosaveFormat = null;
let countdown = 0;
let countdownInterval = null;

const btnStartAutosave = document.getElementById('btn-start-autosave');
const btnStopAutosave = document.getElementById('btn-stop-autosave');
const autosaveStatus = document.getElementById('autosave-status');
const selectFormat = document.getElementById('autosave-format');
const selectFrequency = document.getElementById('autosave-frequency');

async function doAutosave() {
    const result = await window.api.autosaveNow({ filePath: autosaveFilePath, format: autosaveFormat });
    const now = new Date().toLocaleTimeString();
    if (result.success) {
        autosaveStatus.textContent = `Dernière sauvegarde : ${now} → ${autosaveFilePath}`;
    } else {
        autosaveStatus.textContent = `Erreur : ${result.error}`;
    }
}

function startCountdown(seconds) {
    clearInterval(countdownInterval);
    countdown = seconds;
    countdownInterval = setInterval(() => {
        countdown--;
        const mins = Math.floor(countdown / 60);
        const secs = countdown % 60;
        const label = mins > 0 ? `${mins}m${String(secs).padStart(2, '0')}s` : `${secs}s`;
        autosaveStatus.textContent = `Prochaine sauvegarde dans ${label}…`;
        if (countdown <= 0) countdown = parseInt(selectFrequency.value);
    }, 1000);
}

btnStartAutosave.addEventListener('click', async () => {
    const format = selectFormat.value;
    const intervalSec = parseInt(selectFrequency.value);

    const pick = await window.api.autosavePickAndStart({ format, intervalMs: intervalSec * 1000 });
    if (!pick.success) return;

    autosaveFilePath = pick.filePath;
    autosaveFormat = format;

    // Save immediately then schedule
    await doAutosave();
    startCountdown(intervalSec);

    autosaveInterval = setInterval(async () => {
        await doAutosave();
        startCountdown(intervalSec);
    }, intervalSec * 1000);

    btnStartAutosave.disabled = true;
    btnStopAutosave.disabled = false;
    selectFormat.disabled = true;
    selectFrequency.disabled = true;
});

btnStopAutosave.addEventListener('click', () => {
    clearInterval(autosaveInterval);
    clearInterval(countdownInterval);
    autosaveInterval = null;
    autosaveStatus.textContent = 'Sauvegarde automatique arrêtée.';
    btnStartAutosave.disabled = false;
    btnStopAutosave.disabled = true;
    selectFormat.disabled = false;
    selectFrequency.disabled = false;
});