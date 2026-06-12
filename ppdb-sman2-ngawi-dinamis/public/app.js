const state = {
  adminPassword: sessionStorage.getItem('ppdbAdminPassword') || '',
  rankingSearch: '',
  pathwayFilter: ''
};

const selectors = {
  navToggle: document.querySelector('#navToggle'),
  navLinks: document.querySelector('#navLinks'),
  registrationForm: document.querySelector('#registrationForm'),
  formMessage: document.querySelector('#formMessage'),
  rankingBody: document.querySelector('#rankingBody'),
  rankingSearch: document.querySelector('#rankingSearch'),
  pathwayFilter: document.querySelector('#pathwayFilter'),
  statusKeyword: document.querySelector('#statusKeyword'),
  checkStatusBtn: document.querySelector('#checkStatusBtn'),
  statusResult: document.querySelector('#statusResult'),
  adminPassword: document.querySelector('#adminPassword'),
  adminLoginBtn: document.querySelector('#adminLoginBtn'),
  adminLogin: document.querySelector('#adminLogin'),
  adminArea: document.querySelector('#adminArea'),
  adminBody: document.querySelector('#adminBody'),
  adminMessage: document.querySelector('#adminMessage'),
  exportCsvBtn: document.querySelector('#exportCsvBtn'),
  resetDataBtn: document.querySelector('#resetDataBtn'),
  logoutAdminBtn: document.querySelector('#logoutAdminBtn'),
  statApplicants: document.querySelector('#statApplicants'),
  statVerified: document.querySelector('#statVerified'),
  toast: document.querySelector('#toast')
};

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll(String.fromCharCode(34), '&quot;')
    .replaceAll(String.fromCharCode(39), '&#039;');
}

function formatScore(value) {
  if (value === null || value === undefined || value === '') return '-';
  const text = Number(value).toFixed(2);
  return text.endsWith('.00') ? text.slice(0, -3) : text;
}

function statusClass(status) {
  return `status-${String(status || '').toLowerCase().replaceAll(' ', '-')}`;
}

function showToast(message) {
  selectors.toast.textContent = message;
  selectors.toast.classList.add('show');
  setTimeout(() => selectors.toast.classList.remove('show'), 2600);
}

function setMessage(element, message, type = 'success') {
  element.textContent = message || '';
  element.classList.remove('success', 'error');
  if (message) element.classList.add(type);
}

async function api(path, options = {}) {
  const request = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.admin ? { 'x-admin-password': state.adminPassword } : {}),
      ...(options.headers || {})
    }
  };
  const response = await fetch(path, request);
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) {
    const message = typeof payload === 'string' ? payload : payload.message || (payload.errors || []).join(' ') || 'Request gagal.';
    throw new Error(message);
  }
  return payload;
}

async function loadRanking() {
  const params = new URLSearchParams();
  if (state.rankingSearch) params.set('search', state.rankingSearch);
  if (state.pathwayFilter) params.set('pathway', state.pathwayFilter);
  const result = await api(`/api/ranking?${params.toString()}`);
  const rows = result.data || [];
  renderRanking(rows);
  updateStats(rows);
}

function updateStats(rows) {
  selectors.statApplicants.textContent = rows.length;
  selectors.statVerified.textContent = rows.filter(item => ['Terverifikasi', 'Diterima', 'Cadangan'].includes(item.status)).length;
}

function renderRanking(rows) {
  if (!rows.length) {
    selectors.rankingBody.innerHTML = '<tr><td colspan=\'8\' class=\'muted-text\'>Belum ada data ranking.</td></tr>';
    return;
  }
  selectors.rankingBody.innerHTML = rows.map(item => `
    <tr>
      <td>${item.rank ? `<span class='rank-pill'>${item.rank}</span>` : '<span class=\'muted-text\'>-</span>'}</td>
      <td>${escapeHtml(item.registrationNumber)}</td>
      <td>${escapeHtml(item.name)}<br><span class='muted-text'>${escapeHtml(item.nisn)}</span></td>
      <td>${escapeHtml(item.pathway)}</td>
      <td>${formatScore(item.reportScore)}</td>
      <td>${formatScore(item.testScore)}</td>
      <td><strong>${formatScore(item.finalScore)}</strong></td>
      <td><span class='status-chip ${statusClass(item.status)}'>${escapeHtml(item.status)}</span></td>
    </tr>
  `).join('');
}

async function handleRegister(event) {
  event.preventDefault();
  setMessage(selectors.formMessage, 'Mengirim data pendaftaran...', 'success');
  const payload = Object.fromEntries(new FormData(selectors.registrationForm).entries());
  try {
    const result = await api('/api/register', { method: 'POST', body: JSON.stringify(payload) });
    const number = result.applicant.registrationNumber;
    setMessage(selectors.formMessage, `Pendaftaran berhasil. Nomor pendaftaran Anda: ${number}`, 'success');
    selectors.registrationForm.reset();
    selectors.statusKeyword.value = number;
    await loadRanking();
    showToast('Pendaftaran berhasil disimpan');
  } catch (error) {
    setMessage(selectors.formMessage, error.message, 'error');
  }
}

async function checkStatus() {
  const keyword = selectors.statusKeyword.value.trim();
  if (!keyword) {
    selectors.statusResult.textContent = 'Masukkan nomor pendaftaran atau NISN terlebih dahulu.';
    return;
  }
  selectors.statusResult.textContent = 'Mencari data pendaftaran...';
  try {
    const result = await api(`/api/status/${encodeURIComponent(keyword)}`);
    const item = result.applicant;
    selectors.statusResult.innerHTML = `
      <div class='status-grid'>
        <div><strong>Nama</strong>${escapeHtml(item.name)}</div>
        <div><strong>No. Pendaftaran</strong>${escapeHtml(item.registrationNumber)}</div>
        <div><strong>NISN</strong>${escapeHtml(item.nisn)}</div>
        <div><strong>Jalur</strong>${escapeHtml(item.pathway)}</div>
        <div><strong>Nilai Rapor</strong>${formatScore(item.reportScore)}</div>
        <div><strong>Nilai Tes</strong>${formatScore(item.testScore)}</div>
        <div><strong>Nilai Akhir</strong>${formatScore(item.finalScore)}</div>
        <div><strong>Ranking</strong>${item.rank || '-'}</div>
        <div><strong>Status</strong><span class='status-chip ${statusClass(item.status)}'>${escapeHtml(item.status)}</span></div>
        <div><strong>Catatan</strong>${escapeHtml(item.notes || '-')}</div>
      </div>
    `;
  } catch (error) {
    selectors.statusResult.textContent = error.message;
  }
}

async function loginAdmin() {
  const password = selectors.adminPassword.value.trim();
  if (!password) {
    setMessage(selectors.adminMessage, 'Masukkan password admin terlebih dahulu.', 'error');
    return;
  }
  state.adminPassword = password;
  try {
    await loadAdmin();
    sessionStorage.setItem('ppdbAdminPassword', password);
    selectors.adminLogin.classList.add('hidden');
    selectors.adminArea.classList.remove('hidden');
    setMessage(selectors.adminMessage, 'Berhasil masuk panel admin.', 'success');
  } catch (error) {
    state.adminPassword = '';
    sessionStorage.removeItem('ppdbAdminPassword');
    setMessage(selectors.adminMessage, error.message, 'error');
  }
}

async function loadAdmin() {
  const result = await api('/api/admin/applicants', { admin: true });
  renderAdmin(result.data || []);
}

function renderAdmin(rows) {
  if (!rows.length) {
    selectors.adminBody.innerHTML = '<tr><td colspan=\'6\' class=\'muted-text\'>Belum ada pendaftar.</td></tr>';
    return;
  }
  selectors.adminBody.innerHTML = rows.map(item => `
    <tr data-id='${escapeHtml(item.registrationNumber)}'>
      <td>${escapeHtml(item.registrationNumber)}<br><span class='muted-text'>${escapeHtml(item.nisn)}</span></td>
      <td>${escapeHtml(item.name)}<br><span class='muted-text'>${escapeHtml(item.pathway)}</span></td>
      <td><input type='number' min='0' max='100' step='0.01' data-field='testScore' value='${item.testScore ?? ''}'></td>
      <td><select data-field='status'>${['Menunggu Verifikasi', 'Terverifikasi', 'Cadangan', 'Diterima', 'Ditolak'].map(status => `<option value='${status}' ${status === item.status ? 'selected' : ''}>${status}</option>`).join('')}</select></td>
      <td><textarea rows='2' data-field='notes'>${escapeHtml(item.notes || '')}</textarea></td>
      <td><button class='btn btn-primary save-admin-btn'>Simpan</button></td>
    </tr>
  `).join('');
}

async function saveAdminRow(button) {
  const row = button.closest('tr');
  const registrationNumber = row.dataset.id;
  const payload = {
    testScore: row.querySelector('[data-field=testScore]').value,
    status: row.querySelector('[data-field=status]').value,
    notes: row.querySelector('[data-field=notes]').value
  };
  try {
    await api(`/api/admin/applicants/${encodeURIComponent(registrationNumber)}`, { method: 'PATCH', body: JSON.stringify(payload), admin: true });
    setMessage(selectors.adminMessage, `Data ${registrationNumber} berhasil diperbarui.`, 'success');
    await Promise.all([loadRanking(), loadAdmin()]);
    showToast('Data admin tersimpan');
  } catch (error) {
    setMessage(selectors.adminMessage, error.message, 'error');
  }
}

async function exportCsv() {
  try {
    const response = await fetch('/api/admin/export', { headers: { 'x-admin-password': state.adminPassword } });
    if (!response.ok) {
      const payload = await response.json();
      throw new Error(payload.message || 'Gagal ekspor CSV.');
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'data-ppdb-sman2-ngawi.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast('CSV berhasil dibuat');
  } catch (error) {
    setMessage(selectors.adminMessage, error.message, 'error');
  }
}

async function resetData() {
  if (!confirm('Reset data ke data contoh awal?')) return;
  try {
    await api('/api/admin/reset', { method: 'POST', admin: true });
    await Promise.all([loadRanking(), loadAdmin()]);
    setMessage(selectors.adminMessage, 'Data demo berhasil direset.', 'success');
    showToast('Data demo direset');
  } catch (error) {
    setMessage(selectors.adminMessage, error.message, 'error');
  }
}

function logoutAdmin() {
  state.adminPassword = '';
  sessionStorage.removeItem('ppdbAdminPassword');
  selectors.adminPassword.value = '';
  selectors.adminLogin.classList.remove('hidden');
  selectors.adminArea.classList.add('hidden');
  setMessage(selectors.adminMessage, 'Anda keluar dari panel admin.', 'success');
}

function debounce(callback, delay = 350) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => callback(...args), delay);
  };
}

function setupEvents() {
  selectors.navToggle.addEventListener('click', () => selectors.navLinks.classList.toggle('show'));
  selectors.navLinks.querySelectorAll('a').forEach(link => link.addEventListener('click', () => selectors.navLinks.classList.remove('show')));
  selectors.registrationForm.addEventListener('submit', handleRegister);
  selectors.checkStatusBtn.addEventListener('click', checkStatus);
  selectors.statusKeyword.addEventListener('keydown', event => { if (event.key === 'Enter') checkStatus(); });
  selectors.rankingSearch.addEventListener('input', debounce(event => { state.rankingSearch = event.target.value.trim(); loadRanking().catch(error => showToast(error.message)); }));
  selectors.pathwayFilter.addEventListener('change', event => { state.pathwayFilter = event.target.value; loadRanking().catch(error => showToast(error.message)); });
  selectors.adminLoginBtn.addEventListener('click', loginAdmin);
  selectors.adminPassword.addEventListener('keydown', event => { if (event.key === 'Enter') loginAdmin(); });
  selectors.adminBody.addEventListener('click', event => { if (event.target.classList.contains('save-admin-btn')) saveAdminRow(event.target); });
  selectors.exportCsvBtn.addEventListener('click', exportCsv);
  selectors.resetDataBtn.addEventListener('click', resetData);
  selectors.logoutAdminBtn.addEventListener('click', logoutAdmin);
}

async function init() {
  setupEvents();
  await loadRanking();
  if (state.adminPassword) {
    selectors.adminLogin.classList.add('hidden');
    selectors.adminArea.classList.remove('hidden');
    loadAdmin().catch(() => logoutAdmin());
  }
}

init().catch(error => {
  console.error(error);
  showToast('Gagal memuat aplikasi');
});
