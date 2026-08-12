const crypto = require("crypto");

/**
 * Block.js
 * Representasi satu block dalam blockchain.
 *
 * Setiap block menyimpan:
 * - index        : nomor urut block dalam chain
 * - timestamp    : waktu block dibuat
 * - data         : isi transaksi
 * - previousHash : hash dari block sebelumnya
 * - nonce        : angka yang digunakan pada proses mining
 * - hash         : hash SHA-256 dari seluruh komponen block
 */
class Block {
    constructor(index, timestamp, data, previousHash = "") {
        this.index        = index;
        this.timestamp    = timestamp;
        this.data         = data;
        this.previousHash = previousHash;
        this.nonce        = 0;
        this.hash         = this.calculateHash();
    }

    /**
     * Menghitung hash SHA-256 dari seluruh komponen block.
     * Jika ada perubahan pada data, hash akan berubah.
     */
    calculateHash() {
        return crypto
            .createHash("sha256")
            .update(
                this.index +
                this.timestamp +
                JSON.stringify(this.data) +
                this.previousHash +
                this.nonce
            )
            .digest("hex");
    }

    /**
     * Proses mining: mencari nonce sehingga hash dimulai
     * dengan sejumlah angka "0" sesuai difficulty.
     * Ini mensimulasikan Proof of Work (PoW).
     *
     * @param {number} difficulty - jumlah "0" di awal hash
     */
    mineBlock(difficulty) {
        const target = Array(difficulty + 1).join("0");
        while (this.hash.substring(0, difficulty) !== target) {
            this.nonce++;
            this.hash = this.calculateHash();
        }
        console.log(`[Block ${this.index}] Mined: ${this.hash}`);
    }
}

module.exports = Block;
