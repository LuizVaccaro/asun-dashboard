// ── Date utils ──
const fmt      = d => d.toISOString().slice(0,10);
const disp     = s => new Date(s+'T12:00:00').toLocaleDateString('pt-BR');
const addDays  = (d, n) => { const x = new Date(d); x.setDate(x.getDate()+n); return x; };
const today     = () => fmt(new Date());
const yesterday = () => fmt(addDays(new Date(), -1));

const PRESETS = {
  hoje:   () => { const t=today();     return {s:t,e:t}; },
  ontem:  () => { const y=yesterday(); return {s:y,e:y}; },
  '7d':   () => { const e=yesterday(); return {s:fmt(addDays(new Date(e),-6)),e}; },
  '14d':  () => { const e=yesterday(); return {s:fmt(addDays(new Date(e),-13)),e}; },
  '30d':  () => { const e=yesterday(); return {s:fmt(addDays(new Date(e),-29)),e}; },
  mes:    () => { const t=new Date(); const s=new Date(t.getFullYear(),t.getMonth(),1); const y=addDays(new Date(),-1); const e=y<s?today():fmt(y); return {s:fmt(s),e}; },
  mesant: () => { const t=new Date(); const s=new Date(t.getFullYear(),t.getMonth()-1,1); const e=new Date(t.getFullYear(),t.getMonth(),0); return {s:fmt(s),e:fmt(e)}; },
};

function calcCmp(mode, s, e) {
  const d1=new Date(s+'T12:00:00'), d2=new Date(e+'T12:00:00');
  const n=Math.round((d2-d1)/864e5);
  if (mode==='anterior') {
    const ce=new Date(d1); ce.setDate(ce.getDate()-1);
    const cs=new Date(ce); cs.setDate(cs.getDate()-n);
    return {s:fmt(cs),e:fmt(ce)};
  }
  if (mode==='mesant') {
    const cs=new Date(d1); cs.setMonth(cs.getMonth()-1);
    const ce=new Date(d2); ce.setMonth(ce.getMonth()-1);
    return {s:fmt(cs),e:fmt(ce)};
  }
  if (mode==='anoant') {
    const cs=new Date(d1); cs.setFullYear(cs.getFullYear()-1);
    const ce=new Date(d2); ce.setFullYear(ce.getFullYear()-1);
    return {s:fmt(cs),e:fmt(ce)};
  }
  return null;
}

// ── Format helpers ──
const fR = n => n!=null&&!isNaN(n) ? 'R$ '+Number(n).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}) : '—';
const fN = n => n!=null&&!isNaN(n) ? Number(n).toLocaleString('pt-BR') : '—';
const fP = n => n!=null&&!isNaN(n) ? Number(n).toFixed(2)+'%' : '—';
const fX = n => n!=null&&!isNaN(n) ? Number(n).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+'x' : '—';

function fAxisCompact(n) {
  if (n == null || isNaN(n)) return '0';
  const abs = Math.abs(n);
  if (abs >= 1e6) return (n/1e6).toFixed(1).replace(/\.0$/,'').replace('.', ',') + 'M';
  if (abs >= 1e3) return (n/1e3).toFixed(1).replace(/\.0$/,'').replace('.', ',') + 'k';
  return String(Math.round(n));
}

// ── Data helpers ──
const sum = (arr, k) => arr.reduce((s,r)=>s+(+r[k]||0), 0);

function escHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
// Usado pra montar onclick="fn('...')" inline, onde o HTML ao redor usa aspas DUPLAS.
// Dois contextos de escape empilhados: 1) dentro da string JS literal de aspas simples
// (barra invertida, aspa simples, quebra de linha real, separadores unicode U+2028/U+2029
// quebram a string com SyntaxError -- confirmado real: preview do Instagram nao abria pra
// posts com legenda multi-linha, Facebook raramente usa quebra de linha na mensagem por
// isso nao aparecia la); 2) dentro do atributo HTML de aspas duplas (uma aspa dupla literal
// na legenda fecha o atributo antes da hora e corrompe o onclick inteiro).
function escAttr(s) {
  return String(s == null ? '' : s)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
    .replace(/"/g, '&quot;');
}


// ── UI helpers ──
function deltaHtml(curr, prev, invert=false) {
  if (prev==null||prev===0||!S.compare) return '';
  const d=(curr-prev)/Math.abs(prev);
  const pct=(d*100).toFixed(1);
  const pos=invert ? d<0 : d>0;
  const cls=pos?'d-up':d===0?'d-neu':'d-down';
  const arrow=d>0?'↑':d<0?'↓':'→';
  return `<span class="${cls}">${arrow} ${d>0?'+':''}${pct}%</span>`;
}

function kpiCard(label, val, cmpVal, fFn=fR, cls='c-brand', invert=false) {
  const cmpHtml = S.compare && cmpVal!==undefined
    ? `<div class="kpi-cmp">${fFn(cmpVal)} ${deltaHtml(val,cmpVal,invert)}</div>`
    : (S.compare ? `<div class="kpi-cmp d-neu">Sem comp.</div>` : '');
  return `<div class="card">
    <div class="kpi-label">${label}</div>
    <div class="kpi-value ${cls}">${fFn(val)}</div>
    ${cmpHtml}
  </div>`;
}

// Filtro de Funil (Desempenho Diário/Google Ads/Meta Ads): '' = todas, 'vendas'/'topo' = pelo
// funnel_stage já classificado no sync (ver funnel.mjs), 'ofertas' é diferente — não é um
// funnel_stage, é um recorte por nome de campanha (contém "Promo"/"Promoção") por cima de
// qualquer funil, pedido do usuário 04/09/2026. "promo" já cobre os dois casos (é prefixo de
// "promoção").
function matchesFunnelFilter(row, filterValue) {
  if (!filterValue) return true;
  if (filterValue === 'ofertas') return /promo/i.test(row.campaign_name || '');
  return row.funnel_stage === filterValue;
}

function funnelBadge(stage) {
  const isVendas = stage === 'vendas';
  const bg = isVendas ? '#16a34a1a' : '#ed723e1a';
  const fg = isVendas ? '#16a34a' : '#ed723e';
  const label = isVendas ? 'Vendas' : 'Topo';
  return `<span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;background:${bg};color:${fg};white-space:nowrap">${label}</span>`;
}

function loading() {
  document.getElementById('content').innerHTML = `<div class="loading"><div class="spinner"></div>Carregando dados…</div>`;
}

function emptyRow(cols, msg='Sem dados para o período selecionado') {
  return `<tr><td colspan="${cols}" class="c-muted" style="text-align:center;padding:28px">${msg}</td></tr>`;
}

// ── Dropdown multi-seleção (checkboxes) genérico — filtros de campanha/canal/etc.
// Estado global por "key" (ex: 'metaCampFilter'). selected vazio = sem filtro (mostra tudo).
const _ms = {};

function msState(key) {
  if (!_ms[key]) _ms[key] = { open: false, selected: new Set() };
  return _ms[key];
}

function msReset(key) {
  _ms[key] = { open: false, selected: new Set() };
}

function msToggleOpen(key, onChange) {
  const st = msState(key);
  st.open = !st.open;
  onChange();
  if (st.open) {
    setTimeout(() => document.addEventListener('click', function outside(e) {
      if (e.target.closest(`[data-ms-key="${key}"]`)) return;
      st.open = false;
      document.removeEventListener('click', outside);
      onChange();
    }), 0);
  }
}

function msToggleOption(key, value, onChange) {
  const st = msState(key);
  if (st.selected.has(value)) st.selected.delete(value); else st.selected.add(value);
  onChange();
}

function msClear(key, onChange) {
  msState(key).selected.clear();
  onChange();
}

function msLabel(key, allLabel) {
  const sel = [...msState(key).selected];
  if (sel.length === 0) return allLabel;
  if (sel.length <= 2) return sel.join(', ');
  return `${sel.length} selecionadas`;
}

// changeFn: nome (string) de uma função global sem args, chamada após abrir/marcar/limpar — re-renderiza a tela.
function renderMultiSelect(key, label, allLabel, options, changeFn, minWidth = 240) {
  const st = msState(key);
  return `<div data-ms-key="${key}" style="position:relative;display:flex;align-items:center;gap:10px">
    <label style="font-size:12px;color:var(--muted-dark);white-space:nowrap">${label}</label>
    <button type="button" onclick="event.stopPropagation();msToggleOpen('${key}',${changeFn})"
      style="background:var(--white);border:1px solid var(--border);color:var(--ink);border-radius:6px;padding:6px 10px;font-size:13px;cursor:pointer;min-width:${minWidth}px;max-width:360px;text-align:left;display:flex;align-items:center;justify-content:space-between;gap:8px">
      <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(msLabel(key, allLabel))}</span><span style="color:var(--muted-dark);font-size:10px;flex-shrink:0">▾</span>
    </button>
    ${st.open ? `
      <div onclick="event.stopPropagation()" style="position:absolute;top:100%;left:0;margin-top:4px;background:var(--white);border:1px solid var(--border);border-radius:8px;padding:8px;z-index:20;min-width:${minWidth}px;max-width:420px;max-height:320px;overflow-y:auto;box-shadow:0 4px 16px rgba(0,0,0,.12)">
        ${options.map(opt => `
          <label style="display:flex;align-items:center;gap:8px;padding:5px 6px;cursor:pointer;font-size:13px;border-radius:4px;word-break:break-word" onmouseover="this.style.background='var(--bg)'" onmouseout="this.style.background='transparent'">
            <input type="checkbox" onchange="msToggleOption('${key}','${escAttr(opt)}',${changeFn})" ${st.selected.has(opt) ? 'checked' : ''} style="cursor:pointer;flex-shrink:0">
            <span>${escHtml(opt)}</span>
          </label>`).join('')}
        <div style="border-top:1px solid var(--border);margin-top:6px;padding-top:6px;text-align:right">
          <button type="button" onclick="msClear('${key}',${changeFn})" style="background:none;border:none;color:var(--brand);font-size:12px;cursor:pointer;font-weight:600">Limpar</button>
        </div>
      </div>
    ` : ''}
  </div>`;
}

// ── Generic sortable tables ──
// Cada tabela ordenável tem um id próprio: sort state e função de re-render ficam
// registrados aqui, para que o clique no <th> funcione sem re-buscar os dados.
const _sortState     = {};
const _sortRenderers = {};

function registerSortRenderer(tableId, renderFn) {
  _sortRenderers[tableId] = renderFn;
}

function getSort(tableId, fallbackKey, fallbackDir='desc') {
  if (!_sortState[tableId]) _sortState[tableId] = { key: fallbackKey, dir: fallbackDir };
  return _sortState[tableId];
}

function onSortClick(tableId, key, defaultDir) {
  const cur = _sortState[tableId];
  if (cur && cur.key === key) cur.dir = cur.dir === 'asc' ? 'desc' : 'asc';
  else _sortState[tableId] = { key, dir: defaultDir };
  const fn = _sortRenderers[tableId];
  if (fn) fn();
}

function sortRows(rows, key, dir) {
  return rows.slice().sort((a, b) => {
    let va = a[key], vb = b[key];
    const bothNumeric = (typeof va === 'number' || va == null) && (typeof vb === 'number' || vb == null);
    if (bothNumeric) {
      va = va == null ? -Infinity : va;
      vb = vb == null ? -Infinity : vb;
    } else {
      va = String(va ?? '').toLowerCase();
      vb = String(vb ?? '').toLowerCase();
    }
    if (va < vb) return dir === 'asc' ? -1 : 1;
    if (va > vb) return dir === 'asc' ? 1 : -1;
    return 0;
  });
}

function sortTh(tableId, label, key, defaultDir='desc', align='r') {
  const st = getSort(tableId, null, defaultDir);
  const active = st.key === key;
  const arrow = active ? (st.dir === 'asc' ? ' ▲' : ' ▼') : '';
  return `<th class="${align} th-sort${active?' active':''}" onclick="onSortClick('${tableId}','${key}','${defaultDir}')">${label}${arrow}</th>`;
}

// ── Preview de criativo (thumb + modal) — mesmo padrão do economart-dashboard ──
function ensureCreativeModal() {
  if (document.getElementById('creativeModal')) return;
  const m = document.createElement('div');
  m.id = 'creativeModal';
  m.style.cssText = 'display:none;position:fixed;inset:0;background:#1f232899;backdrop-filter:blur(3px);z-index:9999;align-items:center;justify-content:center;padding:20px';
  m.innerHTML = `
    <div class="modal-box">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px">
        <div>
          <div class="modal-eyebrow">Preview do Criativo</div>
          <div id="modalAdName" class="modal-name"></div>
        </div>
        <button class="modal-close" onclick="document.getElementById('creativeModal').style.display='none'">&#x2715;</button>
      </div>
      <div id="modalContent" class="modal-content"></div>
      <div style="margin-top:12px">
        <a id="modalLink" class="modal-link" href="#" target="_blank" rel="noopener">Abrir no Gerenciador &#x2192;</a>
      </div>
    </div>`;
  m.addEventListener('click', e => { if (e.target === m) m.style.display = 'none'; });
  document.body.appendChild(m);
}

function showCreative(name, thumb, managerUrl) {
  ensureCreativeModal();
  document.getElementById('modalAdName').textContent = name;
  const content = document.getElementById('modalContent');
  const link    = document.getElementById('modalLink');
  if (thumb) {
    const img = document.createElement('img');
    img.src = thumb;
    img.style.cssText = 'width:100%;display:block;border-radius:4px';
    img.onerror = () => { content.innerHTML = '<div class="modal-fallback">Thumbnail indisponível</div>'; };
    content.innerHTML = '';
    content.appendChild(img);
  } else {
    content.innerHTML = '<div class="modal-fallback">Preview não disponível</div>';
  }
  link.href = managerUrl || '#';
  document.getElementById('creativeModal').style.display = 'flex';
}

// Miniatura pequena e nítida (estilo Gerenciador de Anúncios) com selo de play —
// clique abre o modal com o preview completo.
function previewThumb(name, thumb, managerUrl, size) {
  size = size || 56;
  const badge = Math.max(18, Math.round(size * 0.3));
  const onclick = "showCreative('" + escAttr(name) + "','" + escAttr(thumb) + "','" + escAttr(managerUrl) + "')";
  return `
    <div class="thumb" onclick="${onclick}" style="width:${size}px;height:${size}px">
      ${thumb
        ? `<img src="${thumb}" style="width:100%;height:100%;object-fit:cover;object-position:center;display:block" onerror="this.style.display='none'"/>`
        : '<span class="thumb-empty">Sem preview</span>'}
      <span class="thumb-play" style="width:${badge}px;height:${badge}px;font-size:${Math.round(badge * 0.42)}px">&#x25B6;</span>
    </div>`;
}

// ── Gráfico combinado (barras empilhadas + linha) via Chart.js — série diária/mensal ──
const _comboCharts = {};

// barDatasets: [{label, data, backgroundColor}] — eixo y (esquerda, ex: R$ investido).
// lineDatasets: [{label, data, borderColor, yAxisID}] — yAxisID 'y' (mesma escala) ou 'y1' (contagem, eixo direito).
function renderComboChart(canvasId, labels, barDatasets, lineDatasets) {
  const canvas = document.getElementById(canvasId);
  if (_comboCharts[canvasId]) { _comboCharts[canvasId].destroy(); delete _comboCharts[canvasId]; }
  if (!canvas || !labels.length) return;

  const y1Line  = lineDatasets.find(d => (d.yAxisID||'y1') === 'y1') || lineDatasets[0];
  const y1Color = (y1Line && y1Line.borderColor) || 'var(--brand)';
  const y1Label = (y1Line && y1Line.label) || '';

  const datasets = [
    ...barDatasets.map(d => ({ type:'bar', borderRadius:4, borderWidth:0, stack:'main', yAxisID:'y', order:1, ...d })),
    ...lineDatasets.map(d => ({ type:'line', borderWidth:3, pointBorderWidth:2, pointRadius:3,
      tension:.3, fill:false, backgroundColor:'#ffffff', yAxisID:'y1', order:2, pointBackgroundColor:d.borderColor, ...d })),
  ];

  _comboCharts[canvasId] = new Chart(canvas.getContext('2d'), {
    data: { labels, datasets },
    options: {
      responsive:true, maintainAspectRatio:false,
      interaction:{mode:'index', intersect:false},
      scales:{
        x:{ stacked:true, grid:{display:false}, ticks:{color:'#7a7a7a', font:{size:10}} },
        y:{ stacked:true, position:'left', grid:{color:'#f0f0f0'},
            ticks:{color:'#7a7a7a', font:{size:10}, callback:v=>'R$ '+fAxisCompact(v)} },
        y1:{ position:'right', grid:{drawOnChartArea:false},
             ticks:{color:y1Color, font:{size:10}, callback:v=>fAxisCompact(v)},
             title:{display:!!y1Label, text:y1Label, color:y1Color, font:{size:10,weight:'600'}} },
      },
      plugins:{
        legend:{display:true, position:'top', align:'end', labels:{color:'#16181d', boxWidth:10, usePointStyle:true, font:{size:11}}},
        tooltip:{
          backgroundColor:'#16181d', titleColor:'#fff', bodyColor:'#fff', padding:10, cornerRadius:8,
          callbacks:{ label: ctx => (ctx.dataset.type==='bar' || ctx.dataset.yAxisID==='y')
            ? `${ctx.dataset.label}: ${fR(ctx.parsed.y)}` : `${ctx.dataset.label}: ${fN(ctx.parsed.y)}` },
        },
      },
    },
  });
}
