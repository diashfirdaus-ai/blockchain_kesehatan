const Block = require("./Block");

/**
 * Blockchain.js
 * Mengelola rantai block (chain of blocks).
 *
 * Fitur:
 * - Genesis block (block pertama)
 * - Menambah block baru dengan mining
 * - Validasi integritas seluruh chain
 * - Sinkronisasi dengan database SQLite
 */
class Blockchain {
    /**
     * @param {object} db - instance database better-sqlite3
     */
    constructor(db) {
        this.db         = db;
        this.difficulty = 2; // Proof of Work difficulty (jumlah nol di awal hash)
        this.chain      = [];

        this._loadOrInit();
    }

    /**
     * Load chain dari database, atau buat genesis block jika kosong.
     */
    _loadOrInit() {
        const rows = this.db
            .prepare("SELECT * FROM blockchain_blocks ORDER BY block_index ASC")
            .all();

        if (rows.length === 0) {
            // Buat genesis block
            const genesis = this._createGenesisBlock();
            this.chain.push(genesis);
            this._saveBlock(genesis);
            console.log("[Blockchain] Genesis block dibuat.");
        } else {
            // Load dari database
            this.chain = rows.map((row) => {
                const b = new Block(
                    row.block_index,
                    row.timestamp,
                    JSON.parse(row.data),
                    row.previous_hash
                );
                b.hash  = row.hash;
                b.nonce = row.nonce;
                return b;
            });
            console.log(`[Blockchain] Loaded ${this.chain.length} block(s) dari database.`);
        }
    }

    /**
     * Membuat genesis block (block indeks 0).
     */
    _createGenesisBlock() {
        const genesis = new Block(
            0,
            new Date().toISOString(),
            { message: "Genesis Block — Healthcare Blockchain" },
            "0"
        );
        // Genesis block di-mine dengan difficulty
        genesis.mineBlock(this.difficulty);
        return genesis;
    }

    /**
     * Menyimpan satu block ke database.
     * @param {Block} block
     */
    _saveBlock(block) {
        this.db
            .prepare(
                `INSERT INTO blockchain_blocks
                 (block_index, timestamp, previous_hash, hash, data, nonce)
                 VALUES (?, ?, ?, ?, ?, ?)`
            )
            .run(
                block.index,
                block.timestamp,
                block.previousHash,
                block.hash,
                JSON.stringify(block.data),
                block.nonce
            );
    }

    /**
     * Mendapatkan block terakhir dalam chain.
     * @returns {Block}
     */
    getLatestBlock() {
        return this.chain[this.chain.length - 1];
    }

    /**
     * Menambahkan block baru ke chain.
     * Block di-mine terlebih dahulu (Proof of Work).
     *
     * @param {object} data - data transaksi yang akan disimpan
     * @returns {Block} block yang baru ditambahkan
     */
    addBlock(data) {
        const newBlock = new Block(
            this.chain.length,
            new Date().toISOString(),
            data,
            this.getLatestBlock().hash
        );
        newBlock.mineBlock(this.difficulty);
        this.chain.push(newBlock);
        this._saveBlock(newBlock);
        return newBlock;
    }

    /**
     * Memvalidasi integritas seluruh chain.
     * Memeriksa:
     * 1. Hash setiap block valid (sesuai kalkulasi ulang)
     * 2. previousHash setiap block sesuai hash block sebelumnya
     *
     * @returns {{ valid: boolean, invalidAt: number|null, message: string }}
     */
    isChainValid() {
        for (let i = 1; i < this.chain.length; i++) {
            const current  = this.chain[i];
            const previous = this.chain[i - 1];

            // Cek hash block saat ini
            if (current.hash !== current.calculateHash()) {
                return {
                    valid: false,
                    invalidAt: i,
                    message: `Block ${i} hash tidak valid — data mungkin dimanipulasi`,
                };
            }

            // Cek hubungan dengan block sebelumnya
            if (current.previousHash !== previous.hash) {
                return {
                    valid: false,
                    invalidAt: i,
                    message: `Block ${i} previousHash tidak sesuai dengan hash Block ${i - 1}`,
                };
            }
        }
        return {
            valid: true,
            invalidAt: null,
            message: "Blockchain valid — semua block terverifikasi",
        };
    }

    /**
     * Mendapatkan seluruh chain dalam format array plain object.
     * @returns {Array}
     */
    getChain() {
        return this.chain.map((b) => ({
            index:        b.index,
            timestamp:    b.timestamp,
            data:         b.data,
            previousHash: b.previousHash,
            hash:         b.hash,
            nonce:        b.nonce,
        }));
    }

    /**
     * Simulasi manipulasi data pada block tertentu (untuk pembelajaran).
     * HANYA digunakan untuk demonstrasi tamper evidence.
     *
     * @param {number} blockIndex - index block yang akan dimanipulasi
     * @param {object} newData    - data baru yang akan disuntikkan
     */
    tamperBlock(blockIndex, newData) {
        if (blockIndex < 1 || blockIndex >= this.chain.length) {
            throw new Error("Block index tidak valid");
        }
        const original = JSON.parse(JSON.stringify(this.chain[blockIndex].data));
        this.chain[blockIndex].data = { ...this.chain[blockIndex].data, ...newData, _TAMPERED: true };
        // Hash TIDAK dihitung ulang → blockchain menjadi invalid
        return {
            blockIndex,
            original,
            tampered: this.chain[blockIndex].data,
        };
    }

    /**
     * Restore chain dari database (membatalkan simulasi tamper).
     */
    restoreChain() {
        this._loadOrInit();
        // Muat ulang dari DB
        const rows = this.db
            .prepare("SELECT * FROM blockchain_blocks ORDER BY block_index ASC")
            .all();
        this.chain = rows.map((row) => {
            const b = new Block(
                row.block_index,
                row.timestamp,
                JSON.parse(row.data),
                row.previous_hash
            );
            b.hash  = row.hash;
            b.nonce = row.nonce;
            return b;
        });
    }
}

module.exports = Blockchain;
