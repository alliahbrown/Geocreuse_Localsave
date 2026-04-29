const path = require('path');
const fs = require('fs');
const { app } = require('electron');
const initSqlJs = require('sql.js');
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

        // Vérifie que la structure est à jour
        try {
            db.run('SELECT data FROM results LIMIT 1');
        } catch (e) {
            // Structure obsolète → recrée une DB propre
            console.log('DB obsolète, réinitialisation...');
            db.close();
            fs.unlinkSync(DB_PATH);
            db = new SQL.Database();
        }
    } else {
        db = new SQL.Database();
    }

    // Ajout des nouvelles tables 
    db.run(`
    CREATE TABLE IF NOT EXISTS access_token (
athlete_id INTEGER PRIMARY KEY,
  athlete_access_token varchar(255) DEFAULT NULL,
  athlete_refresh_token varchar(255) DEFAULT NULL,
  athlete_token_expires_at int(11) DEFAULT NULL,
  firstname varchar(255) DEFAULT NULL,
  lastname varchar(255) DEFAULT NULL,
      synced_at   TEXT DEFAULT (datetime('now'))
    );
  `);
    db.run(`
    CREATE TABLE IF NOT EXISTS segments_stages (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      etape       INTEGER,
      date_etape  TEXT,
      segment     INTEGER,
      id_segment  INTEGER,
      nom         TEXT,
      type        TEXT,
      sous_type   TEXT,
      categorie   INTEGER,
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
    const stmt = db.prepare('SELECT * FROM access_token ORDER BY lastname ASC');
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
}
function upsertAthletes(rows) {
    for (const r of rows) {
        db.run(`
            INSERT INTO access_token (athlete_id, firstname, lastname, athlete_access_token, athlete_refresh_token, athlete_token_expires_at)
            VALUES (:athlete_id, :firstname, :lastname, :access_token, :refresh_token, :expires_at)
            ON CONFLICT(athlete_id) DO UPDATE SET
                firstname                = excluded.firstname,
                lastname                 = excluded.lastname,
                athlete_access_token     = excluded.athlete_access_token,
                athlete_refresh_token    = excluded.athlete_refresh_token,
                athlete_token_expires_at = excluded.athlete_token_expires_at,
                synced_at                = datetime('now')
        `, {
            ':athlete_id': r.athlete_id,
            ':firstname': r.firstname,
            ':lastname': r.lastname,
            ':access_token': r.athlete_access_token,
            ':refresh_token': r.athlete_refresh_token,
            ':expires_at': r.athlete_token_expires_at,
        });
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
    db.run('DELETE FROM segments_stages');
    for (const r of rows) {
        db.run(`
            INSERT INTO segments_stages
              (etape, date_etape, segment, id_segment, nom, type, sous_type, categorie, start_lat, start_lng, end_lat, end_lng)
            VALUES
              (:etape, :date_etape, :segment, :id_segment, :nom, :type, :sous_type, :categorie, :start_lat, :start_lng, :end_lat, :end_lng)
        `, {
            ':etape': r.etape,
            ':date_etape': r.date_etape,
            ':segment': r.segment,
            ':id_segment': r.id_segment,
            ':nom': r.nom,
            ':type': r.type,
            ':sous_type': r.sous_type,
            ':categorie': r.categorie,
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


function clearTable(table) {
    const allowed = ['access_token', 'segments_stages', 'results'];
    if (!allowed.includes(table)) throw new Error(`Table inconnue : ${table}`);
    db.run(`DELETE FROM ${table}`);
    save();
}

function clearAll() {
    db.run('DELETE FROM access_token');
    db.run('DELETE FROM segments_stages');
    db.run('DELETE FROM results');
    save();
}

module.exports = {
    init, save,
    getAthletes, upsertAthletes,
    getSegmentsStages, upsertSegmentsStages,
    getResults, upsertResults,
    clearTable, clearAll,
};