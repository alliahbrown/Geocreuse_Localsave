const { app } = require('electron');
const path = require('path');

// EN PREMIER — avant tout autre require
if (app.isPackaged) {
    require('dotenv').config({ path: path.join(process.resourcesPath, '.env') });
} else {
    require('dotenv').config();
}

console.log('API_SECRET_KEY chargée :', process.env.API_SECRET_KEY ? 'OUI' : 'NON/undefined');

// APRÈS seulement
const { BrowserWindow, ipcMain, dialog } = require('electron');
const fs = require('fs');
const db = require('./db');
const sync = require('./sync');

// ... reste inchangé
let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });
    mainWindow.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(async () => {
    await db.init();
    createWindow();

    mainWindow.webContents.once('did-finish-load', async () => {
        try {
            const counts = await sync.pull();
            console.log('counts retourné :', JSON.stringify(counts));
            mainWindow.webContents.send('auto-sync-done', { success: true, counts });
        } catch (e) {
            console.log('Sync échouée :', e.message, e.stack);
            mainWindow.webContents.send('auto-sync-done', { success: false, error: e.message });
        }
    });
});

// ── Handlers IPC ─────────────────────────────────────────────────

ipcMain.handle('get-results', async () => await db.getResults());
ipcMain.handle('get-athletes', async () => await db.getAthletes());
ipcMain.handle('get-segments-stages', async () => await db.getSegmentsStages());

ipcMain.handle('sync', async () => {
    try {
        const counts = await sync.pull();
        return { success: true, counts };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

// Export CSV
ipcMain.handle('export-csv', async () => {
    const rows = await db.getResults();

    if (!rows.length) {
        return { success: false, error: 'Aucune donnée à exporter' };
    }

    const { filePath } = await dialog.showSaveDialog({
        title: 'Exporter CSV',
        defaultPath: 'results.csv'
    });

    if (!filePath) return { success: false };

    const cols = Object.keys(rows[0]);
    const content = [
        cols.join(','),
        ...rows.map(r => cols.map(c => r[c] ?? '').join(','))
    ].join('\n');

    fs.writeFileSync(filePath, content);
    return { success: true, filePath };
});
// Export JSON
ipcMain.handle('export-json', async () => {
    const rows = db.getResults();
    if (rows.length === 0) return { success: false, error: 'Aucune donnée à exporter' };

    const { filePath } = await dialog.showSaveDialog({
        title: 'Exporter en JSON',
        defaultPath: 'geocreuse-resultats.json',
        filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (!filePath) return { success: false, error: 'Annulé' };

    fs.writeFileSync(filePath, JSON.stringify(rows, null, 2), 'utf-8');
    return { success: true, filePath };
});

// Auto-save
ipcMain.handle('autosave-pick-and-start', async (_, { format }) => {
    const ext = format === 'csv' ? 'csv' : 'json';
    const { filePath } = await dialog.showSaveDialog({
        title: 'Choisir le fichier de sauvegarde automatique',
        defaultPath: `geocreuse-autosave.${ext}`,
        filters: [{ name: ext.toUpperCase(), extensions: [ext] }],
    });
    if (!filePath) return { success: false, error: 'Annulé' };
    return { success: true, filePath };
});

ipcMain.handle('autosave-now', async (_, { filePath, format }) => {
    const rows = db.getResults();
    if (rows.length === 0) return { success: false, error: 'Aucune donnée' };

    if (format === 'csv') {
        const cols = Object.keys(rows[0]);
        const header = cols.join(',');
        const lines = rows.map(r => cols.map(c => r[c] ?? '').join(','));
        fs.writeFileSync(filePath, [header, ...lines].join('\n'), 'utf-8');
    } else {
        fs.writeFileSync(filePath, JSON.stringify(rows, null, 2), 'utf-8');
    }
    return { success: true, filePath };
});


ipcMain.handle('clear-table', async (_, table) => {
    try {
        db.clearTable(table);
        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

ipcMain.handle('clear-all', async () => {
    try {
        db.clearAll();
        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
});