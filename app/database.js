const initSqlJs = require("sql.js");
const path = require("path");
const fs   = require("fs");

// Gunakan folder /tmp jika berjalan di Vercel (serverless read-only filesystem)
const DB_PATH = process.env.VERCEL 
    ? path.join("/tmp", "healthcare.db") 
    : path.join(__dirname, "database", "healthcare.db");

let _db       = null;
let _sqlJs    = null;

/**
 * Simpan database ke file (dipanggil setelah setiap write operation).
 * Dibungkus try-catch agar kegagalan penulisan disk tidak mencabut/mencrash serverless function.
 */
function saveDb() {
    if (!_db) return;
    try {
        const data = _db.export();
        fs.writeFileSync(DB_PATH, Buffer.from(data));
    } catch (err) {
        console.warn("[DB Warning] Gagal menyimpan DB ke disk (fitur memori tetap aktif):", err.message);
    }
}

/**
 * Wrapper agar sql.js terasa seperti better-sqlite3 (sync API).
 * Menyediakan metode: .prepare(sql).run(...), .prepare(sql).get(...), .prepare(sql).all(...)
 */
class SyncDb {
    constructor(sqlJsDb) {
        this._db = sqlJsDb;
    }

    pragma(str) {
        this._db.run(`PRAGMA ${str.replace("=", " ")};`);
        saveDb();
    }

    exec(sql) {
        this._db.run(sql);
        saveDb();
    }

    prepare(sql) {
        const db = this._db;
        return {
            run: (...params) => {
                const stmt = db.prepare(sql);
                // sql.js run() expects array
                const args = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
                stmt.run(args);
                stmt.free();
                saveDb();
                // Dapatkan lastInsertRowid
                const rowRes = db.exec("SELECT last_insert_rowid() as id");
                const lastId = rowRes && rowRes[0] ? rowRes[0].values[0][0] : null;
                return { lastInsertRowid: lastId, changes: 1 };
            },
            get: (...params) => {
                const stmt = db.prepare(sql);
                const args = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
                if (args.length) stmt.bind(args);
                if (stmt.step()) {
                    const row = stmt.getAsObject();
                    stmt.free();
                    return row;
                }
                stmt.free();
                return undefined;
            },
            all: (...params) => {
                const stmt    = db.prepare(sql);
                const args    = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
                if (args.length) stmt.bind(args);
                const results = [];
                while (stmt.step()) {
                    results.push(stmt.getAsObject());
                }
                stmt.free();
                return results;
            },
        };
    }
}

/**
 * database.js
 * Menginisialisasi database SQLite (sql.js) dan membuat tabel-tabel yang dibutuhkan.
 */
async function initDatabase() {
    // Pastikan folder database ada
    const dbFolder = path.dirname(DB_PATH);
    if (!fs.existsSync(dbFolder)) fs.mkdirSync(dbFolder, { recursive: true });

    const locateFile = file => path.join(path.dirname(require.resolve("sql.js")), file);
    try {
        _sqlJs = await initSqlJs({ locateFile });
    } catch (_) {
        _sqlJs = await initSqlJs();
    }

    // Load database yang sudah ada, atau buat baru
    if (fs.existsSync(DB_PATH)) {
        const fileBuffer = fs.readFileSync(DB_PATH);
        _db = new _sqlJs.Database(fileBuffer);
        console.log("[DB] Database dimuat dari file:", DB_PATH);
    } else {
        _db = new _sqlJs.Database();
        console.log("[DB] Database baru dibuat.");
    }

    const db = new SyncDb(_db);

    // ─── Tabel users ─────────────────────────────────────────────────────────
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            name         TEXT    NOT NULL,
            role         TEXT    NOT NULL,
            organization TEXT,
            created_at   TEXT DEFAULT (datetime('now'))
        );
    `);

    // ─── Tabel drugs ─────────────────────────────────────────────────────────
    db.exec(`
        CREATE TABLE IF NOT EXISTS drugs (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            drug_code       TEXT    UNIQUE NOT NULL,
            drug_name       TEXT    NOT NULL,
            batch_number    TEXT    NOT NULL,
            production_date TEXT,
            expiry_date     TEXT,
            manufacturer    TEXT,
            status          TEXT    DEFAULT 'MANUFACTURED',
            created_at      TEXT DEFAULT (datetime('now'))
        );
    `);

    // ─── Tabel drug_transactions ──────────────────────────────────────────────
    db.exec(`
        CREATE TABLE IF NOT EXISTS drug_transactions (
            id               INTEGER PRIMARY KEY AUTOINCREMENT,
            drug_id          INTEGER NOT NULL,
            actor_id         INTEGER NOT NULL,
            action           TEXT    NOT NULL,
            location         TEXT,
            notes            TEXT,
            transaction_hash TEXT,
            block_index      INTEGER,
            created_at       TEXT DEFAULT (datetime('now'))
        );
    `);

    // ─── Tabel blockchain_blocks ──────────────────────────────────────────────
    db.exec(`
        CREATE TABLE IF NOT EXISTS blockchain_blocks (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            block_index  INTEGER NOT NULL,
            timestamp    TEXT    NOT NULL,
            previous_hash TEXT   NOT NULL,
            hash         TEXT    NOT NULL,
            data         TEXT    NOT NULL,
            nonce        INTEGER DEFAULT 0,
            created_at   TEXT DEFAULT (datetime('now'))
        );
    `);

    // ─── Seed Data Awal ───────────────────────────────────────────────────────
    const userCount = db.prepare("SELECT COUNT(*) as cnt FROM users").get();
    if (!userCount || userCount.cnt === 0) {
        console.log("[DB] Memasukkan data seed pengguna...");
        const seedUsers = [
            ["PT Farma Indonesia",  "manufacturer",  "PT Farma Indonesia"],
            ["Distributor ABC",     "distributor",   "ABC Logistics"],
            ["Apotek Sehat",        "pharmacy",      "Apotek Sehat Jakarta"],
            ["Apotek Medika",       "pharmacy",      "Apotek Medika Bandung"],
            ["Distributor XYZ",     "distributor",   "XYZ Distribution"],
            ["Admin Sistem",        "admin",         "Healthcare Blockchain System"],
        ];
        for (const [name, role, org] of seedUsers) {
            db.prepare("INSERT INTO users (name, role, organization) VALUES (?, ?, ?)").run(name, role, org);
        }
        console.log(`[DB] ${seedUsers.length} pengguna berhasil ditambahkan.`);
    }

    return db;
}

// Ekspor saveDb agar bisa dipanggil dari luar jika perlu
module.exports = { initDatabase, saveDb };
