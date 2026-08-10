// ── State ──
// brand: 'asun' | 'leve_mais' — Grupo Asun tem contas de anúncio separadas por marca.
let S = { start:'', end:'', compare:false, cmpStart:'', cmpEnd:'', brand:'asun' };

// Fase 2: senha compartilhada + criptografia client-side (ver js/crypto.js e js/data.js). O
// dashboard fica com #appShell escondido até desbloquear — ver boot()/submitPassword() no fim
// deste arquivo.

// ── Marca (Asun x Leve Mais) ──
function onBrandChange() {
  S.brand = document.getElementById('brandSelect').value;
  renderTab(activeTab);
}

// ── Filter UI ──
function onQuickChange() {
  const v = document.getElementById('quickPeriod').value;
  if (v==='custom') return;
  const {s,e} = PRESETS[v]();
  document.getElementById('startDate').value = s;
  document.getElementById('endDate').value   = e;
  calcCmpDates();
  applyFilter();
}

function onDateManual() {
  document.getElementById('quickPeriod').value = 'custom';
  calcCmpDates();
}

function toggleCmp() {
  const on = document.getElementById('cmpCheck').checked;
  document.getElementById('cmpFields').classList.toggle('show', on);
  S.compare = on;
  if (on) calcCmpDates();
}

function calcCmpDates() {
  const mode       = document.getElementById('cmpMode').value;
  const s          = document.getElementById('startDate').value;
  const e          = document.getElementById('endDate').value;
  const cmpStartEl = document.getElementById('cmpStart');
  const cmpEndEl   = document.getElementById('cmpEnd');
  if (mode==='custom') { cmpStartEl.removeAttribute('readonly'); cmpEndEl.removeAttribute('readonly'); return; }
  cmpStartEl.setAttribute('readonly','');
  cmpEndEl.setAttribute('readonly','');
  if (!s||!e) return;
  const cmp = calcCmp(mode, s, e);
  if (cmp) { cmpStartEl.value=cmp.s; cmpEndEl.value=cmp.e; }
}

function applyFilter() {
  const s = document.getElementById('startDate').value;
  const e = document.getElementById('endDate').value;
  if (!s||!e) { alert('Selecione as datas de início e fim.'); return; }
  S.start    = s;
  S.end      = e;
  S.compare  = document.getElementById('cmpCheck').checked;
  S.cmpStart = document.getElementById('cmpStart').value;
  S.cmpEnd   = document.getElementById('cmpEnd').value;
  document.getElementById('headerPeriod').textContent = `${disp(s)} → ${disp(e)}`;
  renderTab(activeTab);
}

// ── Tabs ──
// Cada aba: {id, label, fn}. `fn` é a função async definida em js/tabs/<id>.js
// que renderiza dentro de #content. Adicione/remova abas aqui.
const TABS = [
  {id:'diario', label:'📅 Desempenho Diário', fn: () => tabDiario()},
  {id:'google', label:'🔵 Google Ads', fn: () => tabGoogle()},
  {id:'meta', label:'🟠 Meta Ads', fn: () => tabMeta()},
  {id:'organico', label:'📷 Orgânico', fn: () => tabOrganico()},
];

let activeTab = TABS[0].id;

async function renderTab(id) {
  const tab = TABS.find(t => t.id === id) || TABS[0];
  try { await tab.fn(); }
  catch(e) {
    document.getElementById('content').innerHTML = `
      <div class="card" style="text-align:center;padding:40px">
        <div style="font-size:32px;margin-bottom:12px">⚠️</div>
        <div style="font-size:15px;font-weight:600;margin-bottom:8px">Erro ao carregar dados</div>
        <div style="font-size:13px;color:var(--muted-dark)">${e.message}</div>
      </div>`;
  }
}

// ── Alert bar genérico — chame showTokenAlert(html, cor, borda, fundo) de qualquer aba ──
function showTokenAlert(html, cor, bdr, bg) {
  const el = document.getElementById('tokenAlert');
  el.style.background = bg;
  el.style.borderBottomColor = bdr;
  el.querySelector('.token-alert-text').innerHTML = html;
  el.querySelector('.token-alert-text').style.color = cor;
  el.querySelector('.token-alert-close').style.color = cor;
  el.style.display = 'block';
}

// ── Init do app ──
function initApp() {
  const {s,e} = PRESETS['30d']();
  document.getElementById('startDate').value = s;
  document.getElementById('endDate').value   = e;
  S.start = s; S.end = e;
  document.getElementById('headerPeriod').textContent = `${disp(s)} → ${disp(e)}`;

  const bar = document.getElementById('tabBar');
  bar.innerHTML = TABS.map(t=>`<button class="tab${t.id===activeTab?' active':''}" data-id="${t.id}">${t.label}</button>`).join('');
  bar.addEventListener('click', async e => {
    const btn = e.target.closest('.tab');
    if (!btn) return;
    activeTab = btn.dataset.id;
    bar.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active', b.dataset.id===activeTab));
    await renderTab(activeTab);
  });

  renderTab(activeTab);
}

// ── Fase 2: senha compartilhada ──
// A chave AES-GCM (não a senha em si) fica salva no localStorage do navegador depois do primeiro
// desbloqueio bem-sucedido — próximas visitas pulam a tela de senha direto (ver
// deriveRawKey/importAesKey em js/crypto.js). Se a senha compartilhada mudar (nova chave no
// próximo sync), a chave salva para de decifrar e a tela de senha volta a aparecer sozinha.
const PW_STORAGE_KEY = 'asun_dashboard_key_v1';

function b64ToBytesLocal(b64) {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

async function tryUnlockWithStoredKey() {
  const stored = localStorage.getItem(PW_STORAGE_KEY);
  if (!stored) return false;
  try {
    setAesKey(await importAesKey(b64ToBytesLocal(stored)));
    await loadBrandData('asun'); // decifra de verdade pra validar a chave salva
    return true;
  } catch {
    localStorage.removeItem(PW_STORAGE_KEY);
    setAesKey(null);
    return false;
  }
}

async function submitPassword() {
  const input = document.getElementById('pwInput');
  const errEl = document.getElementById('pwError');
  const btn = document.getElementById('pwSubmitBtn');
  const password = input.value;
  if (!password) return;
  errEl.textContent = '';
  btn.disabled = true;
  btn.textContent = 'Verificando…';
  try {
    const raw = await deriveRawKey(password);
    setAesKey(await importAesKey(raw));
    await loadBrandData('asun'); // só existe um jeito de confirmar a senha: tentar decifrar de verdade
    localStorage.setItem(PW_STORAGE_KEY, bytesToB64(raw));
    unlockDashboard();
  } catch {
    setAesKey(null);
    errEl.textContent = 'Senha incorreta.';
    input.value = '';
    input.focus();
  } finally {
    btn.disabled = false;
    btn.textContent = 'Entrar';
  }
}

function unlockDashboard() {
  document.getElementById('pwGate').classList.add('hide');
  document.getElementById('appShell').classList.add('show');
  initApp();
}

(async function boot() {
  if (await tryUnlockWithStoredKey()) {
    unlockDashboard();
    return;
  }
  const input = document.getElementById('pwInput');
  input.addEventListener('keydown', e => { if (e.key === 'Enter') submitPassword(); });
  input.focus();
})();
