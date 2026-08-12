// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title HealthcareDrugTracking
 * @dev Smart Contract untuk sistem pelacakan distribusi obat
 *
 * CATATAN PENTING:
 * Smart contract ini TIDAK digunakan dalam simulasi utama.
 * File ini disertakan sebagai contoh referensi pembelajaran Solidity.
 * Tujuannya agar mahasiswa dapat membandingkan:
 *   - Custom blockchain (JavaScript/Node.js) vs
 *   - Smart contract pada Ethereum (Solidity)
 *
 * Untuk menjalankan smart contract ini secara nyata, dibutuhkan:
 *   - Node Ethereum (seperti Hardhat, Truffle, atau Remix IDE)
 *   - Akun Ethereum dengan ETH untuk gas fee
 *   - Koneksi ke jaringan Ethereum (testnet atau mainnet)
 */
contract HealthcareDrugTracking {

    // ─── Struct ──────────────────────────────────────────────────────────────

    /**
     * @dev Data obat yang terdaftar
     */
    struct Drug {
        string  drugCode;
        string  drugName;
        string  batchNumber;
        address creator;        // Alamat Ethereum produsen
        uint256 createdAt;      // Unix timestamp
        bool    exists;
    }

    /**
     * @dev Event/transaksi dalam perjalanan obat
     */
    struct DrugEvent {
        string  action;         // MANUFACTURED, SHIPPED, RECEIVED, DISTRIBUTED, DISPENSED
        string  location;       // Lokasi kejadian
        string  notes;          // Catatan tambahan
        uint256 timestamp;      // Unix timestamp
        address actor;          // Alamat Ethereum aktor
    }

    // ─── State Variables ─────────────────────────────────────────────────────

    address public owner;       // Pemilik/admin smart contract

    // Mapping: drugCode => Drug
    mapping(string => Drug) public drugs;

    // Mapping: drugCode => array of DrugEvent
    mapping(string => DrugEvent[]) private drugEvents;

    // Daftar semua kode obat (untuk iterasi)
    string[] public drugCodes;

    // ─── Events ──────────────────────────────────────────────────────────────

    event DrugRegistered(
        string  indexed drugCode,
        string  drugName,
        string  batchNumber,
        address indexed creator,
        uint256 timestamp
    );

    event DrugEventRecorded(
        string  indexed drugCode,
        string  action,
        string  location,
        address indexed actor,
        uint256 timestamp
    );

    // ─── Modifiers ───────────────────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "Hanya owner yang dapat melakukan aksi ini");
        _;
    }

    modifier drugExists(string memory _drugCode) {
        require(drugs[_drugCode].exists, "Obat tidak terdaftar");
        _;
    }

    // ─── Constructor ─────────────────────────────────────────────────────────

    constructor() {
        owner = msg.sender;
    }

    // ─── Functions ───────────────────────────────────────────────────────────

    /**
     * @dev Mendaftarkan obat baru ke blockchain
     * @param _drugCode    Kode unik obat (contoh: DRG-001)
     * @param _drugName    Nama obat (contoh: Paracetamol 500 mg)
     * @param _batchNumber Nomor batch produksi
     */
    function registerDrug(
        string memory _drugCode,
        string memory _drugName,
        string memory _batchNumber
    ) public {
        require(!drugs[_drugCode].exists, "Obat sudah terdaftar");
        require(bytes(_drugCode).length > 0,    "drugCode tidak boleh kosong");
        require(bytes(_drugName).length > 0,    "drugName tidak boleh kosong");
        require(bytes(_batchNumber).length > 0, "batchNumber tidak boleh kosong");

        drugs[_drugCode] = Drug({
            drugCode:    _drugCode,
            drugName:    _drugName,
            batchNumber: _batchNumber,
            creator:     msg.sender,
            createdAt:   block.timestamp,
            exists:      true
        });

        drugCodes.push(_drugCode);

        // Catat event MANUFACTURED otomatis
        drugEvents[_drugCode].push(DrugEvent({
            action:    "MANUFACTURED",
            location:  "Pabrik",
            notes:     "Obat selesai diproduksi",
            timestamp: block.timestamp,
            actor:     msg.sender
        }));

        emit DrugRegistered(_drugCode, _drugName, _batchNumber, msg.sender, block.timestamp);
    }

    /**
     * @dev Mencatat event distribusi obat (SHIPPED, RECEIVED, DISTRIBUTED, DISPENSED)
     * @param _drugCode  Kode obat
     * @param _action    Jenis aksi distribusi
     * @param _location  Lokasi kejadian
     * @param _notes     Catatan tambahan
     */
    function recordDrugEvent(
        string memory _drugCode,
        string memory _action,
        string memory _location,
        string memory _notes
    ) public drugExists(_drugCode) {

        drugEvents[_drugCode].push(DrugEvent({
            action:    _action,
            location:  _location,
            notes:     _notes,
            timestamp: block.timestamp,
            actor:     msg.sender
        }));

        emit DrugEventRecorded(_drugCode, _action, _location, msg.sender, block.timestamp);
    }

    /**
     * @dev Mendapatkan jumlah event untuk suatu obat
     * @param _drugCode Kode obat
     * @return Jumlah event
     */
    function getDrugEventCount(string memory _drugCode)
        public view drugExists(_drugCode)
        returns (uint256)
    {
        return drugEvents[_drugCode].length;
    }

    /**
     * @dev Mendapatkan detail event tertentu
     * @param _drugCode   Kode obat
     * @param _eventIndex Index event (0-based)
     * @return action, location, notes, timestamp, actor
     */
    function getDrugEvent(string memory _drugCode, uint256 _eventIndex)
        public view drugExists(_drugCode)
        returns (
            string  memory action,
            string  memory location,
            string  memory notes,
            uint256        timestamp,
            address        actor
        )
    {
        require(_eventIndex < drugEvents[_drugCode].length, "Index event tidak valid");
        DrugEvent memory e = drugEvents[_drugCode][_eventIndex];
        return (e.action, e.location, e.notes, e.timestamp, e.actor);
    }

    /**
     * @dev Mendapatkan total obat yang terdaftar
     * @return Jumlah obat
     */
    function getTotalDrugs() public view returns (uint256) {
        return drugCodes.length;
    }
}
