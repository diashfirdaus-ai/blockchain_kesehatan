# 📚 Panduan Edukasi: Mengapa Pelacakan (Tracing) Obat Berbasis Blockchain Sangat Presisi?

Dokumen ini berisi panduan teknis dan konseptual mengenai cara kerja pelacakan (*tracing*) berbasis batch dalam rantai pasok obat menggunakan teknologi Blockchain.

---

## 💡 Jawaban Pertanyaan Kunci Mahasiswa

### ❓ Pertanyaan: "Apakah urutan block di Blockchain bisa bercampur dan tidak rapi?"
> **Jawaban:** **Ya, benar sekali!** 
> Di blockchain publik (seperti Ethereum), urutan block di tingkat global memang **bercampur** (*interleaved*). Block #100 bisa berisi transaksi NFT, Block #101 berisi transaksi Obat kita, Block #102 berisi transfer ETH/Crypto lain.
> 
> Namun, **Tracing tetap 100% rapi dan presisi** di tingkat aplikasi karena sistem menyaring (*filter*) data berdasarkan **Smart Contract Address** dan **Indexed Batch ID**.

---

## 🎯 3 Pilar Utama: Mengapa Tracing Bisa Dilakukan Per-Batch?

Mengapa sistem dapat menelusuri perjalanan obat secara presisi untuk setiap nomor batch dari Pabrik hingga Pasien?

### 1️⃣ Identifikasi Unik (*Unique Batch Identifier*)
* **Kode Obat & Batch:** Setiap produk diasosiasikan dengan Kode Obat (`drug_code`) dan Nomor Batch (`batch_number`), misalnya `SIM-001` dengan `BATCH-A-2026`.
* **Primary Key Logis:** Nomor Batch ini menjadi pengikat utama yang menghubungkan seluruh transaksi dari Pabrik, Distributor, Apotek, hingga Pasien.

### 2️⃣ Keterikatan Data pada Block (*Block Payload Binding*)
* **1 Batch = 1 Block Transaksi:** Ketika transaksi batch dilakukan (misalnya 3 batch dikirim sekaligus), sistem secara otomatis memecahnya menjadi **1 block transaksi unik per batch**.
* **Audit Trail Mandiri:** Setiap batch memiliki rekam jejak (*audit trail*) tersendiri yang tercatat secara permanen dan tidak dapat dimanipulasi.

### 3️⃣ Keamanan Kriptografi (*Cryptographic Linkage*)
* **Rantai Hash SHA-256:** Setiap block transaksi selalu mengunci nilai `previousHash` dari block sebelumnya.
* **Verifikasi Kronologis:** Saat dilakukan tracing, sistem mengurutkan block secara kronologis dan memverifikasi keaslian hash dari awal produksi hingga konsumen akhir.

---

## 🔀 Mengapa Tetap Bisa Di-Trace Meskipun Block-nya Bercampur?

Di dalam blockchain nyata, block transaksi dari berbagai batch obat maupun jenis transaksi lain dimasukkan secara bergantian (bercampur):

* **Block #1:** Produksi Batch A (Paracetamol)
* **Block #2:** Transaksi NFT / Crypto Lain
* **Block #3:** Produksi Batch B (Amoxicillin)
* **Block #4:** Pengiriman Batch A
* **Block #5:** Penyerahan Batch A ke Pasien

Bagaimana sistem melacak **Batch A** tanpa tertukar dengan transaksi lain?

1. **Filtering Metadata Logis:** Ketika pengguna memilih Batch A (`SIM-001`), sistem memfilter seluruh rantai block dan hanya mengambil block yang memuat identitas Batch A.
2. **Rekonstruksi Rantai Kronologis:** Sistem mengikuti stempel waktu (*timestamp*) dan sambungan hash dari Batch A untuk menyusun kembali garis waktu (*timeline*) secara utuh dari awal hingga akhir.

---

## 🏦 Analogi 1: Buku Catatan Bank & Rekening Koran

> **Ibarat Rekening Koran Bank:**
> Di buku kas umum bank, transaksi ribuan nasabah dicatat bercampur dalam satu buku besar berdasarkan urutan detik kejadian. Namun ketika Anda meminta **Cetak Rekening Koran**, sistem bank hanya menyaring dan mencetak riwayat transaksi milik Anda saja dari awal sampai akhir secara rapi.
>
> **Keunggulan Blockchain:** Setiap halaman catatan buku kas tersebut dikunci dengan sandi kriptografi SHA-256 sehingga tidak ada satu pun transaksi yang bisa diubah, disisipkan, atau dihapus secara ilegal.

---

## 🌐 Jaringan Raksasa Ethereum: Bagaimana Melacak 1 Obat di Antara Jutaan Transaksi?

Di public blockchain seperti Ethereum, transaksi obat kita bercampur dengan jutaan transaksi lain seperti transfer Crypto, NFT, dan Smart Contract dunia. Tracing tetap 100% instan dan akurat karena 3 teknologi ini:

### 📍 1. Smart Contract Address Unik
Setiap kontrak aplikasi memiliki alamat unik (seperti alamat rumah `0x1234...abcd`). Sistem tracing hanya memantau transaksi yang masuk ke alamat rumah tersebut, mengabaikan seluruh lalu lintas transaksi lain di dunia.

### 🏷️ 2. Fitur Label Pencari (*Indexed Events*)
Dalam kode smart contract, parameter `drugCode` diberi label penanda khusus (*Indexed Topic*). Fitur ini berfungsi seperti **Tag Index** pada perpustakaan digital, membuat proses pencarian riwayat obat menjadi sangat cepat (hitungan milidetik) tanpa harus memeriksa jutaan transaksi lain secara manual.

### 🌳 3. Struktur Pohon Data (*Merkle Patricia Trie*)
Ethereum menyimpan data dalam struktur pohon data mutakhir. Saat dipanggil query data batch obat, sistem langsung menunjuk ke lokasi memori penyimpanan batch tersebut secara presisi.

---

## 🚚 Analogi 2: Gerbong Kereta Api Barang & GPS Truk Obat

> **Ibarat Gerbong Kereta Api Barang:**
> Bayangkan satu rangkaian kereta api memiliki 100 gerbong:
> - Gerbong 1: Berisi NFT
> - Gerbong 2: Berisi Obat Paracetamol (Batch A)
> - Gerbong 3: Berisi Sepatu
> - Gerbong 4: Berisi Obat Paracetamol (Batch A pengiriman distributor)
> 
> **Apakah petugas logistik obat kebingungan?**
> **Tidak.** Petugas hanya memeriksa dan mencatat gerbong berlabel "PT Farma - Batch A", lalu menyusun catatannya di laporan pelacakan obat. Urutan gerbong global boleh bercampur, tetapi Laporan Pelacakan Obat tetap rapi dan urut dari Pabrik → Distributor → Pasien.