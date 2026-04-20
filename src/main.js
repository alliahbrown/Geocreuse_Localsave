require('dotenv').config();

console.log('API_SECRET_KEY chargée :', process.env.API_SECRET_KEY ? 'OUI' : 'NON/undefined');
const { app, BrowserWindow, ipcMain } = require('electron');

const db = require('./db');
const sync = require('./sync');
const { dialog } = require('electron');
const fs = require('fs');

const path = require('path');

if (app.isPackaged) {
    require('dotenv').config({ path: path.join(process.resourcesPath, '.env') });
} else {
    require('dotenv').config({ path: path.join(__dirname, '../.env') });
}
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
    sync.pull().catch((e) => console.log('Sync échouée :', e.message, e));
});

ipcMain.handle('get-results', () => {
    return db.getResults();
});



ipcMain.handle('sync', async () => {
    try {
        const count = await sync.pull();
        return { success: true, count };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

// Export CSV
ipcMain.handle('export-csv', async () => {
    const rows = db.getResults();
    if (rows.length === 0) return { success: false, error: 'Aucune donnée à exporter' };

    const { filePath } = await dialog.showSaveDialog({
        title: 'Exporter en CSV',
        defaultPath: 'geocreuse-resultats.csv',
        filters: [{ name: 'CSV', extensions: ['csv'] }],
    });

    if (!filePath) return { success: false, error: 'Annulé' };

    const header = 'athlete_id,nom,prenom,sexe,age,equipe,peloton,distance_totale';
    const lines = rows.map(r =>
        [r.athlete_id, r.nom, r.prenom, r.sexe, r.age,
        r.equipe, r.peloton, r.distance_totale].join(',')
    );

    fs.writeFileSync(filePath, [header, ...lines].join('\n'), 'utf-8');
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


// Auto-save handler
ipcMain.handle('autosave-pick-and-start', async (_, { format, intervalMs }) => {
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
        const header = 'athlete_id,nom,prenom,sexe,age,equipe,peloton,distance_totale';
        const lines = rows.map(r =>
            [r.athlete_id, r.nom, r.prenom, r.sexe, r.age,
            r.equipe, r.peloton, r.distance_totale].join(',')
        );
        fs.writeFileSync(filePath, [header, ...lines].join('\n'), 'utf-8');
    } else {
        fs.writeFileSync(filePath, JSON.stringify(rows, null, 2), 'utf-8');
    }

    return { success: true, filePath };
});