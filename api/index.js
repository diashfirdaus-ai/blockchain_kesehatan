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

let dbPromise = null;
let blockchainInstance = null;

async function setupApp() {
    if (!dbPromise) {
        dbPromise = (async () => {
            const db = await initDatabase();
            blockchainInstance = new Blockchain(db);
            app.locals.db = db;
            app.locals.blockchain = blockchainInstance;
        })();
    }
    await dbPromise;
}

// Middleware inisialisasi DB & Blockchain
app.use(async (req, res, next) => {
    try {
        await setupApp();
        next();
    } catch (err) {
        console.error("[Vercel DB Error]", err);
        next(err);
    }
});

// Penjelasan Materi
app.get("/api/penjelasan", (req, res) => {
    const mdPath = path.join(__dirname, "..", "penjelasan.md");
    if (fs.existsSync(mdPath)) {
        res.sendFile(mdPath);
    } else {
        res.status(404).json({ success: false, message: "File penjelasan.md tidak ditemukan" });
    }
});

// Reset route
app.post("/api/simulation/reset", (req, res) => {
    try {
        const db = req.app.locals.db;
        const bc = req.app.locals.blockchain;

        db.prepare("DELETE FROM drug_transactions").run();
        db.prepare("DELETE FROM drugs").run();
        db.prepare("DELETE FROM blockchain_blocks WHERE block_index > 0").run();

        bc.restoreChain();

        res.json({
            success: true,
            message: "Semua data simulasi berhasil dihapus. Blockchain dikembalikan ke genesis block.",
            genesisOnly: true,
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Sub-routes
app.use("/api/users", require("../app/routes/users"));
app.use("/api/drugs", require("../app/routes/drugs"));
app.use("/api/blockchain", require("../app/routes/blockchain"));

// Root API
app.get("/api", (req, res) => {
    res.json({
        message: "Healthcare Blockchain API",
        version: "1.0.0"
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error("[Vercel Handler Error]", err.stack);
    res.status(500).json({ success: false, message: "Internal server error", error: err.message });
});

module.exports = app;
