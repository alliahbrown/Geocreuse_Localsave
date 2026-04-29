const path = require('path');
const fs = require('fs');
const { app } = require('electron');
const initSqlJs = require('sql.js'); // ← déplacer ici

const DB_PATH = path.join(app.getPath('userData'), 'geocreuse.db');

let db;
let SQL;

async function init() {
    SQL = await initSqlJs({
        locateFile: file => {
            if (app.isPackaged) {
                return path.join(process.resourcesPath, file);
            }
            // En développement
            return path.join(__dirname, '../node_modules/sql.js/dist', file);
        }
    });

    if (fs.existsSync(DB_PATH)) {
        const fileBuffer = fs.readFileSync(DB_PATH);
        db = new SQL.Database(fileBuffer);
    } else {
        db = new SQL.Database();
    }

    // Ajout des nouvelles tables 
    db.run(`
    CREATE TABLE IF NOT EXISTS athletes (
      athlete_id  INTEGER PRIMARY KEY,
      firstname   TEXT,
      lastname    TEXT,
      synced_at   TEXT DEFAULT (datetime('now'))
    );
  `);

    db.run(`
    CREATE TABLE IF NOT EXISTS segments_stages (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      nom         TEXT,
      etape       INTEGER,
      segment     INTEGER,
      date_etape  TEXT,
      id_segment  INTEGER,
      start_lat   REAL,
      start_lng   REAL,
      end_lat     REAL,
      end_lng     REAL,
      synced_at   TEXT DEFAULT (datetime('now'))
    );
  `);

    db.run(`
    CREATE TABLE IF NOT EXISTS results (
      athlete_id  INTEGER PRIMARY KEY,
      data        TEXT,
      synced_at   TEXT DEFAULT (datetime('now'))
    );
  `);

    save();
    console.log('SQLite initialisé :', DB_PATH);
}

// Persiste la DB en mémoire vers le fichier disque
function save() {
    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
}

// les athletes 

function getAthletes() {
    console.log("test");
    const stmt = db.prepare('SELECT * FROM athletes ORDER BY lastname ASC');
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
}

function upsertAthletes(rows) {

    for (const r of rows) {
        db.run(`
      INSERT INTO athletes (athlete_id, firstname, lastname)
      VALUES (:athlete_id, :firstname, :lastname)
      ON CONFLICT(athlete_id) DO UPDATE SET
        firstname = excluded.firstname,
        lastname  = excluded.lastname,
        synced_at = datetime('now')
    `, { ':athlete_id': r.athlete_id, ':firstname': r.firstname, ':lastname': r.lastname });
    }
    save();
}

// les segments 

function getSegmentsStages() {
    const stmt = db.prepare('SELECT * FROM segments_stages ORDER BY etape ASC, segment ASC');
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
}

function upsertSegmentsStages(rows) {

    db.run('DELETE FROM segments_stages'); // on remplace tout (structure dynamique)
    for (const r of rows) {
        db.run(`
      INSERT INTO segments_stages
        (nom, etape, segment, date_etape, id_segment, start_lat, start_lng, end_lat, end_lng)
      VALUES
        (:nom, :etape, :segment, :date_etape, :id_segment, :start_lat, :start_lng, :end_lat, :end_lng)
    `, {
            ':nom': r.nom,
            ':etape': r.etape,
            ':segment': r.segment,
            ':date_etape': r.date_etape,
            ':id_segment': r.id_segment,
            ':start_lat': r.start_lat,
            ':start_lng': r.start_lng,
            ':end_lat': r.end_lat,
            ':end_lng': r.end_lng,
        });
    }
    save();
}

// résultats colonnes dynamiques 

function getResults() {
    const stmt = db.prepare('SELECT athlete_id, data FROM results');
    const rows = [];
    while (stmt.step()) {
        const obj = stmt.getAsObject();
        rows.push({ athlete_id: obj.athlete_id, ...JSON.parse(obj.data) });
    }
    stmt.free();
    return rows;
}

function upsertResults(rows) {
    for (const r of rows) {
        const { athlete_id, ...rest } = r;
        db.run(`
      INSERT INTO results (athlete_id, data)
      VALUES (:athlete_id, :data)
      ON CONFLICT(athlete_id) DO UPDATE SET
        data      = excluded.data,
        synced_at = datetime('now')
    `, { ':athlete_id': athlete_id, ':data': JSON.stringify(rest) });
    }
    save();
}

module.exports = {
    init, save,
    getAthletes, upsertAthletes,
    getSegmentsStages, upsertSegmentsStages,
    getResults, upsertResults,
};