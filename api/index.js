const express    = require("express");
const bodyParser = require("body-parser");
const cors       = require("cors");
const path       = require("path");
const fs         = require("fs");
const crypto     = require("crypto");

// ─── sql.js setup ────────────────────────────────────────────────────────────
const initSqlJs = require("sql.js");

// On Vercel the filesystem is read-only except /tmp
const DB_PATH = process.env.VERCEL
    ? path.join("/tmp", "healthcare.db")
    : path.join(__dirname, "../app/database/healthcare.db");

// ─── SyncDb wrapper (mirrors better-sqlite3 API) ─────────────────────────────
let _sqlJsDb = null;

function saveDb() {
    if (!_sqlJsDb) return;
    try {
        const data = _sqlJsDb.export();
        fs.writeFileSync(DB_PATH, Buffer.from(data));
    } catch (e) {
        console.warn("[DB] Could not persist to disk:", e.message);
    }
}

class SyncDb {
    constructor(db) { this._db = db; }

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
                const args = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
                stmt.run(args);
                stmt.free();
                saveDb();
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
                const stmt   = db.prepare(sql);
                const args   = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
                if (args.length) stmt.bind(args);
                const result = [];
                while (stmt.step()) result.push(stmt.getAsObject());
                stmt.free();
                return result;
            },
        };
    }
}

// ─── DB init ─────────────────────────────────────────────────────────────────
async function initDatabase() {
    // Resolve the sql-wasm.wasm file bundled alongside sql.js
    let sqlJs;
    try {
        const wasmDir = path.dirname(require.resolve("sql.js"));
        sqlJs = await initSqlJs({
            locateFile: file => path.join(wasmDir, file),
        });
    } catch (_) {
        sqlJs = await initSqlJs();
    }

    // Load existing DB or create fresh
    let rawDb;
    if (fs.existsSync(DB_PATH)) {
        rawDb = new sqlJs.Database(fs.readFileSync(DB_PATH));
        console.log("[DB] Loaded from", DB_PATH);
    } else {
        rawDb = new sqlJs.Database();
        console.log("[DB] New in-memory database created.");
    }
    _sqlJsDb = rawDb;

    const db = new SyncDb(rawDb);

    db.exec(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        organization TEXT,
        created_at TEXT DEFAULT (datetime('now'))
    );`);

    db.exec(`CREATE TABLE IF NOT EXISTS drugs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        drug_code TEXT UNIQUE NOT NULL,
        drug_name TEXT NOT NULL,
        batch_number TEXT NOT NULL,
        production_date TEXT,
        expiry_date TEXT,
        manufacturer TEXT,
        status TEXT DEFAULT 'MANUFACTURED',
        created_at TEXT DEFAULT (datetime('now'))
    );`);

    db.exec(`CREATE TABLE IF NOT EXISTS drug_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        drug_id INTEGER NOT NULL,
        actor_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        location TEXT,
        notes TEXT,
        transaction_hash TEXT,
        block_index INTEGER,
        created_at TEXT DEFAULT (datetime('now'))
    );`);

    db.exec(`CREATE TABLE IF NOT EXISTS blockchain_blocks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        block_index INTEGER NOT NULL,
        timestamp TEXT NOT NULL,
        previous_hash TEXT NOT NULL,
        hash TEXT NOT NULL,
        data TEXT NOT NULL,
        nonce INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
    );`);

    // Seed users if empty
    const cnt = db.prepare("SELECT COUNT(*) as cnt FROM users").get();
    if (!cnt || cnt.cnt === 0) {
        const seeds = [
            ["PT Farma Indonesia",  "manufacturer",  "PT Farma Indonesia"],
            ["Distributor ABC",     "distributor",   "ABC Logistics"],
            ["Apotek Sehat",        "pharmacy",      "Apotek Sehat Jakarta"],
            ["Apotek Medika",       "pharmacy",      "Apotek Medika Bandung"],
            ["Distributor XYZ",     "distributor",   "XYZ Distribution"],
            ["Admin Sistem",        "admin",         "Healthcare Blockchain System"],
        ];
        for (const [name, role, org] of seeds) {
            db.prepare("INSERT INTO users (name, role, organization) VALUES (?, ?, ?)").run(name, role, org);
        }
        console.log("[DB] Seed data inserted.");
    }

    return db;
}

// ─── Blockchain ───────────────────────────────────────────────────────────────
const Block      = require("../app/blockchain/Block");
const Blockchain = require("../app/blockchain/Blockchain");

// ─── Express App ─────────────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static frontend (app/public)
app.use(express.static(path.join(__dirname, "../app/public")));

// ─── Lazy init (cold-start safe) ─────────────────────────────────────────────
let _initPromise = null;

function ensureInit() {
    if (!_initPromise) {
        _initPromise = initDatabase().then(db => {
            const bc = new Blockchain(db);
            app.locals.db         = db;
            app.locals.blockchain = bc;
        }).catch(err => {
            console.error("[INIT ERROR]", err);
            _initPromise = null; // allow retry on next request
            throw err;
        });
    }
    return _initPromise;
}

// ─── Init middleware ──────────────────────────────────────────────────────────
app.use(async (req, res, next) => {
    try {
        await ensureInit();
        next();
    } catch (err) {
        res.status(500).json({ success: false, message: "Initialization error: " + err.message });
    }
});

// ─── Health ───────────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
    res.json({ success: true, status: "ok", timestamp: new Date().toISOString() });
});

// ─── Penjelasan ───────────────────────────────────────────────────────────────
app.get("/api/penjelasan", (req, res) => {
    const mdPath = path.join(__dirname, "../penjelasan.md");
    if (fs.existsSync(mdPath)) {
        res.sendFile(path.resolve(mdPath));
    } else {
        res.status(404).json({ success: false, message: "penjelasan.md tidak ditemukan" });
    }
});

// ─── Simulation Reset ────────────────────────────────────────────────────────
app.post("/api/simulation/reset", (req, res) => {
    try {
        const db = app.locals.db;
        const bc = app.locals.blockchain;
        db.prepare("DELETE FROM drug_transactions").run();
        db.prepare("DELETE FROM drugs").run();
        db.prepare("DELETE FROM blockchain_blocks WHERE block_index > 0").run();
        bc.restoreChain();
        res.json({ success: true, message: "Simulasi berhasil direset ke genesis block." });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─── Sub-routes ───────────────────────────────────────────────────────────────
app.use("/api/users",      require("../app/routes/users"));
app.use("/api/drugs",      require("../app/routes/drugs"));
app.use("/api/blockchain", require("../app/routes/blockchain"));

// ─── SPA fallback ─────────────────────────────────────────────────────────────
app.get("*", (req, res) => {
    res.sendFile(path.resolve(__dirname, "../app/public/index.html"));
});

// ─── Error handler ────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
    console.error("[ERROR]", err.stack);
    res.status(500).json({ success: false, message: err.message });
});

module.exports = app;
