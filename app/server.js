const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const { initDatabase } = require("./database");
const Blockchain = require("./blockchain/Blockchain");

// Bungkus seluruh startup dalam async function karena initDatabase adalah async (sql.js)
async function startServer() {

    // ─── Inisialisasi Express ────────────────────────────────────────────────────
    const app = express();
    const PORT = process.env.PORT || 3000;

    // Middleware
    app.use(cors());
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: true }));

    // Static files (frontend)
    app.use(express.static(path.join(__dirname, "public")));

    // ─── Pastikan folder database ada ──────────────────────────────────────────
    const dbFolder = path.join(__dirname, "database");
    if (!fs.existsSync(dbFolder)) {
        fs.mkdirSync(dbFolder, { recursive: true });
    }

    // ─── Inisialisasi Database ──────────────────────────────────────────────────
    console.log("=".repeat(60));
    console.log(" Healthcare Blockchain Simulation");
    console.log("=".repeat(60));
    console.log("[Server] Menginisialisasi database SQLite (sql.js)...");
    const db = await initDatabase();
    console.log("[Server] Database siap.");

    // ─── Inisialisasi Blockchain ─────────────────────────────────────────────
    console.log("[Server] Menginisialisasi blockchain engine...");
    const blockchain = new Blockchain(db);
    console.log(`[Server] Blockchain siap. Total block: ${blockchain.chain.length}`);

    // Inject db & blockchain ke semua routes via app.locals
    app.locals.db = db;
    app.locals.blockchain = blockchain;

    // ─── Simulation Reset Route ───────────────────────────────────────────────
    app.post("/api/simulation/reset", (req, res) => {
        try {
            const db = req.app.locals.db;
            const blockchain = req.app.locals.blockchain;

            // Hapus semua transaksi, obat, dan blocks (kecuali genesis)
            db.prepare("DELETE FROM drug_transactions").run();
            db.prepare("DELETE FROM drugs").run();
            db.prepare("DELETE FROM blockchain_blocks WHERE block_index > 0").run();

            // Reset chain di memori ke genesis saja
            blockchain.restoreChain();

            res.json({
                success: true,
                message: "Semua data simulasi berhasil dihapus. Blockchain dikembalikan ke genesis block.",
                genesisOnly: true,
            });
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    });

    // ─── Routes ──────────────────────────────────────────────────────────────
    app.use("/api/users", require("./routes/users"));
    app.use("/api/drugs", require("./routes/drugs"));
    app.use("/api/blockchain", require("./routes/blockchain"));

    // ─── Root ────────────────────────────────────────────────────────────────
    app.get("/api", (req, res) => {
        res.json({
            message: "Healthcare Blockchain API",
            version: "1.0.0",
            endpoints: {
                users: "GET/POST /api/users",
                drugs: "GET/POST /api/drugs",
                drugHistory: "GET      /api/drugs/:code/history",
                drugTransaction: "POST     /api/drugs/:code/transactions",
                stats: "GET      /api/drugs/stats/summary",
                blockchain: "GET      /api/blockchain",
                verify: "GET      /api/blockchain/verify/chain",
                tamper: "POST     /api/blockchain/tamper",
                restore: "POST     /api/blockchain/restore",
            },
        });
    });

    // ─── Penjelasan Materi ───────────────────────────────────────────────────
    app.get("/api/penjelasan", (req, res) => {
        const mdPath = path.join(__dirname, "..", "penjelasan.md");
        if (fs.existsSync(mdPath)) {
            res.sendFile(mdPath);
        } else {
            res.status(404).json({ success: false, message: "File penjelasan.md tidak ditemukan" });
        }
    });

    // Fallback — serve index.html untuk semua route non-API
    app.get("*", (req, res) => {
        res.sendFile(path.join(__dirname, "public", "index.html"));
    });

    // ─── Error Handler ──────────────────────────────────────────────────────
    app.use((err, req, res, next) => {
        console.error("[Error]", err.stack);
        res.status(500).json({ success: false, message: "Internal server error", error: err.message });
    });

    // ─── Start Server ────────────────────────────────────────────────────────
    app.listen(PORT, () => {
        console.log("=".repeat(60));
        console.log(`[Server] Berjalan di http://localhost:${PORT}`);
        console.log(`[Server] Buka browser: http://localhost:${PORT}`);
        console.log("=".repeat(60));
    });

    return app;
}

// Jalankan server
startServer().catch(err => {
    console.error("[Fatal] Gagal memulai server:", err);
    process.exit(1);
});
