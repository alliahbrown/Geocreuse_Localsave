const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    getResults: () => ipcRenderer.invoke('get-results'),
    sync: () => ipcRenderer.invoke('sync'),
    exportCsv: () => ipcRenderer.invoke('export-csv'),
    exportJson: () => ipcRenderer.invoke('export-json'),
    autosavePickAndStart: (opts) => ipcRenderer.invoke('autosave-pick-and-start', opts),
    autosaveNow: (opts) => ipcRenderer.invoke('autosave-now', opts),
});