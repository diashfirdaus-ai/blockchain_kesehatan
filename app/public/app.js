// ─── Config ────────────────────────────────────────────────────────────────────
const API = "";   // Relative URL — served by Express

// ─── State ─────────────────────────────────────────────────────────────────────
let allDrugs    = [];
let allUsers    = [];
let currentPage = "dashboard";
let isTampered  = false;
let isSimulating = false;

// ─── Skenario Simulasi (Wave / Batch) ─────────────────────────────────────────
//
//  PRODUSEN
//     │
//  ┌──┼──┐
//  │  │  │
//  ▼  ▼  ▼
//  A  B  C  ← MANUFACTURED (semua batch bersamaan)
//  │  │  │
//  ▼  ▼  ▼
//  SHIPPED   ← semua batch dikirim bersamaan
//  │  │  │
//  ▼  ▼  ▼
//  RECEIVED  ← semua batch diterima distributor bersamaan
//  │  │  │
//  ▼  ▼  ▼
//  DISTRIBUTED → RECEIVED (Apotek) → DISPENSED
//
const SIMULATION_SCENARIO = {
  // 3 obat yang akan dibuat sekaligus (Batch A, B, C)
  drugs: [
    {
      drugCode: "SIM-001", drugName: "Paracetamol 500 mg",  batchNumber: "BATCH-A-2026",
      manufacturer: "PT Farma Indonesia", productionDate: "2026-01-15", expiryDate: "2028-01-15",
      location: "Pabrik PT Farma — Bandung",
    },
    {
      drugCode: "SIM-002", drugName: "Amoxicillin 500 mg",  batchNumber: "BATCH-B-2026",
      manufacturer: "PT Farma Indonesia", productionDate: "2026-01-15", expiryDate: "2027-08-15",
      location: "Pabrik PT Farma — Bandung",
    },
    {
      drugCode: "SIM-003", drugName: "Vitamin C 1000 mg",   batchNumber: "BATCH-C-2026",
      manufacturer: "PT Farma Indonesia", productionDate: "2026-01-15", expiryDate: "2028-06-15",
      location: "Pabrik PT Farma — Bandung",
    },
  ],

  // Gelombang (wave) transaksi — setiap wave diproses bersamaan untuk semua obat
  waves: [
    {
      label: "🚚 Wave 1 — Semua Batch Dikirim ke Distributor",
      action: "SHIPPED",
      actorRole: "manufacturer",
      locations: [
        "Bandung → Jakarta (Batch A)",
        "Bandung → Jakarta (Batch B)",
        "Bandung → Jakarta (Batch C)",
      ],
      notes: [
        "Pengiriman Batch A PCM ke pusat distribusi Jakarta",
        "Pengiriman Batch B AMX ke pusat distribusi Jakarta",
        "Pengiriman Batch C VTC ke pusat distribusi Jakarta",
      ],
    },
    {
      label: "📥 Wave 2 — Semua Batch Diterima Distributor",
      action: "RECEIVED",
      actorRole: "distributor",
      locations: [
        "Gudang Distributor ABC — Jakarta",
        "Gudang Distributor ABC — Jakarta",
        "Gudang Distributor ABC — Jakarta",
      ],
      notes: [
        "Batch A diterima, stok diverifikasi",
        "Batch B diterima, stok diverifikasi",
        "Batch C diterima, stok diverifikasi",
      ],
    },
    {
      label: "📦 Wave 3 — Semua Batch Didistribusikan ke Apotek",
      action: "DISTRIBUTED",
      actorRole: "distributor",
      locations: [
        "Jakarta → Apotek Sehat (Batch A)",
        "Jakarta → Apotek Sehat (Batch B)",
        "Jakarta → Apotek Sehat (Batch C)",
      ],
      notes: [
        "Distribusi Batch A ke jaringan apotek Jakarta",
        "Distribusi Batch B ke jaringan apotek Jakarta",
        "Distribusi Batch C ke jaringan apotek Jakarta",
      ],
    },
    {
      label: "🏪 Wave 4 — Semua Batch Diterima Apotek",
      action: "RECEIVED",
      actorRole: "pharmacy",
      locations: [
        "Apotek Sehat — Jakarta",
        "Apotek Sehat — Jakarta",
        "Apotek Sehat — Jakarta",
      ],
      notes: [
        "Batch A masuk stok apotek, siap diserahkan",
        "Batch B masuk stok apotek, siap diserahkan",
        "Batch C masuk stok apotek, siap diserahkan",
      ],
    },
    {
      label: "💊 Wave 5 — Semua Batch Diserahkan ke Pasien",
      action: "DISPENSED",
      actorRole: "pharmacy",
      locations: [
        "Apotek Sehat — Jakarta",
        "Apotek Sehat — Jakarta",
        "Apotek Sehat — Jakarta",
      ],
      notes: [
        "Paracetamol diserahkan kepada pasien",
        "Amoxicillin diserahkan kepada pasien",
        "Vitamin C diserahkan kepada pasien",
      ],
    },
  ],
};


// ─── Navigasi ──────────────────────────────────────────────────────────────────
function navigate(page) {
  // Sembunyikan semua page
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".nav-link").forEach(l => l.classList.remove("active"));

  // Tampilkan page yang dipilih
  const pageEl = document.getElementById(`page-${page}`);
  const navEl  = document.getElementById(`nav-${page}`);
  if (pageEl) pageEl.classList.add("active");
  if (navEl)  navEl.classList.add("active");

  currentPage = page;

  // Load data sesuai halaman
  switch (page) {
    case "dashboard":   loadDashboard(); break;
    case "drugs":       loadDrugs(); loadUsersIntoSelects(); break;
    case "transactions":loadUsersIntoSelects(); loadDrugsIntoSelect(); break;
    case "tracing":     loadTracingPage(); break;
    case "explorer":    loadExplorer(); break;
    case "verify":      break; // manual trigger
    case "tamper":      break;
    case "contract":    renderSolidityCode(); break;
    case "penjelasan":  loadPenjelasanPage(); break;
  }
}

async function loadPenjelasanPage() {
  const container = document.getElementById("penjelasan-content");
  if (!container) return;

  try {
    const res = await fetch(API + "/api/penjelasan");
    if (!res.ok) throw new Error("Gagal mengambil file materi penjelasan");
    const text = await res.text();
    
    // Pastikan marked memparse text markdown dengan rapi
    if (typeof marked !== "undefined" && marked.parse) {
      container.innerHTML = marked.parse(text);
    } else {
      container.innerText = text;
    }
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">❌</div><h3>Gagal memuat materi</h3><p>${err.message}</p></div>`;
  }
}

// ─── Fetch Helper ──────────────────────────────────────────────────────────────
async function apiFetch(url, options = {}) {
  try {
    const res = await fetch(API + url, {
      headers: { "Content-Type": "application/json", ...options.headers },
      ...options,
    });

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      const text = await res.text();
      throw new Error(`Respons server bukan JSON (HTTP ${res.status}). Rute mungkin belum tersedia.`);
    }

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || `Error ${res.status}`);
    return data;
  } catch (err) {
    throw err;
  }
}

// ─── Dashboard ─────────────────────────────────────────────────────────────────
async function loadDashboard() {
  try {
    const data = await apiFetch("/api/drugs/stats/summary");
    const d = data.data;

    animateCounter("stat-drugs",  d.totalDrugs);
    animateCounter("stat-tx",     d.totalTx);
    animateCounter("stat-blocks", d.totalBlocks);
    animateCounter("stat-users",  d.totalUsers);

    renderRecentTx(d.recentTx || []);
    await updateChainStatusBadge();
  } catch (err) {
    showToast("Gagal memuat dashboard: " + err.message, "error");
  }
}

function animateCounter(elId, target) {
  const el = document.getElementById(elId);
  if (!el) return;
  let current = 0;
  const step  = Math.max(1, Math.floor(target / 30));
  const timer = setInterval(() => {
    current = Math.min(current + step, target);
    el.textContent = current;
    if (current >= target) clearInterval(timer);
  }, 30);
}

function renderRecentTx(txList) {
  const el = document.getElementById("recent-tx-list");
  if (!el) return;

  if (!txList.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div><h3>Belum ada transaksi</h3></div>`;
    return;
  }

  el.innerHTML = txList.map(tx => `
    <div style="display:flex;align-items:center;gap:0.75rem;padding:0.85rem 1.25rem;border-bottom:1px solid rgba(79,172,254,0.06);">
      <div style="width:36px;height:36px;border-radius:9px;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:rgba(79,172,254,0.1);font-size:1rem;">
        ${actionEmoji(tx.action)}
      </div>
      <div style="flex:1;min-width:0;">
        <div style="font-weight:700;font-size:0.88rem;color:var(--text-primary);">${tx.drug_name}</div>
        <div style="font-size:0.75rem;color:var(--text-secondary);">${tx.drug_code} · ${tx.actor_name}</div>
      </div>
      <div style="text-align:right;flex-shrink:0;">
        <span class="badge badge-${tx.action.toLowerCase()}">${tx.action}</span>
        <div style="font-size:0.7rem;color:var(--text-muted);margin-top:0.2rem;">${formatDate(tx.created_at)}</div>
      </div>
    </div>
  `).join("");
}

async function updateChainStatusBadge() {
  try {
    const res = await apiFetch("/api/blockchain/verify/chain");
    const badge    = document.getElementById("chain-status-badge");
    const text     = document.getElementById("chain-status-text");
    const statusBarTitle = document.getElementById("status-bar-title");
    const statusBarMsg   = document.getElementById("status-bar-msg");
    const statusBarIcon  = document.getElementById("status-bar-icon");

    if (res.valid) {
      badge.className = "nav-status valid";
      text.textContent = "Valid";
      if (statusBarTitle) { statusBarTitle.textContent = "✅ Blockchain Valid"; statusBarMsg.textContent = res.message; statusBarIcon.textContent = "✅"; }
    } else {
      badge.className = "nav-status invalid";
      text.textContent = "Invalid";
      if (statusBarTitle) { statusBarTitle.textContent = "❌ Blockchain Invalid"; statusBarMsg.textContent = res.message; statusBarIcon.textContent = "❌"; }
    }
  } catch (_) {}
}

// ─── Drugs ─────────────────────────────────────────────────────────────────────
async function loadDrugs() {
  try {
    const data = await apiFetch("/api/drugs");
    allDrugs   = data.data || [];
    renderDrugList(allDrugs);
  } catch (err) {
    showToast("Gagal memuat data obat: " + err.message, "error");
  }
}

function renderDrugList(drugs) {
  const el = document.getElementById("drug-list");
  if (!el) return;

  if (!drugs.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">💊</div><h3>Belum ada obat</h3><p>Tambahkan obat pertama di form sebelah kiri</p></div>`;
    return;
  }

  el.innerHTML = drugs.map(d => `
    <div class="drug-item" onclick="showDrugHistory('${d.drug_code}')">
      <div class="drug-item-icon">💊</div>
      <div class="drug-item-info">
        <div class="drug-item-name">${d.drug_name}</div>
        <div class="drug-item-meta">
          <span class="mono">${d.drug_code}</span> · Batch: ${d.batch_number}
          ${d.manufacturer ? `· ${d.manufacturer}` : ""}
        </div>
        <div class="drug-item-meta" style="margin-top:0.2rem;">
          <span class="badge badge-${(d.status||'manufactured').toLowerCase()}">${d.status || 'MANUFACTURED'}</span>
          <span style="margin-left:0.5rem;">${d.transaction_count} transaksi</span>
        </div>
      </div>
      <div class="drug-item-actions">
        <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); showDrugHistory('${d.drug_code}')">📋 Riwayat</button>
      </div>
    </div>
  `).join("");
}

function filterDrugs() {
  const q     = document.getElementById("drug-search").value.toLowerCase();
  const found = allDrugs.filter(d =>
    d.drug_name.toLowerCase().includes(q) ||
    d.drug_code.toLowerCase().includes(q) ||
    (d.batch_number || "").toLowerCase().includes(q)
  );
  renderDrugList(found);
}

async function submitAddDrug(e) {
  e.preventDefault();
  const btn = document.getElementById("btn-add-drug");
  setLoading(btn, true, "Membuat Block...");

  const body = {
    drugCode:       val("d-code"),
    drugName:       val("d-name"),
    batchNumber:    val("d-batch"),
    manufacturer:   val("d-mfr"),
    productionDate: val("d-prod"),
    expiryDate:     val("d-exp"),
    location:       val("d-loc"),
    actorId:        val("d-actor") || undefined,
  };

  try {
    const res = await apiFetch("/api/drugs", { method: "POST", body: JSON.stringify(body) });
    showToast(`✅ Obat "${res.data.drug_name}" berhasil didaftarkan! Block #${res.block.index} dibuat.`, "success");
    document.getElementById("form-add-drug").reset();
    await loadDrugs();
    await updateChainStatusBadge();
  } catch (err) {
    showToast("Gagal: " + err.message, "error");
  } finally {
    setLoading(btn, false, "⛓️ Daftarkan & Buat Block");
  }
}

async function showDrugHistory(code) {
  const card  = document.getElementById("drug-history-card");
  const title = document.getElementById("drug-history-title");
  const body  = document.getElementById("drug-history-content");

  card.style.display = "block";
  body.innerHTML     = `<div style="text-align:center;padding:2rem;"><div class="spinner" style="width:32px;height:32px;border-width:3px;"></div></div>`;
  title.textContent  = `📦 Memuat riwayat...`;

  // Scroll ke card
  card.scrollIntoView({ behavior: "smooth", block: "start" });

  try {
    const data = await apiFetch(`/api/drugs/${code}/history`);
    const { drug, history } = data.data;

    title.textContent = `📦 ${drug.drug_name} (${drug.drug_code})`;

    if (!history.length) {
      body.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div><h3>Belum ada transaksi</h3></div>`;
      return;
    }

    const infoHtml = `
      <div style="display:flex;flex-wrap:wrap;gap:1.5rem;margin-bottom:1.5rem;background:rgba(5,11,20,0.6);border:1px solid var(--border);border-radius:var(--radius);padding:1rem 1.25rem;">
        <div><div style="font-size:0.72rem;color:var(--text-muted);font-weight:700;text-transform:uppercase;margin-bottom:0.2rem;">Kode Obat</div><div class="mono" style="color:var(--accent-blue);">${drug.drug_code}</div></div>
        <div><div style="font-size:0.72rem;color:var(--text-muted);font-weight:700;text-transform:uppercase;margin-bottom:0.2rem;">Nama</div><div style="font-weight:700;">${drug.drug_name}</div></div>
        <div><div style="font-size:0.72rem;color:var(--text-muted);font-weight:700;text-transform:uppercase;margin-bottom:0.2rem;">Batch</div><div class="mono">${drug.batch_number}</div></div>
        <div><div style="font-size:0.72rem;color:var(--text-muted);font-weight:700;text-transform:uppercase;margin-bottom:0.2rem;">Status</div><span class="badge badge-${(drug.status||'manufactured').toLowerCase()}">${drug.status}</span></div>
        <div><div style="font-size:0.72rem;color:var(--text-muted);font-weight:700;text-transform:uppercase;margin-bottom:0.2rem;">Total Langkah</div><div style="font-weight:700;color:var(--accent-green);">${history.length}</div></div>
      </div>
    `;

    const timelineHtml = `
      <div class="timeline">
        ${history.map((tx, i) => `
          <div class="timeline-item">
            <div class="timeline-dot ${tx.action.toLowerCase()}"></div>
            <div class="timeline-content">
              <div class="timeline-header">
                <span class="badge badge-${tx.action.toLowerCase()}">${actionEmoji(tx.action)} ${tx.action}</span>
                <span class="timeline-time">${formatDate(tx.created_at)}</span>
              </div>
              <div class="timeline-actor">👤 ${tx.actor_name} <span class="role-badge role-${tx.actor_role}">${tx.actor_role}</span></div>
              ${tx.location ? `<div class="timeline-location">📍 ${tx.location}</div>` : ""}
              ${tx.notes    ? `<div class="timeline-notes">📝 ${tx.notes}</div>` : ""}
              ${tx.block_index != null ? `<div class="timeline-block-ref">⛓️ Block #${tx.block_index}</div>` : ""}
              ${tx.transaction_hash ? `<div style="margin-top:0.3rem;"><span class="hash hash-short" title="${tx.transaction_hash}">TX: ${tx.transaction_hash}</span></div>` : ""}
            </div>
          </div>
        `).join("")}
      </div>
    `;

    body.innerHTML = infoHtml + timelineHtml;
  } catch (err) {
    body.innerHTML = `<div class="empty-state"><div class="empty-icon">❌</div><h3>Gagal memuat riwayat</h3><p>${err.message}</p></div>`;
  }
}

function closeDrugHistory() {
  document.getElementById("drug-history-card").style.display = "none";
}

// ─── Users / Selects ───────────────────────────────────────────────────────────
async function loadUsersIntoSelects() {
  try {
    if (!allUsers.length) {
      const data = await apiFetch("/api/users");
      allUsers   = data.data || [];
    }
    populateUserSelect("d-actor",  allUsers);
    populateUserSelect("tx-actor", allUsers);
  } catch (_) {}
}

function populateUserSelect(selectId, users) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML  = `<option value="">— Pilih Pengguna —</option>` +
    users.map(u => `<option value="${u.id}" ${u.id == current ? "selected" : ""}>${u.name} (${u.role})</option>`).join("");
}

async function loadDrugsIntoSelect() {
  try {
    if (!allDrugs.length) {
      const data = await apiFetch("/api/drugs");
      allDrugs   = data.data || [];
    }

    // Populate fallback select
    const sel = document.getElementById("tx-drug");
    if (sel) {
      sel.innerHTML = `<option value="">— Pilih Obat —</option>` +
        allDrugs.map(d => `<option value="${d.drug_code}">${d.drug_name} (${d.drug_code})</option>`).join("");
    }

    // Populate trace select
    const traceSel = document.getElementById("trace-select");
    if (traceSel) {
      const curr = traceSel.value;
      traceSel.innerHTML = `<option value="">— Pilih Obat / Batch —</option>` +
        allDrugs.map(d => `<option value="${d.drug_code}" ${d.drug_code === curr ? 'selected' : ''}>${d.drug_name} (Code: ${d.drug_code} | Batch: ${d.batch_number})</option>`).join("");
    }

    // Populate batch checkbox list for multi-select transaction
    const container = document.getElementById("tx-batch-container");
    if (container) {
      if (!allDrugs.length) {
        container.innerHTML = `<div class="empty-state" style="padding:1rem;"><div class="empty-icon">💊</div><h3>Belum ada obat/batch</h3><p>Daftarkan obat terlebih dahulu di menu Obat</p></div>`;
      } else {
        container.innerHTML = allDrugs.map(d => `
          <label class="batch-checkbox-item">
            <input type="checkbox" name="tx-batch-checkbox" value="${d.drug_code}" onchange="updateSelectedBatchCount()" />
            <div class="batch-checkbox-label">
              <span><strong>${d.drug_name}</strong> (${d.drug_code})</span>
              <span class="badge badge-${(d.status||'manufactured').toLowerCase()}">Batch: ${d.batch_number}</span>
            </div>
          </label>
        `).join("");
      }
      updateSelectedBatchCount();
    }
  } catch (_) {}
}

function updateSelectedBatchCount() {
  const checkboxes = document.querySelectorAll('input[name="tx-batch-checkbox"]:checked');
  const countEl    = document.getElementById("selected-batch-count");
  if (countEl) {
    countEl.textContent = `${checkboxes.length} Batch Dipilih`;
  }
}

function toggleSelectAllBatches() {
  const checkboxes = document.querySelectorAll('input[name="tx-batch-checkbox"]');
  if (!checkboxes.length) return;
  const allChecked = Array.from(checkboxes).every(cb => cb.checked);

  checkboxes.forEach(cb => { cb.checked = !allChecked; });
  const btn = document.getElementById("btn-select-all-batches");
  if (btn) btn.textContent = !allChecked ? "❎ Batal Pilih Semua" : "☑️ Pilih Semua Batch";

  updateSelectedBatchCount();
}

// ─── Transactions (Batch Multi-Select) ────────────────────────────────────────
async function submitAddTx(e) {
  e.preventDefault();
  const btn = document.getElementById("btn-add-tx");

  // Gathers all selected batch checkboxes
  const checkedNodes = document.querySelectorAll('input[name="tx-batch-checkbox"]:checked');
  let selectedCodes  = Array.from(checkedNodes).map(cb => cb.value);

  // Fallback to select if no checkboxes are available or checked
  if (!selectedCodes.length) {
    const singleCode = val("tx-drug");
    if (singleCode) selectedCodes.push(singleCode);
  }

  if (!selectedCodes.length) {
    showToast("⚠️ Pilih minimal 1 batch / obat untuk dicatat!", "warning");
    return;
  }

  setLoading(btn, true, `Memproses ${selectedCodes.length} Batch...`);

  const body = {
    action:   val("tx-action"),
    actorId:  val("tx-actor"),
    location: val("tx-loc"),
    notes:    val("tx-notes"),
  };

  const results = [];
  const errors  = [];

  try {
    for (const drugCode of selectedCodes) {
      try {
        const res = await apiFetch(`/api/drugs/${drugCode}/transactions`, {
          method: "POST",
          body: JSON.stringify(body),
        });
        results.push({ code: drugCode, res });
      } catch (err) {
        errors.push({ code: drugCode, msg: err.message });
      }
    }

    if (results.length > 0) {
      showToast(`✅ Transaksi batch (${body.action}) berhasil! ${results.length} Block baru ditambahkan.`, "success");
      document.getElementById("form-add-tx").reset();
      // Uncheck batch checkboxes
      document.querySelectorAll('input[name="tx-batch-checkbox"]').forEach(cb => cb.checked = false);
      updateSelectedBatchCount();

      renderLastBlockBatch(results, body.action);
      await updateChainStatusBadge();
      allDrugs = []; // force refresh
    }

    if (errors.length > 0) {
      showToast(`⚠️ ${errors.length} batch gagal diproses`, "error");
    }
  } catch (err) {
    showToast("Gagal: " + err.message, "error");
  } finally {
    setLoading(btn, false, "⛓️ Catat & Buat Block (Batch)");
  }
}

function renderLastBlockBatch(results, action) {
  const el = document.getElementById("last-block-result");
  if (!el) return;

  const total = results.length;
  el.innerHTML = `
    <div style="background:var(--accent-green-lt);border:1px solid #86efac;border-radius:var(--radius);padding:1.25rem;">
      <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:1rem;">
        <div style="font-size:1.5rem;">⛓️</div>
        <div>
          <div style="font-weight:800;color:var(--accent-green);">${total} Block Berhasil Dibuat (Batch)!</div>
          <div style="font-size:0.8rem;color:var(--text-secondary);">Setiap batch menghasilkan 1 block unik di blockchain</div>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:0.6rem;max-height:300px;overflow-y:auto;padding-right:0.3rem;">
        ${results.map(({ code, res }) => `
          <div style="background:#fff;border:1px solid var(--border);border-radius:8px;padding:0.75rem;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.3rem;">
              <strong style="font-size:0.85rem;color:var(--text-primary);">${res.data.drug_name || code} (${code})</strong>
              <span class="block-index-badge" style="font-size:0.68rem;padding:0.15rem 0.5rem;">Block #${res.block.index}</span>
            </div>
            <div style="font-size:0.72rem;color:var(--text-muted);display:flex;justify-content:space-between;">
              <span>Aksi: <span class="badge badge-${action.toLowerCase()}">${action}</span></span>
              <span>Oleh: <strong>${res.data.actor_name}</strong></span>
            </div>
            <div style="font-size:0.68rem;margin-top:0.3rem;" class="hash">Hash: ${res.block.hash}</div>
          </div>
        `).join("")}
      </div>
      <button class="btn btn-ghost btn-sm" style="width:100%;margin-top:1rem;" onclick="navigate('explorer')">
        🔍 Lihat di Blockchain Explorer →
      </button>
    </div>
  `;
}

// ─── Tracing Feature (Produksi hingga Pasien) ──────────────────────────────────
async function loadTracingPage() {
  await loadDrugsIntoSelect();
  const select = document.getElementById("trace-select");
  if (select && select.value) {
    searchTrace();
  }
}

function onTraceSelectChange() {
  searchTrace();
}

async function searchTrace() {
  const code = val("trace-select");
  const container = document.getElementById("tracing-result-container");
  if (!container) return;

  if (!code) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔍</div>
        <h3>Pilih Obat untuk Memulai Tracing</h3>
        <p>Pilih salah satu kode obat di dropdown atas untuk melihat visual rantai pasok dari Produsen → Distributor → Apotek → Pasien.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `<div class="empty-state"><div class="spinner" style="width:40px;height:40px;border-width:3px;"></div><p style="margin-top:1rem;">Memuat data rekam jejak blockchain...</p></div>`;

  try {
    const res  = await apiFetch(`/api/drugs/${code}/history`);
    const data = res.data;
    renderTracingPipeline(data);
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">❌</div><h3>Gagal memuat rekam jejak</h3><p>${err.message}</p></div>`;
  }
}

function renderTracingPipeline({ drug, history }) {
  const container = document.getElementById("tracing-result-container");
  if (!container) return;

  // Categorize events into 4 stages:
  // 1. Produsen: MANUFACTURED
  // 2. Distributor: SHIPPED / RECEIVED (by distributor)
  // 3. Apotek: DISTRIBUTED / RECEIVED (by pharmacy)
  // 4. Pasien: DISPENSED

  const stage1 = history.find(h => h.action === "MANUFACTURED") || history[0];
  const stage2 = history.find(h => h.actor_role === "distributor" || h.action === "SHIPPED" || h.action === "RECEIVED");
  const stage3 = history.find(h => h.actor_role === "pharmacy" && (h.action === "DISTRIBUTED" || h.action === "RECEIVED"));
  const stage4 = history.find(h => h.action === "DISPENSED");

  // Determine active/completed states
  const isCompleted1 = !!stage1;
  const isCompleted2 = !!stage2;
  const isCompleted3 = !!stage3;
  const isCompleted4 = !!stage4;

  const currentStage = isCompleted4 ? 4 : (isCompleted3 ? 3 : (isCompleted2 ? 2 : 1));

  container.innerHTML = `
    <!-- Summary Header Card -->
    <div class="card mb-3">
      <div class="card-body" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
        <div>
          <div style="font-size:0.75rem; color:var(--text-muted); font-weight:700; text-transform:uppercase;">Obat / Batch Terlacak</div>
          <div style="font-size:1.25rem; font-weight:800; color:var(--text-primary); margin-top:0.1rem;">
            💊 ${drug.drug_name}
          </div>
          <div style="font-size:0.83rem; color:var(--text-secondary); margin-top:0.2rem;">
            Kode: <span class="mono" style="color:var(--accent-blue);">${drug.drug_code}</span> · Batch: <span class="mono">${drug.batch_number}</span> · Produsen: <strong>${drug.manufacturer || 'PT Farma Indonesia'}</strong>
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:0.75rem; color:var(--text-muted); font-weight:700; text-transform:uppercase; margin-bottom:0.2rem;">Status Rantai Pasok</div>
          <span class="badge badge-${(drug.status||'manufactured').toLowerCase()}" style="font-size:0.85rem; padding:0.35rem 0.85rem;">
            ${drug.status || 'MANUFACTURED'}
          </span>
          <div style="font-size:0.75rem; color:var(--accent-green); font-weight:700; margin-top:0.4rem;">
            ✅ Blockchain Valid (${history.length} Event Block)
          </div>
        </div>
      </div>
    </div>

    <!-- 4-Stage Supply Chain Stepper Pipeline -->
    <div class="section-title">📍 ALUR PROSES PASOKAN (PRODUKSI → PASIEN)</div>

    <div class="tracing-stepper">
      <!-- STAGE 1: PRODUSEN -->
      <div class="tracing-step-card ${isCompleted1 ? 'completed-stage' : 'pending-stage'}">
        <div class="tracing-step-header">
          <div class="tracing-step-icon">🏭</div>
          <div>
            <div class="tracing-step-title">1. PRODUSEN</div>
            <div class="tracing-step-role">Pabrik Farmasi</div>
          </div>
        </div>
        ${stage1 ? `
          <div class="tracing-detail-row"><strong>Pelaku:</strong> ${stage1.actor_name}</div>
          <div class="tracing-detail-row"><strong>Lokasi:</strong> ${stage1.location || 'Pabrik'}</div>
          <div class="tracing-detail-row"><strong>Waktu:</strong> ${formatDate(stage1.created_at)}</div>
          <div class="tracing-detail-row" style="margin-top:0.5rem;"><span class="badge badge-manufactured">MANUFACTURED</span></div>
          <div style="margin-top:0.5rem;"><span class="hash hash-short" title="${stage1.transaction_hash}">Block #${stage1.block_index}</span></div>
        ` : `
          <div style="font-size:0.78rem; color:var(--text-muted); font-style:italic;">Belum ada data produksi</div>
        `}
      </div>

      <!-- STAGE 2: DISTRIBUTOR -->
      <div class="tracing-step-card ${isCompleted2 ? 'completed-stage' : (currentStage === 2 ? 'active-stage' : 'pending-stage')}">
        <div class="tracing-step-header">
          <div class="tracing-step-icon">🚚</div>
          <div>
            <div class="tracing-step-title">2. DISTRIBUTOR</div>
            <div class="tracing-step-role">Logistik & Gudang</div>
          </div>
        </div>
        ${stage2 ? `
          <div class="tracing-detail-row"><strong>Pelaku:</strong> ${stage2.actor_name}</div>
          <div class="tracing-detail-row"><strong>Lokasi:</strong> ${stage2.location || 'Gudang Distribusi'}</div>
          <div class="tracing-detail-row"><strong>Waktu:</strong> ${formatDate(stage2.created_at)}</div>
          <div class="tracing-detail-row" style="margin-top:0.5rem;"><span class="badge badge-${stage2.action.toLowerCase()}">${stage2.action}</span></div>
          <div style="margin-top:0.5rem;"><span class="hash hash-short" title="${stage2.transaction_hash}">Block #${stage2.block_index}</span></div>
        ` : `
          <div style="font-size:0.78rem; color:var(--text-muted); font-style:italic;">Menunggu penerimaan distributor</div>
        `}
      </div>

      <!-- STAGE 3: APOTEK -->
      <div class="tracing-step-card ${isCompleted3 ? 'completed-stage' : (currentStage === 3 ? 'active-stage' : 'pending-stage')}">
        <div class="tracing-step-header">
          <div class="tracing-step-icon">🏪</div>
          <div>
            <div class="tracing-step-title">3. APOTEK</div>
            <div class="tracing-step-role">Fasilitas Kesehatan</div>
          </div>
        </div>
        ${stage3 ? `
          <div class="tracing-detail-row"><strong>Pelaku:</strong> ${stage3.actor_name}</div>
          <div class="tracing-detail-row"><strong>Lokasi:</strong> ${stage3.location || 'Apotek'}</div>
          <div class="tracing-detail-row"><strong>Waktu:</strong> ${formatDate(stage3.created_at)}</div>
          <div class="tracing-detail-row" style="margin-top:0.5rem;"><span class="badge badge-${stage3.action.toLowerCase()}">${stage3.action}</span></div>
          <div style="margin-top:0.5rem;"><span class="hash hash-short" title="${stage3.transaction_hash}">Block #${stage3.block_index}</span></div>
        ` : `
          <div style="font-size:0.78rem; color:var(--text-muted); font-style:italic;">Menunggu pengiriman ke apotek</div>
        `}
      </div>

      <!-- STAGE 4: PASIEN -->
      <div class="tracing-step-card ${isCompleted4 ? 'completed-stage' : (currentStage === 4 ? 'active-stage' : 'pending-stage')}">
        <div class="tracing-step-header">
          <div class="tracing-step-icon">👤</div>
          <div>
            <div class="tracing-step-title">4. PASIEN</div>
            <div class="tracing-step-role">Konsumen Akhir</div>
          </div>
        </div>
        ${stage4 ? `
          <div class="tracing-detail-row"><strong>Pelaku:</strong> ${stage4.actor_name}</div>
          <div class="tracing-detail-row"><strong>Status:</strong> DISPENSED (Diberikan)</div>
          <div class="tracing-detail-row"><strong>Waktu:</strong> ${formatDate(stage4.created_at)}</div>
          <div class="tracing-detail-row" style="margin-top:0.5rem;"><span class="badge badge-dispensed">DISPENSED</span></div>
          <div style="margin-top:0.5rem;"><span class="hash hash-short" title="${stage4.transaction_hash}">Block #${stage4.block_index}</span></div>
        ` : `
          <div style="font-size:0.78rem; color:var(--text-muted); font-style:italic;">Obat belum diserahkan ke pasien</div>
        `}
      </div>
    </div>

    <!-- Complete Transaction Timeline Audit Trail -->
    <div class="card mt-3">
      <div class="card-header">
        <h3>📋 Audit Trail Rekam Jejak Transaksi Blockchain (${history.length} Event)</h3>
      </div>
      <div class="card-body">
        <div class="timeline">
          ${history.map(tx => `
            <div class="timeline-item">
              <div class="timeline-dot ${tx.action.toLowerCase()}"></div>
              <div class="timeline-content">
                <div class="timeline-header">
                  <span class="badge badge-${tx.action.toLowerCase()}">${actionEmoji(tx.action)} ${tx.action}</span>
                  <span class="timeline-time">${formatDate(tx.created_at)}</span>
                </div>
                <div class="timeline-actor">👤 <strong>${tx.actor_name}</strong> <span class="role-badge role-${tx.actor_role}">${tx.actor_role}</span></div>
                ${tx.location ? `<div class="timeline-location">📍 ${tx.location}</div>` : ""}
                ${tx.notes    ? `<div class="timeline-notes">📝 ${tx.notes}</div>` : ""}
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:0.4rem; flex-wrap:wrap; gap:0.5rem;">
                  <span class="timeline-block-ref">⛓️ Block #${tx.block_index}</span>
                  <span class="hash" title="${tx.transaction_hash}">Hash: ${tx.transaction_hash}</span>
                </div>
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    </div>

    <!-- Action Bar / Tombol di Bagian Bawah Tracing -->
    <div class="card mt-3">
      <div class="card-body" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem; padding: 1.1rem 1.4rem;">
        <div style="font-size:0.85rem; color:var(--text-secondary);">
          ✅ Hasil rekam jejak untuk batch <strong class="mono" style="color:var(--text-primary);">${drug.batch_number}</strong> (${history.length} Event Block).
        </div>
        <div style="display:flex; gap:0.6rem; flex-wrap:wrap;">
          <button class="btn btn-outline btn-sm" onclick="window.scrollTo({top: 0, behavior: 'smooth'})">
            ⬆️ Ke Atas
          </button>
          <button class="btn btn-ghost btn-sm" onclick="navigate('transactions')">
            🔄 Catat Transaksi
          </button>
          <button class="btn btn-primary btn-sm" onclick="navigate('explorer')">
            🔍 Explorer
          </button>
          <button class="btn btn-warning btn-sm" onclick="window.print()">
            🖨️ Cetak Report
          </button>
        </div>
      </div>
    </div>
  `;
}


// ─── Blockchain Explorer ───────────────────────────────────────────────────────
async function loadExplorer() {
  const container = document.getElementById("blockchain-chain");
  const totalEl   = document.getElementById("explorer-total-blocks");
  const diffEl    = document.getElementById("explorer-difficulty");

  container.innerHTML = `<div class="empty-state"><div class="spinner" style="width:40px;height:40px;border-width:3px;"></div><p style="margin-top:1rem;">Memuat blockchain...</p></div>`;

  try {
    const res = await apiFetch("/api/blockchain");
    const { chain, length, difficulty } = res.data;

    if (totalEl) totalEl.textContent = length;
    if (diffEl)  diffEl.textContent  = difficulty;

    if (!chain.length) {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">⛓️</div><h3>Blockchain kosong</h3></div>`;
      return;
    }

    // Render chain dari bawah ke atas (terbaru di atas)
    const reversed = [...chain].reverse();
    const parts    = [];

    reversed.forEach((block, i) => {
      const isGenesis = block.index === 0;
      const dataStr   = JSON.stringify(block.data, null, 2);
      const isTamp    = block.data && block.data._TAMPERED;

      parts.push(`
        <div class="block-card ${isGenesis ? 'genesis' : ''} ${isTamp ? 'tampered' : ''}" style="animation-delay:${i * 0.07}s">
          <div class="block-header">
            <span class="block-index-badge">#${block.index}</span>
            <span class="block-title">${isGenesis ? '🌐 Genesis Block' : blockTitle(block.data)}</span>
            ${isTamp ? '<span class="badge" style="background:rgba(231,76,60,0.2);color:var(--accent-red);border-color:rgba(231,76,60,0.4);">⚠️ TAMPERED</span>' : ''}
            <span class="block-timestamp">${formatDate(block.timestamp)}</span>
          </div>
          <div class="block-body">
            <div class="block-field">
              <label>Hash</label>
              <span class="hash" style="word-break:break-all;font-size:0.7rem;">${block.hash}</span>
            </div>
            <div class="block-field">
              <label>Previous Hash</label>
              <span class="hash" style="word-break:break-all;font-size:0.7rem;">${block.previousHash}</span>
            </div>
            <div class="block-field">
              <label>Nonce</label>
              <span class="block-nonce">${block.nonce.toLocaleString()}</span>
            </div>
            <div class="block-field">
              <label>Timestamp</label>
              <span class="mono" style="font-size:0.75rem;color:var(--text-secondary);">${block.timestamp}</span>
            </div>
            <div class="block-field full">
              <label>Data Transaksi</label>
              <pre class="block-data-content">${escHtml(dataStr)}</pre>
            </div>
          </div>
        </div>
      `);

      // Konektor antar block (kecuali block terakhir yang ditampilkan)
      if (i < reversed.length - 1) {
        parts.push(`
          <div class="chain-connector">
            <div class="chain-connector-inner">
              <div class="chain-line"></div>
              <div class="chain-arrow-label">previousHash</div>
              <div class="chain-arrow">↑</div>
              <div class="chain-line" style="background:linear-gradient(to top,var(--accent-blue),transparent);"></div>
            </div>
          </div>
        `);
      }
    });

    container.innerHTML = parts.join("");
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">❌</div><h3>Gagal memuat</h3><p>${err.message}</p></div>`;
  }
}

function blockTitle(data) {
  if (!data) return "Block";
  if (data.action && data.drugCode) return `${actionEmoji(data.action)} ${data.action} · ${data.drugCode}`;
  if (data.message) return data.message;
  return "Block";
}

// ─── Verifikasi ────────────────────────────────────────────────────────────────
async function runVerify() {
  const btn     = document.getElementById("btn-verify");
  const icon    = document.getElementById("verify-icon");
  const status  = document.getElementById("verify-status");
  const message = document.getElementById("verify-message");
  const details = document.getElementById("verify-details");

  setLoading(btn, true, "Memverifikasi...");
  icon.textContent   = "🔍";
  status.className   = "verify-status";
  status.textContent = "Memverifikasi...";
  message.textContent = "Memeriksa integritas setiap block...";
  details.style.display = "none";

  try {
    const res = await apiFetch("/api/blockchain/verify/chain");

    if (res.valid) {
      icon.textContent    = "✅";
      status.className    = "verify-status valid";
      status.textContent  = "Blockchain Valid";
      message.textContent = res.message;
    } else {
      icon.textContent    = "❌";
      status.className    = "verify-status invalid";
      status.textContent  = "Blockchain Invalid!";
      message.textContent = res.message;
    }

    document.getElementById("vd-blocks").textContent    = res.totalBlocks;
    document.getElementById("vd-invalid-at").textContent = res.invalidAt != null ? `Block #${res.invalidAt}` : "—";
    details.style.display = "grid";

    await updateChainStatusBadge();
  } catch (err) {
    status.textContent  = "Error";
    message.textContent = err.message;
    showToast("Verifikasi gagal: " + err.message, "error");
  } finally {
    setLoading(btn, false, "🔍 Verifikasi Blockchain");
  }
}

// ─── Tamper Demo ───────────────────────────────────────────────────────────────
async function submitTamper(e) {
  e.preventDefault();
  const btn      = document.getElementById("btn-tamper");
  const resultEl = document.getElementById("tamper-result");

  const blockIndex = parseInt(val("tamper-block-idx"));
  const action     = val("tamper-action");
  const actor      = val("tamper-actor") || "Hacker";

  if (isNaN(blockIndex) || blockIndex < 1) {
    showToast("Block index harus ≥ 1 (Block 0 adalah genesis block)", "warning");
    return;
  }

  setLoading(btn, true, "Memanipulasi...");

  try {
    // Dapatkan data block asli dulu
    let originalBlock;
    try {
      const orig = await apiFetch(`/api/blockchain/${blockIndex}`);
      originalBlock = orig.data;
    } catch (_) {}

    // Lakukan tamper
    const res = await apiFetch("/api/blockchain/tamper", {
      method: "POST",
      body: JSON.stringify({ blockIndex, newData: { action, actor } }),
    });

    isTampered = true;
    showToast(`⚠️ Block #${blockIndex} berhasil dimanipulasi! Cek verifikasi untuk melihat hasilnya.`, "warning");

    // Render hasil
    resultEl.innerHTML = `
      <div class="tamper-warning" style="margin-bottom:1rem;">
        <span class="tw-icon">💥</span>
        <div class="tw-text">
          <h4>Block #${blockIndex} Telah Dimanipulasi!</h4>
          <p>Data block berhasil diubah. Blockchain sekarang dalam kondisi <strong>invalid</strong>.</p>
        </div>
      </div>
      <div class="comparison-grid">
        <div class="comparison-box before">
          <h4>✅ Data Asli</h4>
          <pre style="font-family:var(--font-mono);font-size:0.75rem;color:var(--accent-green);white-space:pre-wrap;word-break:break-all;">${escHtml(JSON.stringify(res.tamperInfo.original, null, 2))}</pre>
        </div>
        <div class="comparison-box after">
          <h4>💥 Data Setelah Manipulasi</h4>
          <pre style="font-family:var(--font-mono);font-size:0.75rem;color:var(--accent-red);white-space:pre-wrap;word-break:break-all;">${escHtml(JSON.stringify(res.tamperInfo.tampered, null, 2))}</pre>
        </div>
      </div>
      <div style="margin-top:1rem;display:flex;gap:0.75rem;flex-wrap:wrap;">
        <button class="btn btn-primary" onclick="navigate('verify'); setTimeout(runVerify, 300);">
          🔍 Jalankan Verifikasi →
        </button>
        <button class="btn btn-outline" onclick="navigate('explorer')">
          🔗 Lihat Explorer →
        </button>
      </div>
    `;

    await updateChainStatusBadge();
  } catch (err) {
    showToast("Gagal: " + err.message, "error");
  } finally {
    setLoading(btn, false, "💥 Manipulasi Block");
  }
}

async function restoreChain() {
  const btn = document.getElementById("btn-restore");
  setLoading(btn, true, "Memulihkan...");

  try {
    const res = await apiFetch("/api/blockchain/restore", { method: "POST" });
    isTampered = false;
    showToast(`✅ Blockchain berhasil dipulihkan! Total ${res.totalBlocks} block.`, "success");
    document.getElementById("tamper-result").innerHTML = `
      <div class="empty-state">
        <div class="empty-icon" style="opacity:1;">✅</div>
        <h3 style="color:var(--accent-green);">Blockchain Dipulihkan</h3>
        <p>Chain telah dikembalikan ke kondisi valid dari database.</p>
      </div>
    `;
    await updateChainStatusBadge();
  } catch (err) {
    showToast("Gagal restore: " + err.message, "error");
  } finally {
    setLoading(btn, false, "🔄 Restore Blockchain");
  }
}

// ─── Smart Contract Viewer ─────────────────────────────────────────────────────
function renderSolidityCode() {
  const el = document.getElementById("solidity-code");
  if (!el) return;

  const code = getSolidityCode();
  el.innerHTML = highlightSolidity(code);
}

function highlightSolidity(code) {
  return escHtml(code)
    // Comments
    .replace(/(\/\/[^\n]*)/g, '<span class="sol-comment">$1</span>')
    .replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="sol-comment">$1</span>')
    // Keywords
    .replace(/\b(pragma|contract|import|using|is|public|private|internal|external|view|pure|payable|returns|return|mapping|struct|event|modifier|require|emit|memory|storage|calldata|if|else|for|while|new|delete|true|false|this|msg|block|tx)\b/g, '<span class="sol-keyword">$1</span>')
    // Types
    .replace(/\b(uint256|uint|int256|int|bool|address|bytes32|bytes|string|address\[\])\b/g, '<span class="sol-type">$1</span>')
    // String literals
    .replace(/(&quot;[^&]*?&quot;)/g, '<span class="sol-string">$1</span>')
    // Numbers
    .replace(/\b(\d+)\b/g, '<span class="sol-number">$1</span>')
    // SPDX
    .replace(/(SPDX[^\n]*)/g, '<span class="sol-comment">$1</span>');
}

function getSolidityCode() {
  return `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title HealthcareDrugTracking
 * @dev Smart Contract untuk pelacakan distribusi obat
 *
 * CATATAN: File ini hanya referensi pembelajaran.
 * Tidak digunakan dalam simulasi utama (Node.js).
 */
contract HealthcareDrugTracking {

    // ─── Struct ──────────────────────────────────────────────
    struct Drug {
        string  drugCode;
        string  drugName;
        string  batchNumber;
        address creator;
        uint256 createdAt;
        bool    exists;
    }

    struct DrugEvent {
        string  action;
        string  location;
        string  notes;
        uint256 timestamp;
        address actor;
    }

    // ─── State Variables ─────────────────────────────────────
    address public owner;

    mapping(string => Drug)         public drugs;
    mapping(string => DrugEvent[])  private drugEvents;
    string[]                        public drugCodes;

    // ─── Events ──────────────────────────────────────────────
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

    // ─── Modifiers ───────────────────────────────────────────
    modifier onlyOwner() {
        require(msg.sender == owner,
            "Hanya owner yang dapat melakukan aksi ini");
        _;
    }

    modifier drugExists(string memory _drugCode) {
        require(drugs[_drugCode].exists, "Obat tidak terdaftar");
        _;
    }

    // ─── Constructor ─────────────────────────────────────────
    constructor() {
        owner = msg.sender;
    }

    // ─── Functions ───────────────────────────────────────────

    function registerDrug(
        string memory _drugCode,
        string memory _drugName,
        string memory _batchNumber
    ) public {
        require(!drugs[_drugCode].exists, "Obat sudah terdaftar");

        drugs[_drugCode] = Drug({
            drugCode:    _drugCode,
            drugName:    _drugName,
            batchNumber: _batchNumber,
            creator:     msg.sender,
            createdAt:   block.timestamp,
            exists:      true
        });

        drugCodes.push(_drugCode);

        drugEvents[_drugCode].push(DrugEvent({
            action:    "MANUFACTURED",
            location:  "Pabrik",
            notes:     "Obat selesai diproduksi",
            timestamp: block.timestamp,
            actor:     msg.sender
        }));

        emit DrugRegistered(
            _drugCode, _drugName, _batchNumber,
            msg.sender, block.timestamp
        );
    }

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

        emit DrugEventRecorded(
            _drugCode, _action, _location,
            msg.sender, block.timestamp
        );
    }

    function getDrugEventCount(string memory _drugCode)
        public view drugExists(_drugCode)
        returns (uint256)
    {
        return drugEvents[_drugCode].length;
    }

    function getDrugEvent(
        string memory _drugCode,
        uint256 _eventIndex
    )
        public view drugExists(_drugCode)
        returns (
            string  memory action,
            string  memory location,
            string  memory notes,
            uint256        timestamp,
            address        actor
        )
    {
        require(_eventIndex < drugEvents[_drugCode].length,
            "Index event tidak valid");
        DrugEvent memory e = drugEvents[_drugCode][_eventIndex];
        return (e.action, e.location, e.notes, e.timestamp, e.actor);
    }

    function getTotalDrugs() public view returns (uint256) {
        return drugCodes.length;
    }
}`;
}

function copyContract() {
  navigator.clipboard.writeText(getSolidityCode())
    .then(() => showToast("✅ Kode Solidity berhasil disalin!", "success"))
    .catch(() => showToast("Gagal menyalin kode", "error"));
}

// ─── Toast ─────────────────────────────────────────────────────────────────────
let toastCount = 0;

function showToast(msg, type = "info") {
  const container = document.getElementById("toast-container");
  const id        = `toast-${++toastCount}`;
  const icons     = { success: "✅", error: "❌", warning: "⚠️", info: "ℹ️" };

  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.id        = id;
  el.innerHTML = `
    <span class="toast-icon">${icons[type] || "ℹ️"}</span>
    <span class="toast-msg">${msg}</span>
    <button class="toast-close" onclick="removeToast('${id}')">✕</button>
  `;

  container.appendChild(el);

  // Auto remove setelah 5s
  setTimeout(() => removeToast(id), 5000);
}

function removeToast(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

// ─── Modal ─────────────────────────────────────────────────────────────────────
function closeModal(id) {
  document.getElementById(id).classList.add("hidden");
}

// ─── Utility ───────────────────────────────────────────────────────────────────
function val(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : "";
}

function setLoading(btn, loading, loadingText) {
  if (!btn) return;
  if (loading) {
    btn.disabled             = true;
    btn._originalText        = btn.innerHTML;
    btn.innerHTML            = `<span class="spinner"></span> ${loadingText || "Memproses..."}`;
  } else {
    btn.disabled  = false;
    btn.innerHTML = btn._originalText || loadingText;
  }
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    return d.toLocaleString("id-ID", {
      day:    "2-digit", month: "short", year: "numeric",
      hour:   "2-digit", minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

function actionEmoji(action) {
  const map = {
    MANUFACTURED: "🏭",
    SHIPPED:      "🚚",
    RECEIVED:     "📥",
    DISTRIBUTED:  "📦",
    DISPENSED:    "💊",
    HACKED:       "💀",
    FAKE_DATA:    "🔴",
  };
  return map[action] || "🔄";
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── Simulation ────────────────────────────────────────────────────────────────

/**
 * runSimulation — Mengisi data otomatis menggunakan pola WAVE / BATCH.
 *
 * Alur:
 *   Wave 0 : Semua batch MANUFACTURED bersamaan (Batch A, B, C)
 *   Wave 1 : Semua batch SHIPPED bersamaan
 *   Wave 2 : Semua batch RECEIVED (Distributor) bersamaan
 *   Wave 3 : Semua batch DISTRIBUTED bersamaan
 *   Wave 4 : Semua batch RECEIVED (Apotek) bersamaan
 *   Wave 5 : Semua batch DISPENSED bersamaan
 */
async function runSimulation() {
  if (isSimulating) return;
  isSimulating = true;

  const btnSim   = document.getElementById("btn-simulate");
  const btnReset = document.getElementById("btn-reset-sim");
  const progress = document.getElementById("sim-progress");
  const fill     = document.getElementById("sim-progress-fill");
  const label    = document.getElementById("sim-progress-label");

  if (btnSim)   { btnSim.disabled = true; btnSim.innerHTML = '<span class="spinner" style="border-top-color:#7c3aed;width:14px;height:14px;"></span> Simulasi berjalan...'; }
  if (btnReset) { btnReset.disabled = true; }
  if (progress) progress.style.display = "block";

  // Pastikan allUsers sudah dimuat
  if (!allUsers.length) {
    const uData = await apiFetch("/api/users");
    allUsers = uData.data || [];
  }

  const { drugs, waves } = SIMULATION_SCENARIO;
  const mfr  = allUsers.find(u => u.role === "manufacturer");
  const dist  = allUsers.find(u => u.role === "distributor");
  const pharm = allUsers.find(u => u.role === "pharmacy");

  const totalWaves = 1 + waves.length;  // Wave 0 (produksi) + wave 1..N
  let   wavesDone  = 0;
  let   created    = 0;
  let   skipped    = 0;

  const setProgress = (pct, msg) => {
    if (fill)  fill.style.width  = pct + "%";
    if (label) label.textContent = msg;
  };

  // ── WAVE 0: Produksi — Semua batch MANUFACTURED bersamaan ─────────────────
  wavesDone++;
  setProgress(Math.round((wavesDone / totalWaves) * 100),
    `🏭 Wave 0 — Semua Batch MANUFACTURED bersamaan (${drugs.length} batch)...`);

  for (let i = 0; i < drugs.length; i++) {
    const drug = drugs[i];
    try {
      await apiFetch("/api/drugs", {
        method: "POST",
        body: JSON.stringify({ ...drug, actorId: mfr ? mfr.id : 1 }),
      });
      created++;
    } catch (err) {
      if (err.message && (err.message.includes("sudah ada") || err.message.includes("409"))) {
        skipped++;
      } else {
        showToast(`⚠️ Batch ${String.fromCharCode(65 + i)}: ${err.message}`, "warning");
      }
    }
    await sleep(200); // jeda singkat antar batch dalam wave yang sama
  }
  showToast(`🏭 Wave 0 selesai: ${drugs.length} batch MANUFACTURED`, "info");
  await sleep(600);

  // ── WAVE 1..N: Setiap wave → semua batch proses aksi yang sama bersamaan ──
  const actorMap = {
    manufacturer: mfr,
    distributor:  dist,
    pharmacy:     pharm,
  };

  for (let wIdx = 0; wIdx < waves.length; wIdx++) {
    const wave = waves[wIdx];
    wavesDone++;
    const pct = Math.round((wavesDone / totalWaves) * 100);
    setProgress(pct, `${wave.label}...`);

    const actor = actorMap[wave.actorRole];
    if (!actor) {
      showToast(`⚠️ Tidak ada pengguna dengan role ${wave.actorRole}`, "warning");
      continue;
    }

    // Proses semua drug dalam wave ini secara berurutan cepat (simulasi batch)
    for (let dIdx = 0; dIdx < drugs.length; dIdx++) {
      const drug     = drugs[dIdx];
      const location = wave.locations[dIdx] || wave.locations[0];
      const notes    = wave.notes[dIdx]     || wave.notes[0];

      try {
        await apiFetch(`/api/drugs/${drug.drugCode}/transactions`, {
          method: "POST",
          body: JSON.stringify({
            action:   wave.action,
            actorId:  actor.id,
            location,
            notes,
          }),
        });
        created++;
      } catch (err) {
        skipped++;
      }
      await sleep(180); // jeda antar batch dalam wave
    }

    showToast(`✅ ${wave.label} selesai`, "success");
    await sleep(500); // jeda antar wave
  }

  // ── Selesai ────────────────────────────────────────────────────────────────
  setProgress(100,
    `🎉 Simulasi selesai! ${created} block dibuat dalam ${totalWaves} wave. ${skipped > 0 ? `(${skipped} dilewati)` : ""}`
  );

  showToast(
    `🎉 Simulasi selesai! ${created} block baru di blockchain dalam ${totalWaves} wave batch.`,
    "success"
  );

  // Refresh dashboard
  allDrugs = [];
  await loadDashboard();

  await sleep(4000);
  if (progress) progress.style.display = "none";
  if (btnSim)   { btnSim.disabled   = false; btnSim.innerHTML   = "⚡ Simulasikan"; }
  if (btnReset) { btnReset.disabled = false; }
  isSimulating = false;
}

/**
 * resetSimulation — Menghapus semua data obat dan transaksi dari database.
 * Blockchain juga akan di-reinisialisasi.
 */
async function resetSimulation() {
  if (isSimulating) return;

  const confirmed = confirm(
    "⚠️ Reset akan menghapus semua obat, transaksi, dan blockchain blocks (kecuali genesis block).\n\nLanjutkan?"
  );
  if (!confirmed) return;

  const btnReset = document.getElementById("btn-reset-sim");
  if (btnReset) { btnReset.disabled = true; btnReset.innerHTML = '<span class="spinner" style="border-top-color:rgba(255,255,255,0.7);width:13px;height:13px;"></span> Mereset...'; }

  try {
    await apiFetch("/api/simulation/reset", { method: "POST" });
    showToast("🗑️ Semua data simulasi berhasil dihapus. Blockchain dikembalikan ke genesis block.", "info");
    allDrugs = [];
    allUsers = [];
    await loadDashboard();
  } catch (err) {
    showToast("Gagal reset: " + err.message, "error");
  } finally {
    if (btnReset) { btnReset.disabled = false; btnReset.innerHTML = "🗑️ Reset Data"; }
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  navigate("dashboard");

  // Auto-refresh status setiap 30 detik
  setInterval(updateChainStatusBadge, 30_000);
});
