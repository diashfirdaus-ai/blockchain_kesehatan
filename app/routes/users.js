const express    = require("express");
const router     = express.Router();

/**
 * routes/users.js
 * API endpoints untuk manajemen pengguna.
 */

// GET /api/users — daftar semua pengguna
router.get("/", (req, res) => {
    try {
        const db    = req.app.locals.db;
        const users = db.prepare("SELECT * FROM users ORDER BY role, name").all();
        res.json({ success: true, data: users });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/users/:id — detail pengguna
router.get("/:id", (req, res) => {
    try {
        const db   = req.app.locals.db;
        const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id);
        if (!user) return res.status(404).json({ success: false, message: "Pengguna tidak ditemukan" });
        res.json({ success: true, data: user });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/users — tambah pengguna baru
router.post("/", (req, res) => {
    try {
        const db = req.app.locals.db;
        const { name, role, organization } = req.body;

        if (!name || !role) {
            return res.status(400).json({ success: false, message: "name dan role wajib diisi" });
        }

        const validRoles = ["manufacturer", "distributor", "pharmacy", "patient", "admin"];
        if (!validRoles.includes(role)) {
            return res.status(400).json({
                success: false,
                message: `Role tidak valid. Pilih: ${validRoles.join(", ")}`,
            });
        }

        const result = db
            .prepare("INSERT INTO users (name, role, organization) VALUES (?, ?, ?)")
            .run(name, role, organization || null);

        const newUser = db.prepare("SELECT * FROM users WHERE id = ?").get(result.lastInsertRowid);
        res.status(201).json({ success: true, data: newUser });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
