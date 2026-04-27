const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    getResults: () => ipcRenderer.invoke('get-results'),
    getAthletes: () => ipcRenderer.invoke('get-athletes'),
    getSegmentsStages: () => ipcRenderer.invoke('get-segments-stages'),
    sync: () => ipcRenderer.invoke('sync'),
    exportCsv: () => ipcRenderer.invoke('export-csv'),
    exportJson: () => ipcRenderer.invoke('export-json'),
    onAutoSync: (cb) => ipcRenderer.on('auto-sync-done', (_, data) => cb(data)),
});