const path = require('path');
const fs = require('fs');
const { app } = require('electron');
const initSqlJs = require('sql.js');

// Chemin vers la base de données SQLite sur le disque
const DB_PATH = path.join(app.getPath('userData'), 'geocreuse.db');

let db;  // Instance de la base de données
let SQL; // Moteur SQLite

// ── INITIALISATION ────────────────────────────────────────────────
// Charge le moteur SQL, ouvre ou crée la DB, et crée les tables si besoin
async function init() {
    // Charge le fichier .wasm de sql.js selon l'environnement
    SQL = await initSqlJs({
        locateFile: file => {
            if (app.isPackaged) {
                return path.join(process.resourcesPath, file); // En production
            }
            return path.join(__dirname, '../node_modules/sql.js/dist', file); // En dev
        }
    });

    if (fs.existsSync(DB_PATH)) {
        // Charge la DB existante depuis le disque
        const fileBuffer = fs.readFileSync(DB_PATH);
        db = new SQL.Database(fileBuffer);

        // Vérifie que la structure est à jour (colonne 'data' dans results)
        // Si elle est obsolète, on repart d'une DB vierge
        try {
            db.run('SELECT data FROM results LIMIT 1');
        } catch (e) {
            console.log('DB obsolète, réinitialisation...');
            db.close();
            fs.unlinkSync(DB_PATH);
            db = new SQL.Database();
        }
    } else {
        // Première utilisation : crée une DB vide
        db = new SQL.Database();
    }

    // Crée les tables si elles n'existent pas encore

    // Tokens Strava et infos des athlètes
    db.run(`
        CREATE TABLE IF NOT EXISTS access_token (
            athlete_id               INTEGER PRIMARY KEY,
            athlete_access_token     varchar(255) DEFAULT NULL,
            athlete_refresh_token    varchar(255) DEFAULT NULL,
            athlete_token_expires_at int(11)      DEFAULT NULL,
            firstname                varchar(255) DEFAULT NULL,
            lastname                 varchar(255) DEFAULT NULL,
            synced_at                TEXT         DEFAULT (datetime('now'))
        );
    `);

    // Segments et étapes de la course
    db.run(`
        CREATE TABLE IF NOT EXISTS segments_stages (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            etape      INTEGER,
            date_etape TEXT,
            segment    INTEGER,
            id_segment INTEGER,
            nom        TEXT,
            type       TEXT,
            sous_type  TEXT,
            categorie  INTEGER,
            start_lat  REAL,
            start_lng  REAL,
            end_lat    REAL,
            end_lng    REAL,
            synced_at  TEXT DEFAULT (datetime('now'))
        );
    `);

    // Résultats des athlètes (stockés en JSON pour les colonnes dynamiques)
    db.run(`
        CREATE TABLE IF NOT EXISTS results (
            athlete_id INTEGER PRIMARY KEY,
            data       TEXT,
            synced_at  TEXT DEFAULT (datetime('now'))
        );
    `);

    save();
    console.log('SQLite initialisé :', DB_PATH);
}

// ── PERSISTANCE ───────────────────────────────────────────────────
// Exporte la DB en mémoire vers le fichier disque
function save() {
    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
}

// ── ATHLÈTES ──────────────────────────────────────────────────────

// Retourne tous les athlètes triés par nom
function getAthletes() {
    const stmt = db.prepare('SELECT * FROM access_token ORDER BY lastname ASC');
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
}

// Insère ou met à jour un athlète (upsert)
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

// ── SEGMENTS ──────────────────────────────────────────────────────

// Retourne tous les segments triés par étape puis numéro de segment
function getSegmentsStages() {
    const stmt = db.prepare('SELECT * FROM segments_stages ORDER BY etape ASC, segment ASC');
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
}

// Remplace tous les segments (structure dynamique côté serveur)
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

// ── RÉSULTATS ─────────────────────────────────────────────────────

// Retourne tous les résultats en déserialisant le JSON stocké dans 'data'
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

// Insère ou met à jour un résultat en sérialisant les colonnes dynamiques en JSON
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

// ── SUPPRESSION ───────────────────────────────────────────────────

// Vide une table spécifique (whitelist pour éviter les injections SQL)
function clearTable(table) {
    const allowed = ['access_token', 'segments_stages', 'results'];
    if (!allowed.includes(table)) throw new Error(`Table inconnue : ${table}`);
    db.run(`DELETE FROM ${table}`);
    save();
}

// Vide toutes les tables d'un coup
function clearAll() {
    db.run('DELETE FROM access_token');
    db.run('DELETE FROM segments_stages');
    db.run('DELETE FROM results');
    save();
}

// ── EXPORTS ───────────────────────────────────────────────────────
module.exports = {
    init, save,
    getAthletes, upsertAthletes,
    getSegmentsStages, upsertSegmentsStages,
    getResults, upsertResults,
    clearTable, clearAll,
};