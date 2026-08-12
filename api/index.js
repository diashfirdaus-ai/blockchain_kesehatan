const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const { initDatabase } = require("../app/database");
const Blockchain = require("../app/blockchain/Blockchain");

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

let dbReady = false;
let dbPromise = null;

async function setupApp() {
    if (!dbPromise) {
        dbPromise = initDatabase().then(db => {
            const bc = new Blockchain(db);
            app.locals.db = db;
            app.locals.blockchain = bc;
            dbReady = true;
        });
    }
    return dbPromise;
}

// ─── Init DB saat startup (bukan saat request) ───────────────────────────────
setupApp().catch(err => console.error("[STARTUP ERROR]", err));

// ─── Middleware: Tunggu DB siap ───────────────────────────────────────────────
app.use(async (req, res, next) => {
    try {
        await dbPromise;
        next();
    } catch (err) {
        res.status(500).json({ success: false, message: "Database tidak siap: " + err.message });
    }
});

// ─── Test endpoint ────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
    res.json({ success: true, status: "ok", dbReady });
});

// ─── Penjelasan Materi ─────────────────────────────────────────────────────
app.get("/api/penjelasan", (req, res) => {
    const mdPath = path.join(__dirname, "..", "penjelasan.md");
    if (fs.existsSync(mdPath)) {
        res.sendFile(mdPath);
    } else {
        res.status(404).json({ success: false, message: "File penjelasan.md tidak ditemukan" });
    }
});

// ─── Reset Simulation ─────────────────────────────────────────────────────
app.post("/api/simulation/reset", (req, res) => {
    try {
        const db = app.locals.db;
        const bc = app.locals.blockchain;
        db.prepare("DELETE FROM drug_transactions").run();
        db.prepare("DELETE FROM drugs").run();
        db.prepare("DELETE FROM blockchain_blocks WHERE block_index > 0").run();
        bc.restoreChain();
        res.json({ success: true, message: "Data simulasi berhasil dihapus." });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─── Sub-routes ───────────────────────────────────────────────────────────
app.use("/api/users", require("../app/routes/users"));
app.use("/api/drugs", require("../app/routes/drugs"));
app.use("/api/blockchain", require("../app/routes/blockchain"));

// ─── Error handler ────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
    console.error("[ERROR]", err.stack);
    res.status(500).json({ success: false, message: err.message });
});

module.exports = app;
