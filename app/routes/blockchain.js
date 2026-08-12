const express = require("express");
const router  = express.Router();

/**
 * routes/blockchain.js
 * API endpoints untuk melihat, memverifikasi, dan mensimulasikan manipulasi blockchain.
 */

// GET /api/blockchain — lihat seluruh chain
router.get("/", (req, res) => {
    try {
        const blockchain = req.app.locals.blockchain;
        const chain      = blockchain.getChain();
        res.json({
            success: true,
            data: {
                length: chain.length,
                difficulty: blockchain.difficulty,
                chain,
            },
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/blockchain/verify/chain — verifikasi integritas blockchain
router.get("/verify/chain", (req, res) => {
    try {
        const blockchain = req.app.locals.blockchain;
        const result     = blockchain.isChainValid();
        res.json({
            success:    true,
            valid:      result.valid,
            invalidAt:  result.invalidAt,
            message:    result.message,
            totalBlocks: blockchain.chain.length,
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/blockchain/tamper — simulasi manipulasi data (HANYA UNTUK PEMBELAJARAN)
router.post("/tamper", (req, res) => {
    try {
        const blockchain = req.app.locals.blockchain;
        const { blockIndex, newData } = req.body;

        if (blockIndex === undefined || !newData) {
            return res.status(400).json({
                success: false,
                message: "blockIndex dan newData wajib diisi",
            });
        }

        const result = blockchain.tamperBlock(parseInt(blockIndex), newData);

        res.json({
            success: true,
            message: `⚠️ Data Block ${blockIndex} berhasil dimanipulasi (simulasi pembelajaran). Jalankan verifikasi untuk melihat hasilnya.`,
            tamperInfo: result,
        });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
});

// POST /api/blockchain/restore — restore chain dari database (batalkan simulasi tamper)
router.post("/restore", (req, res) => {
    try {
        const blockchain = req.app.locals.blockchain;
        blockchain.restoreChain();
        res.json({
            success: true,
            message: "Blockchain berhasil dipulihkan dari database.",
            totalBlocks: blockchain.chain.length,
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/blockchain/:index — detail satu block (Wajib di bawah route statis)
router.get("/:index", (req, res) => {
    try {
        const blockchain = req.app.locals.blockchain;
        const idx        = parseInt(req.params.index);
        if (isNaN(idx) || idx < 0 || idx >= blockchain.chain.length) {
            return res.status(404).json({ success: false, message: "Block tidak ditemukan" });
        }
        const block = blockchain.chain[idx];
        res.json({
            success: true,
            data: {
                index:        block.index,
                timestamp:    block.timestamp,
                data:         block.data,
                previousHash: block.previousHash,
                hash:         block.hash,
                nonce:        block.nonce,
            },
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
