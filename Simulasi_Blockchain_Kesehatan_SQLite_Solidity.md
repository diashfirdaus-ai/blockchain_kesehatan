# Simulasi Aplikasi Blockchain di Bidang Kesehatan

## 1. Gambaran Umum

Dokumen ini berisi contoh simulasi sederhana aplikasi blockchain untuk
bidang kesehatan yang **dapat diuji oleh mahasiswa secara lokal**.

Studi kasus:

> **Sistem Pencatatan dan Verifikasi Riwayat Distribusi Obat**

Aplikasi mensimulasikan bagaimana data perjalanan obat dari produsen →
distributor → apotek → pasien dapat dicatat secara terstruktur.

Blockchain pada simulasi ini dibuat sederhana menggunakan **custom
blockchain di server**, sedangkan **SQLite** digunakan sebagai database
aplikasi untuk menyimpan data pengguna, obat, transaksi, dan salinan
metadata blockchain.

> **Catatan penting:** Solidity disertakan sebagai contoh smart
> contract, tetapi **tidak digunakan dalam simulasi utama**. Tujuannya
> agar mahasiswa dapat membandingkan implementasi blockchain custom
> dengan smart contract pada blockchain seperti Ethereum.

------------------------------------------------------------------------

# 2. Tujuan Pembelajaran

Setelah mencoba simulasi, mahasiswa diharapkan memahami:

1.  Perbedaan database biasa dan blockchain.
2.  Konsep block, hash, previous hash, dan timestamp.
3.  Hubungan transaksi dengan block.
4.  Cara memverifikasi integritas blockchain.
5.  Cara blockchain digunakan untuk traceability obat.
6.  Peran SQLite sebagai database aplikasi.
7.  Konsep smart contract.
8.  Perbedaan custom blockchain dengan smart contract Solidity.
9.  Mengapa data sensitif pasien tidak sebaiknya langsung disimpan
    secara terbuka di blockchain.

------------------------------------------------------------------------

# 3. Skenario Kasus

Sebuah perusahaan farmasi ingin memastikan perjalanan obat dapat
ditelusuri.

Alurnya:

``` text
PRODUSEN
   │
   ▼
DISTRIBUTOR
   │
   ▼
APOTEK
   │
   ▼
PASIEN
```

Setiap perubahan status obat menghasilkan transaksi.

Contoh:

``` text
Obat dibuat
    ↓
Obat dikirim ke distributor
    ↓
Distributor menerima obat
    ↓
Obat dikirim ke apotek
    ↓
Apotek menerima obat
    ↓
Obat diberikan kepada pasien
```

Blockchain menyimpan jejak transaksi tersebut.

------------------------------------------------------------------------

# 4. Arsitektur Sistem

``` text
┌─────────────────────────────────────────────┐
│              FRONTEND WEB                    │
│       HTML + CSS + JavaScript                │
└───────────────────┬─────────────────────────┘
                    │ HTTP / REST API
                    ▼
┌─────────────────────────────────────────────┐
│              APPLICATION SERVER              │
│              Node.js + Express               │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │ Blockchain Engine                     │  │
│  │ - Block                               │  │
│  │ - Blockchain                          │  │
│  │ - SHA-256                             │  │
│  │ - Validation                          │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │ Business Logic                        │  │
│  │ - Drug Tracking                       │  │
│  │ - Transaction                         │  │
│  │ - Verification                        │  │
│  └───────────────────────────────────────┘  │
└───────────────┬─────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────┐
│                 SQLite                      │
│                                             │
│ users                                       │
│ drugs                                       │
│ drug_transactions                           │
│ blockchain_blocks                           │
└─────────────────────────────────────────────┘
```

------------------------------------------------------------------------

# 5. Komponen Sistem

## 5.1 Frontend

Frontend digunakan mahasiswa untuk:

-   menambahkan obat;
-   mengubah status obat;
-   melihat perjalanan obat;
-   melihat block;
-   melakukan verifikasi blockchain;
-   melihat hash;
-   melihat apakah blockchain valid.

Teknologi:

``` text
HTML
CSS
JavaScript
```

------------------------------------------------------------------------

## 5.2 Backend

Backend menggunakan:

``` text
Node.js
Express.js
```

Backend menangani:

-   REST API;
-   database SQLite;
-   pembuatan block;
-   hashing;
-   validasi blockchain;
-   pencatatan transaksi kesehatan.

------------------------------------------------------------------------

# 6. SQLite Database

SQLite digunakan sebagai **database aplikasi**.

Perlu dibedakan:

``` text
SQLite
    ↓
Menyimpan data aplikasi

Blockchain
    ↓
Menyimpan record transaksi dalam bentuk block
```

SQLite bukan pengganti blockchain.

Dalam simulasi ini, SQLite digunakan agar mahasiswa dapat melihat
bagaimana blockchain dapat diintegrasikan dengan sistem aplikasi nyata.

------------------------------------------------------------------------

# 7. Struktur Database

## 7.1 Tabel users

Menyimpan pengguna sistem.

``` sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    organization TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

Contoh:

    id name              role           organization
  ---- ----------------- -------------- --------------------
     1 PT Farma          manufacturer   PT Farma Indonesia
     2 Distributor ABC   distributor    ABC Logistics
     3 Apotek Sehat      pharmacy       Apotek Sehat

------------------------------------------------------------------------

## 7.2 Tabel drugs

Menyimpan informasi obat.

``` sql
CREATE TABLE drugs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    drug_code TEXT UNIQUE NOT NULL,
    drug_name TEXT NOT NULL,
    batch_number TEXT NOT NULL,
    production_date TEXT,
    expiry_date TEXT,
    manufacturer TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

Contoh:

``` text
drug_code   : DRG-001
drug_name   : Paracetamol 500 mg
batch       : PCM-2026-001
```

------------------------------------------------------------------------

## 7.3 Tabel drug_transactions

Menyimpan aktivitas perjalanan obat.

``` sql
CREATE TABLE drug_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    drug_id INTEGER NOT NULL,
    actor_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    location TEXT,
    notes TEXT,
    transaction_hash TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (drug_id) REFERENCES drugs(id),
    FOREIGN KEY (actor_id) REFERENCES users(id)
);
```

Contoh action:

``` text
MANUFACTURED
SHIPPED
RECEIVED
DISTRIBUTED
DISPENSED
```

------------------------------------------------------------------------

## 7.4 Tabel blockchain_blocks

Tabel ini menyimpan representasi blockchain ke SQLite.

``` sql
CREATE TABLE blockchain_blocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    block_index INTEGER NOT NULL,
    timestamp TEXT NOT NULL,
    previous_hash TEXT NOT NULL,
    hash TEXT NOT NULL,
    data TEXT NOT NULL,
    nonce INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

------------------------------------------------------------------------

# 8. Struktur Project

Contoh struktur project:

``` text
healthcare-blockchain/
│
├── package.json
├── server.js
├── blockchain.js
├── database.js
│
├── blockchain/
│   ├── Block.js
│   └── Blockchain.js
│
├── routes/
│   ├── drugs.js
│   ├── blockchain.js
│   └── verification.js
│
├── database/
│   └── healthcare.db
│
├── public/
│   ├── index.html
│   ├── style.css
│   └── app.js
│
└── contracts/
    └── HealthcareDrugTracking.sol
```

------------------------------------------------------------------------

# 9. Konsep Block

Setiap block memiliki:

``` text
Index
Timestamp
Data
Previous Hash
Hash
Nonce
```

Contoh:

``` json
{
  "index": 3,
  "timestamp": "2026-08-12T10:00:00Z",
  "data": {
    "drugCode": "DRG-001",
    "action": "RECEIVED",
    "actor": "Apotek Sehat"
  },
  "previousHash": "000abc...",
  "hash": "000def...",
  "nonce": 1245
}
```

------------------------------------------------------------------------

# 10. Contoh Implementasi Block

File:

``` text
blockchain/Block.js
```

``` javascript
const crypto = require("crypto");

class Block {
    constructor(index, timestamp, data, previousHash = "") {
        this.index = index;
        this.timestamp = timestamp;
        this.data = data;
        this.previousHash = previousHash;
        this.nonce = 0;
        this.hash = this.calculateHash();
    }

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

    mineBlock(difficulty) {
        while (
            this.hash.substring(0, difficulty) !==
            Array(difficulty + 1).join("0")
        ) {
            this.nonce++;
            this.hash = this.calculateHash();
        }

        console.log("Block mined:", this.hash);
    }
}

module.exports = Block;
```

------------------------------------------------------------------------

# 11. Contoh Blockchain

File:

``` text
blockchain/Blockchain.js
```

``` javascript
const Block = require("./Block");

class Blockchain {
    constructor() {
        this.chain = [this.createGenesisBlock()];
        this.difficulty = 2;
    }

    createGenesisBlock() {
        return new Block(
            0,
            new Date().toISOString(),
            {
                message: "Genesis Block"
            },
            "0"
        );
    }

    getLatestBlock() {
        return this.chain[this.chain.length - 1];
    }

    addBlock(newBlock) {
        newBlock.previousHash =
            this.getLatestBlock().hash;

        newBlock.mineBlock(this.difficulty);

        this.chain.push(newBlock);
    }

    isChainValid() {
        for (let i = 1; i < this.chain.length; i++) {

            const currentBlock = this.chain[i];
            const previousBlock = this.chain[i - 1];

            if (
                currentBlock.hash !==
                currentBlock.calculateHash()
            ) {
                return false;
            }

            if (
                currentBlock.previousHash !==
                previousBlock.hash
            ) {
                return false;
            }
        }

        return true;
    }
}

module.exports = Blockchain;
```

------------------------------------------------------------------------

# 12. Contoh Transaksi Kesehatan

Misalnya obat:

``` text
DRG-001
Paracetamol 500 mg
Batch PCM-2026-001
```

Transaksi pertama:

``` json
{
  "drugCode": "DRG-001",
  "action": "MANUFACTURED",
  "actor": "PT Farma",
  "location": "Bandung"
}
```

Transaksi kedua:

``` json
{
  "drugCode": "DRG-001",
  "action": "SHIPPED",
  "actor": "PT Farma",
  "location": "Bandung → Jakarta"
}
```

Transaksi ketiga:

``` json
{
  "drugCode": "DRG-001",
  "action": "RECEIVED",
  "actor": "Distributor ABC",
  "location": "Jakarta"
}
```

Transaksi keempat:

``` json
{
  "drugCode": "DRG-001",
  "action": "DISPENSED",
  "actor": "Apotek Sehat",
  "location": "Jakarta"
}
```

------------------------------------------------------------------------

# 13. Contoh Isi Blockchain

Setelah transaksi dilakukan:

``` text
BLOCK 0
┌───────────────────────────┐
│ Genesis Block             │
│ Hash: abc123              │
└─────────────┬─────────────┘
              │ previousHash
              ▼
BLOCK 1
┌───────────────────────────┐
│ MANUFACTURED              │
│ Drug: DRG-001             │
│ Hash: def456              │
│ Previous: abc123          │
└─────────────┬─────────────┘
              │
              ▼
BLOCK 2
┌───────────────────────────┐
│ SHIPPED                   │
│ Drug: DRG-001             │
│ Hash: ghi789              │
│ Previous: def456          │
└─────────────┬─────────────┘
              │
              ▼
BLOCK 3
┌───────────────────────────┐
│ RECEIVED                  │
│ Drug: DRG-001             │
│ Hash: jkl012              │
│ Previous: ghi789          │
└───────────────────────────┘
```

Perubahan satu block akan memengaruhi hash block tersebut dan hubungan
dengan block berikutnya.

------------------------------------------------------------------------

# 14. Alur Ketika Transaksi Dibuat

``` text
User
 │
 │ Input transaksi
 ▼
REST API
 │
 ▼
Validasi transaksi
 │
 ├──────────────► SQLite
 │                 │
 │                 └── Simpan metadata transaksi
 │
 ▼
Blockchain Engine
 │
 ▼
Create Block
 │
 ▼
Calculate SHA-256
 │
 ▼
Simpan Block
 │
 ▼
Blockchain Valid
```

------------------------------------------------------------------------

# 15. Contoh API

## Menambahkan obat

``` http
POST /api/drugs
```

Body:

``` json
{
    "drugCode": "DRG-001",
    "drugName": "Paracetamol 500 mg",
    "batchNumber": "PCM-2026-001",
    "manufacturer": "PT Farma Indonesia"
}
```

------------------------------------------------------------------------

## Menambahkan transaksi

``` http
POST /api/drugs/DRG-001/transactions
```

Body:

``` json
{
    "action": "SHIPPED",
    "actorId": 1,
    "location": "Bandung → Jakarta",
    "notes": "Pengiriman batch PCM-2026-001"
}
```

------------------------------------------------------------------------

## Melihat riwayat obat

``` http
GET /api/drugs/DRG-001/history
```

Contoh response:

``` json
{
    "drugCode": "DRG-001",
    "history": [
        {
            "action": "MANUFACTURED",
            "location": "Bandung"
        },
        {
            "action": "SHIPPED",
            "location": "Bandung → Jakarta"
        },
        {
            "action": "RECEIVED",
            "location": "Jakarta"
        }
    ]
}
```

------------------------------------------------------------------------

## Memverifikasi blockchain

``` http
GET /api/blockchain/verify
```

Response:

``` json
{
    "valid": true,
    "message": "Blockchain valid"
}
```

Jika ada manipulasi:

``` json
{
    "valid": false,
    "message": "Blockchain telah dimodifikasi"
}
```

------------------------------------------------------------------------

# 16. Simulasi Manipulasi Data

Mahasiswa dapat melakukan eksperimen.

Misalnya:

``` javascript
blockchain.chain[1].data.action = "DISPENSED";
```

Sebelum perubahan:

``` text
Hash Block 1:
abc123...
```

Setelah perubahan:

``` text
Hash Block 1:
xyz789...
```

Namun Block 2 masih memiliki:

``` text
previousHash = abc123...
```

Maka:

``` text
Block 1 Hash
     ≠
Block 2 Previous Hash
```

Hasil:

``` text
Blockchain Valid?
        ↓
       NO
```

Eksperimen ini membantu mahasiswa memahami **tamper evidence**.

------------------------------------------------------------------------

# 17. Hal Penting dalam Sistem Kesehatan

Dalam sistem kesehatan nyata, **jangan memasukkan data pribadi pasien
secara langsung ke public blockchain**.

Contoh data sensitif:

``` text
Nama pasien
NIK
Alamat
Diagnosis
Rekam medis
Hasil laboratorium
```

Pendekatan yang lebih aman:

``` text
                BLOCKCHAIN
                    │
                    ▼
        ┌─────────────────────┐
        │ Hash / Reference ID │
        │ Timestamp           │
        │ Transaction Proof   │
        └─────────────────────┘
                    │
                    │ reference
                    ▼
             SECURE DATABASE
                    │
                    ▼
              Medical Data
```

Blockchain dapat menyimpan **hash atau proof**, sedangkan data medis
disimpan pada sistem yang memiliki kontrol akses.

------------------------------------------------------------------------

# 18. Contoh Smart Contract Solidity

File:

``` text
contracts/HealthcareDrugTracking.sol
```

> Smart contract berikut **tidak digunakan oleh aplikasi utama**. Ini
> hanya contoh untuk memperkenalkan konsep Solidity dan Ethereum.

``` solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract HealthcareDrugTracking {

    struct Drug {
        string drugCode;
        string drugName;
        string batchNumber;
        address creator;
        uint256 createdAt;
    }

    struct DrugEvent {
        string action;
        string location;
        uint256 timestamp;
        address actor;
    }

    mapping(string => Drug) public drugs;

    mapping(string => DrugEvent[]) private drugEvents;

    event DrugRegistered(
        string drugCode,
        string drugName,
        string batchNumber,
        address creator
    );

    event DrugEventRecorded(
        string drugCode,
        string action,
        string location,
        address actor
    );

    function registerDrug(
        string memory _drugCode,
        string memory _drugName,
        string memory _batchNumber
    ) public {

        drugs[_drugCode] = Drug(
            _drugCode,
            _drugName,
            _batchNumber,
            msg.sender,
            block.timestamp
        );

        emit DrugRegistered(
            _drugCode,
            _drugName,
            _batchNumber,
            msg.sender
        );
    }

    function recordDrugEvent(
        string memory _drugCode,
        string memory _action,
        string memory _location
    ) public {

        drugEvents[_drugCode].push(
            DrugEvent(
                _action,
                _location,
                block.timestamp,
                msg.sender
            )
        );

        emit DrugEventRecorded(
            _drugCode,
            _action,
            _location,
            msg.sender
        );
    }

    function getDrugEventCount(
        string memory _drugCode
    ) public view returns (uint256) {

        return drugEvents[_drugCode].length;
    }
}
```

------------------------------------------------------------------------

# 19. Custom Blockchain vs Solidity

  Aspek               Simulasi Custom Blockchain   Solidity / Ethereum
  ------------------- ---------------------------- -------------------------------------
  Blockchain          Dibuat sendiri               Ethereum
  Bahasa              JavaScript                   Solidity
  Database aplikasi   SQLite                       Bisa menggunakan database off-chain
  Konsensus           Simulasi sederhana           Mekanisme jaringan Ethereum
  Smart contract      Tidak wajib                  Ya
  Gas fee             Tidak ada                    Ada
  Node                Satu server simulasi         Banyak node
  Tujuan              Pembelajaran                 Implementasi blockchain platform
  Cocok untuk         Praktikum                    Eksperimen smart contract

------------------------------------------------------------------------

# 20. Mengapa SQLite Tetap Digunakan?

Pertanyaan penting:

> "Kalau sudah ada blockchain, mengapa masih membutuhkan database?"

Jawabannya:

Blockchain dan database memiliki fungsi yang berbeda.

``` text
                APPLICATION
                     │
          ┌──────────┴──────────┐
          ▼                     ▼
       SQLite              Blockchain
          │                     │
          │                     │
   Data operasional       Proof / ledger
   User                   Transaction
   Obat                   Hash
   Metadata               Timestamp
   UI data                Integrity
```

SQLite cocok untuk:

-   query cepat;
-   data pengguna;
-   data obat;
-   metadata;
-   pencarian;
-   kebutuhan aplikasi.

Blockchain cocok untuk:

-   transaction history;
-   integrity;
-   traceability;
-   audit trail;
-   proof of record.

------------------------------------------------------------------------

# 21. Demo Praktikum Mahasiswa

## Skenario 1 --- Membuat Obat

Mahasiswa memasukkan:

``` text
Nama:
Paracetamol 500 mg

Kode:
DRG-001

Batch:
PCM-2026-001
```

Sistem membuat transaksi:

``` text
MANUFACTURED
```

------------------------------------------------------------------------

## Skenario 2 --- Distribusi

Distributor menerima obat.

``` text
Action:
RECEIVED

Location:
Jakarta

Actor:
Distributor ABC
```

Sistem membuat block baru.

------------------------------------------------------------------------

## Skenario 3 --- Apotek

Apotek menerima obat.

``` text
Action:
RECEIVED

Location:
Apotek Sehat
```

------------------------------------------------------------------------

## Skenario 4 --- Verifikasi

Mahasiswa menekan:

``` text
VERIFY BLOCKCHAIN
```

Sistem menampilkan:

``` text
✓ Blockchain Valid
✓ Semua hash sesuai
✓ Tidak ditemukan perubahan
```

------------------------------------------------------------------------

## Skenario 5 --- Simulasi Serangan

Mahasiswa mengubah data Block 1 secara langsung.

Kemudian klik:

``` text
VERIFY BLOCKCHAIN
```

Sistem menampilkan:

``` text
✗ Blockchain Invalid
✗ Hash tidak sesuai
✗ Previous Hash tidak sesuai
```

------------------------------------------------------------------------

# 22. Tampilan Dashboard yang Disarankan

``` text
┌─────────────────────────────────────────────┐
│       HEALTHCARE BLOCKCHAIN                 │
├─────────────────────────────────────────────┤
│                                             │
│  Total Obat              25                 │
│  Total Transaksi         87                 │
│  Total Block             88                 │
│                                             │
│  Blockchain Status: ✓ VALID                 │
│                                             │
├─────────────────────────────────────────────┤
│  [Tambah Obat] [Tambah Transaksi]           │
│  [Lihat Blockchain] [Verifikasi]            │
├─────────────────────────────────────────────┤
│                                             │
│  RIWAYAT OBAT                               │
│                                             │
│  DRG-001                                    │
│  Paracetamol 500 mg                         │
│                                             │
│  ✓ Manufactured                            │
│  ✓ Shipped                                 │
│  ✓ Received                                │
│  ✓ Dispensed                               │
│                                             │
└─────────────────────────────────────────────┘
```

------------------------------------------------------------------------

# 23. Pertanyaan Diskusi

Mahasiswa dapat diberikan pertanyaan:

### Pertanyaan 1

Mengapa data transaksi perlu diberi hash?

### Pertanyaan 2

Apa yang terjadi jika data pada Block 2 diubah?

### Pertanyaan 3

Mengapa blockchain membutuhkan previous hash?

### Pertanyaan 4

Apa perbedaan blockchain dengan SQLite?

### Pertanyaan 5

Apakah blockchain menjamin data yang dimasukkan selalu benar?

Jawaban penting:

> **Tidak. Blockchain dapat menjaga integritas record setelah dicatat,
> tetapi tidak otomatis menjamin kebenaran data pada saat pertama kali
> dimasukkan.**

### Pertanyaan 6

Mengapa data pasien tidak sebaiknya langsung dimasukkan ke public
blockchain?

### Pertanyaan 7

Apa keuntungan menggunakan smart contract?

### Pertanyaan 8

Apa perbedaan custom blockchain dengan Ethereum?

------------------------------------------------------------------------

# 24. Kesimpulan

Simulasi ini memperlihatkan bahwa blockchain dapat digunakan sebagai
mekanisme untuk membangun:

``` text
TRUST
   +
TRANSPARENCY
   +
TRACEABILITY
   +
AUDITABILITY
```

Dalam konteks kesehatan, contoh penerapannya adalah:

``` text
Produsen
   ↓
Distributor
   ↓
Apotek
   ↓
Pasien
```

Setiap aktivitas menghasilkan record yang dapat diverifikasi.

Namun, implementasi nyata harus memperhatikan:

-   privasi pasien;
-   keamanan;
-   regulasi kesehatan;
-   kontrol akses;
-   kualitas data;
-   integrasi dengan sistem rumah sakit;
-   skalabilitas;
-   governance.

------------------------------------------------------------------------

# 25. Inti Pembelajaran

Mahasiswa sebaiknya memahami bahwa:

> **Blockchain bukan sekadar tempat menyimpan data. Blockchain adalah
> mekanisme untuk membangun kepercayaan terhadap catatan transaksi yang
> dibagikan oleh beberapa pihak.**

Dalam simulasi:

``` text
SQLite
    ↓
Operational Data

Blockchain
    ↓
Trusted Transaction History

Solidity
    ↓
Contoh Smart Contract
```

Ketiga komponen tersebut dapat dipelajari secara terpisah dan kemudian
diintegrasikan untuk memahami arsitektur aplikasi blockchain yang lebih
realistis.
