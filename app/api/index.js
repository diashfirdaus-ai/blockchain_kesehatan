const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const { initDatabase } = require("./database");
const Blockchain = require("./blockchain/Blockchain");

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static frontend
app.use(express.static(path.join(__dirname, "public")));

let dbPromise = null;

async function setupApp() {
    if (!dbPromise) {
        dbPromise = initDatabase().then(db => {
            const bc = new Blockchain(db);
            app.locals.db = db;
            app.locals.blockchain = bc;
        });
    }
    return dbPromise;
}

setupApp().catch(err => console.error("[STARTUP ERROR]", err.message));

app.use(async (req, res, next) => {
    try {
        await dbPromise;
        next();
    } catch (err) {
        res.status(500).json({ success: false, message: "Database error: " + err.message });
    }
});

// Health check
app.get("/api/health", (req, res) => {
    res.json({ success: true, status: "ok", timestamp: new Date().toISOString() });
});

// Penjelasan Materi
app.get("/api/penjelasan", (req, res) => {
    // Coba dari parent dir dulu (jika dijalankan dari root), lalu dari dir ini
    const candidates = [
        path.join(__dirname, "..", "penjelasan.md"),
        path.join(__dirname, "penjelasan.md"),
    ];
    const mdPath = candidates.find(p => fs.existsSync(p));
    if (mdPath) {
        res.sendFile(mdPath);
    } else {
        res.status(404).json({ success: false, message: "File penjelasan.md tidak ditemukan" });
    }
});

// Reset Simulation
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

// API Routes
app.use("/api/users", require("./routes/users"));
app.use("/api/drugs", require("./routes/drugs"));
app.use("/api/blockchain", require("./routes/blockchain"));

// SPA fallback
app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.use((err, req, res, next) => {
    console.error("[ERROR]", err.stack);
    res.status(500).json({ success: false, message: err.message });
});

module.exports = app;
