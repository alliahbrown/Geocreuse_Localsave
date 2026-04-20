const path = require('path');
const fs = require('fs');
const { app } = require('electron');

const DB_PATH = path.join(app.getPath('userData'), 'geocreuse.db');

let db;
let SQL;

async function init() {
    const initSqlJs = require('sql.js');
    SQL = await initSqlJs();

    // Charge la DB existante ou en crée une nouvelle
    if (fs.existsSync(DB_PATH)) {
        const fileBuffer = fs.readFileSync(DB_PATH);
        db = new SQL.Database(fileBuffer);
    } else {
        db = new SQL.Database();
    }

    db.run(`
    CREATE TABLE IF NOT EXISTS results (
      athlete_id      INTEGER PRIMARY KEY,
      nom             TEXT,
      prenom          TEXT,
      sexe            TEXT,
      age             INTEGER,
      equipe          INTEGER,
      peloton         INTEGER,
      distance_totale REAL,
      synced_at       TEXT DEFAULT (datetime('now'))
    );
  `);

    save(); // sauvegarde initiale sur disque
    console.log('SQLite initialisé :', DB_PATH);
}

// Persiste la DB en mémoire vers le fichier disque
function save() {
    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function getResults() {
    const stmt = db.prepare('SELECT * FROM results ORDER BY distance_totale DESC');
    const rows = [];
    while (stmt.step()) {
        rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
}
function upsertResult(r) {
    db.run(`
    INSERT INTO results
      (athlete_id, nom, prenom, sexe, age, equipe, peloton, distance_totale)
    VALUES
      (:athlete_id, :nom, :prenom, :sexe, :age, :equipe, :peloton, :distance_totale)
    ON CONFLICT(athlete_id) DO UPDATE SET
      nom             = excluded.nom,
      prenom          = excluded.prenom,
      sexe            = excluded.sexe,
      age             = excluded.age,
      equipe          = excluded.equipe,
      peloton         = excluded.peloton,
      distance_totale = excluded.distance_totale,
      synced_at       = datetime('now')
  `, {
        ':athlete_id': r.athlete_id,
        ':nom': r.nom,
        ':prenom': r.prenom,
        ':sexe': r.sexe,
        ':age': r.age,
        ':equipe': r.equipe,
        ':peloton': r.peloton,
        ':distance_totale': r.distance_totale,
    });
}
function upsertMany(rows) {
    for (const r of rows) upsertResult(r);
    save(); // une seule écriture disque après tout le batch
}

module.exports = { init, getResults, upsertResult, upsertMany, save };