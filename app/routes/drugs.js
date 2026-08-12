const express = require("express");
const router  = express.Router();
const crypto  = require("crypto");

/**
 * routes/drugs.js
 * API endpoints untuk manajemen obat dan transaksi distribusi.
 */

// ─── OBAT ────────────────────────────────────────────────────────────────────

// GET /api/drugs — daftar semua obat
router.get("/", (req, res) => {
    try {
        const db    = req.app.locals.db;
        const drugs = db.prepare(`
            SELECT d.*,
                   (SELECT COUNT(*) FROM drug_transactions WHERE drug_id = d.id) as transaction_count
            FROM drugs d
            ORDER BY d.created_at DESC
        `).all();
        res.json({ success: true, data: drugs });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/drugs/stats/summary — statistik ringkasan dashboard (Wajib di atas /:code)
router.get("/stats/summary", (req, res) => {
    try {
        const db           = req.app.locals.db;
        const totalDrugs   = db.prepare("SELECT COUNT(*) as cnt FROM drugs").get().cnt;
        const totalTx      = db.prepare("SELECT COUNT(*) as cnt FROM drug_transactions").get().cnt;
        const totalBlocks  = db.prepare("SELECT COUNT(*) as cnt FROM blockchain_blocks").get().cnt;
        const totalUsers   = db.prepare("SELECT COUNT(*) as cnt FROM users").get().cnt;
        const recentTx     = db.prepare(`
            SELECT dt.id, dt.action, dt.location, dt.created_at,
                   u.name as actor_name,
                   d.drug_name, d.drug_code
            FROM drug_transactions dt
            JOIN users u ON dt.actor_id = u.id
            JOIN drugs d ON dt.drug_id = d.id
            ORDER BY dt.created_at DESC
            LIMIT 5
        `).all();

        res.json({
            success: true,
            data: { totalDrugs, totalTx, totalBlocks, totalUsers, recentTx },
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/drugs/:code — detail obat
router.get("/:code", (req, res) => {
    try {
        const db   = req.app.locals.db;
        const drug = db.prepare("SELECT * FROM drugs WHERE drug_code = ?").get(req.params.code);
        if (!drug) return res.status(404).json({ success: false, message: "Obat tidak ditemukan" });
        res.json({ success: true, data: drug });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/drugs — tambah obat baru (otomatis membuat transaksi MANUFACTURED)
router.post("/", (req, res) => {
    try {
        const db         = req.app.locals.db;
        const blockchain = req.app.locals.blockchain;
        const {
            drugCode, drugName, batchNumber,
            productionDate, expiryDate, manufacturer,
            actorId, location, notes,
        } = req.body;

        if (!drugCode || !drugName || !batchNumber) {
            return res.status(400).json({
                success: false,
                message: "drugCode, drugName, dan batchNumber wajib diisi",
            });
        }

        // Cek duplikat kode obat
        const existing = db.prepare("SELECT id FROM drugs WHERE drug_code = ?").get(drugCode);
        if (existing) {
            return res.status(409).json({ success: false, message: `Kode obat ${drugCode} sudah ada` });
        }

        // Simpan obat ke SQLite
        const drugResult = db.prepare(`
            INSERT INTO drugs (drug_code, drug_name, batch_number, production_date, expiry_date, manufacturer, status)
            VALUES (?, ?, ?, ?, ?, ?, 'MANUFACTURED')
        `).run(drugCode, drugName, batchNumber, productionDate || null, expiryDate || null, manufacturer || null);

        const drugId = drugResult.lastInsertRowid;

        // Tentukan actor — default actor pertama dengan role manufacturer
        let resolvedActorId = actorId;
        if (!resolvedActorId) {
            const mfr = db.prepare("SELECT id FROM users WHERE role = 'manufacturer' LIMIT 1").get();
            resolvedActorId = mfr ? mfr.id : 1;
        }

        // Data transaksi untuk blockchain
        const txData = {
            drugCode,
            drugName,
            batchNumber,
            action:   "MANUFACTURED",
            actor:    manufacturer || "Produsen",
            location: location || "Pabrik",
            notes:    notes || `Obat ${drugName} diproduksi, batch: ${batchNumber}`,
            timestamp: new Date().toISOString(),
        };

        // Hash transaksi untuk referensi
        const txHash = crypto
            .createHash("sha256")
            .update(JSON.stringify(txData))
            .digest("hex");

        // Tambah block ke blockchain
        const newBlock = blockchain.addBlock(txData);

        // Simpan transaksi ke SQLite
        db.prepare(`
            INSERT INTO drug_transactions (drug_id, actor_id, action, location, notes, transaction_hash, block_index)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(drugId, resolvedActorId, "MANUFACTURED", location || "Pabrik", notes || null, txHash, newBlock.index);

        const newDrug = db.prepare("SELECT * FROM drugs WHERE id = ?").get(drugId);
        res.status(201).json({
            success: true,
            data: newDrug,
            block: {
                index: newBlock.index,
                hash:  newBlock.hash,
            },
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─── TRANSAKSI ───────────────────────────────────────────────────────────────

// GET /api/drugs/:code/history — riwayat transaksi obat
router.get("/:code/history", (req, res) => {
    try {
        const db   = req.app.locals.db;
        const drug = db.prepare("SELECT * FROM drugs WHERE drug_code = ?").get(req.params.code);
        if (!drug) return res.status(404).json({ success: false, message: "Obat tidak ditemukan" });

        const history = db.prepare(`
            SELECT dt.*, u.name as actor_name, u.role as actor_role, u.organization as actor_org
            FROM drug_transactions dt
            JOIN users u ON dt.actor_id = u.id
            WHERE dt.drug_id = ?
            ORDER BY dt.created_at ASC
        `).all(drug.id);

        res.json({
            success: true,
            data: {
                drug,
                history,
                totalSteps: history.length,
            },
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/drugs/:code/transactions — tambah transaksi distribusi
router.post("/:code/transactions", (req, res) => {
    try {
        const db         = req.app.locals.db;
        const blockchain = req.app.locals.blockchain;
        const { action, actorId, location, notes } = req.body;

        if (!action || !actorId) {
            return res.status(400).json({ success: false, message: "action dan actorId wajib diisi" });
        }

        const validActions = ["MANUFACTURED", "SHIPPED", "RECEIVED", "DISTRIBUTED", "DISPENSED"];
        if (!validActions.includes(action)) {
            return res.status(400).json({
                success: false,
                message: `Action tidak valid. Pilih: ${validActions.join(", ")}`,
            });
        }

        const drug = db.prepare("SELECT * FROM drugs WHERE drug_code = ?").get(req.params.code);
        if (!drug) return res.status(404).json({ success: false, message: "Obat tidak ditemukan" });

        const actor = db.prepare("SELECT * FROM users WHERE id = ?").get(actorId);
        if (!actor) return res.status(404).json({ success: false, message: "Aktor tidak ditemukan" });

        // Data transaksi untuk blockchain
        const txData = {
            drugCode:    drug.drug_code,
            drugName:    drug.drug_name,
            batchNumber: drug.batch_number,
            action,
            actor:       actor.name,
            actorRole:   actor.role,
            organization: actor.organization,
            location:    location || "-",
            notes:       notes || "",
            timestamp:   new Date().toISOString(),
        };

        // Hash transaksi
        const txHash = crypto
            .createHash("sha256")
            .update(JSON.stringify(txData))
            .digest("hex");

        // Tambah block ke blockchain
        const newBlock = blockchain.addBlock(txData);

        // Update status obat
        db.prepare("UPDATE drugs SET status = ? WHERE id = ?").run(action, drug.id);

        // Simpan transaksi ke SQLite
        const txResult = db.prepare(`
            INSERT INTO drug_transactions (drug_id, actor_id, action, location, notes, transaction_hash, block_index)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(drug.id, actorId, action, location || null, notes || null, txHash, newBlock.index);

        const newTx = db.prepare(`
            SELECT dt.*, u.name as actor_name, u.role as actor_role
            FROM drug_transactions dt
            JOIN users u ON dt.actor_id = u.id
            WHERE dt.id = ?
        `).get(txResult.lastInsertRowid);

        res.status(201).json({
            success: true,
            data: newTx,
            block: {
                index:        newBlock.index,
                hash:         newBlock.hash,
                previousHash: newBlock.previousHash,
            },
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
