const { contextBridge, ipcRenderer } = require('electron');

// ── PONT RENDERER ↔ MAIN ──────────────────────────────────────────
// Expose une API sécurisée au renderer via contextBridge
// Chaque méthode appelle le handler IPC correspondant dans main.js
contextBridge.exposeInMainWorld('api', {

    // ── LECTURE ───────────────────────────────────────────────────
    // Récupère les données locales depuis la DB
    getResults: () => ipcRenderer.invoke('get-results'),
    getAthletes: () => ipcRenderer.invoke('get-athletes'),
    getSegmentsStages: () => ipcRenderer.invoke('get-segments-stages'),

    // ── SYNCHRONISATION ───────────────────────────────────────────
    // Déclenche une synchro manuelle avec le serveur
    sync: () => ipcRenderer.invoke('sync'),

    // ── EXPORT ────────────────────────────────────────────────────
    // Exporte les résultats en CSV ou JSON
    exportCsv: () => ipcRenderer.invoke('export-csv'),
    exportJson: () => ipcRenderer.invoke('export-json'),

    // ── SAUVEGARDE AUTOMATIQUE ────────────────────────────────────
    // Choisit le fichier cible puis écrit les données à intervalle régulier
    autosavePickAndStart: (opts) => ipcRenderer.invoke('autosave-pick-and-start', opts),
    autosaveNow: (opts) => ipcRenderer.invoke('autosave-now', opts),

    // ── ÉVÉNEMENTS ────────────────────────────────────────────────
    // Écoute la synchro automatique au démarrage et appelle le callback avec le résultat
    onAutoSync: (cb) => ipcRenderer.on('auto-sync-done', (_, data) => cb(data)),

    // ── SUPPRESSION ───────────────────────────────────────────────
    // Vide une table spécifique ou toutes les tables
    clearTable: (table) => ipcRenderer.invoke('clear-table', table),
    clearAll: () => ipcRenderer.invoke('clear-all'),
});