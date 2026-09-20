// Cidades (Google Analytics 4) — acessos do site por cidade, por marca: cards do site inteiro
// (sessões, novos usuários, pageviews, taxa de engajamento) + tabela de cidades com filtro por
// estado. Mesmo estilo de card com sparkline da aba Busca Orgânica (orgMetricCard,
// js/tabs/organico.js). Dado vem de buildGa4 (js/aggregate.js) — leia lá por que só métricas
// aditivas entram (sem "usuários ativos" nem eventos-chave).
let _ga4Data = null;
// Filtro de estado da tabela de cidades. '' = todos. Sobrevive a troca de marca/período; se o
// estado não existir na marca/período atual, cai pra "todos" (ver renderGa4).
let _ga4State = '';

async function tabGa4() {
  loading();
  _ga4Data = null;
  await renderGa4();
}

function onGa4StateChange(value) {
  _ga4State = value;
  renderGa4();
}

function ga4Note(coverage) {
  const cov = coverage != null
    ? ` As cidades listadas cobrem ${fP(coverage * 100)} das sessões do site no período (o sync guarda as 30 cidades com mais sessões por dia; a cauda menor fica de fora).`
    : '';
  return `<div class="c-muted" style="font-size:12px;margin:-8px 0 16px">
    Os cards mostram o site inteiro; o filtro de estado vale só pra tabela de cidades. "Novos usuários" é somável entre dias; "usuários ativos" não é (a mesma pessoa em 2 dias contaria 2x), por isso não aparece. Taxa de engajamento = sessões engajadas ÷ sessões do período. O GA4 revisa os números dos últimos ~14 dias, então o fim do período pode mudar um pouco.${cov}
  </div>`;
}

const ga4RegionLabel = region => (!region || region === '(not set)') ? 'Não identificado' : region;

async function renderGa4() {
  const body = document.getElementById('content');
  body.innerHTML = `<div class="loading"><div class="spinner"></div>Carregando Cidades (GA4)…</div>`;

  if (!_ga4Data) {
    const brandData = await loadBrandData(S.brand);
    _ga4Data = buildGa4(brandData, S.start, S.end);
  }
  const { daily, cities } = _ga4Data;

  if (!daily.length) {
    body.innerHTML = `<div class="card" style="text-align:center;padding:40px">
      <div class="card-title" style="margin-bottom:8px">Sem dados do GA4 no período</div>
      <div class="c-muted" style="font-size:13px">O sync do GA4 tem histórico desde 01/01/2026 e roda 1x/dia (até o dia anterior). Ajuste o período acima.</div>
    </div>`;
    return;
  }

  const dates = daily.map(d => d.date);
  const totalSessions = sum(daily, 'sessions');
  const totalEngaged = sum(daily, 'engagedSessions');
  const engagement = totalSessions > 0 ? totalEngaged / totalSessions : null;
  const coverage = totalSessions > 0 ? sum(cities, 'sessions') / totalSessions : null;

  const statCard = (icon, label, valueHtml, color) => `<div class="card">
    <div class="kpi-label">${icon} ${label}</div>
    <div class="kpi-value" style="color:${color}">${valueHtml}</div>
    <div style="height:8px"></div>
  </div>`;

  const cards = [
    orgMetricCard('🌐', 'Sessões', dates, daily.map(d => +d.sessions || 0), totalSessions, '#2563eb'),
    orgMetricCard('🆕', 'Novos usuários', dates, daily.map(d => +d.newUsers || 0), sum(daily, 'newUsers'), '#9551FB'),
    orgMetricCard('📄', 'Pageviews', dates, daily.map(d => +d.screenPageViews || 0), sum(daily, 'screenPageViews'), '#ed723e'),
    statCard('✅', 'Taxa de Engajamento', fP(engagement != null ? engagement * 100 : null), '#16a34a'),
  ];

  // Estados disponíveis no período, do maior pro menor em sessões.
  const sessionsByRegion = new Map();
  for (const c of cities) sessionsByRegion.set(c.region, (sessionsByRegion.get(c.region) || 0) + c.sessions);
  const regions = [...sessionsByRegion.entries()].sort((a, b) => b[1] - a[1]).map(([region]) => region);
  if (_ga4State && !regions.includes(_ga4State)) _ga4State = '';

  const filtered = _ga4State ? cities.filter(c => c.region === _ga4State) : cities;
  const filteredSessions = sum(filtered, 'sessions');

  const st = getSort('ga4-cities', 'sessions', 'desc');
  const sorted = sortRows(filtered, st.key, st.dir);
  registerSortRenderer('ga4-cities', renderGa4);

  const stateSelect = `<select class="filter-select" style="height:30px;font-size:12px;padding:4px 8px" onchange="onGa4StateChange(this.value)">
    <option value="">Todos os estados</option>
    ${regions.map(r => `<option value="${escHtml(r)}"${r === _ga4State ? ' selected' : ''}>${escHtml(ga4RegionLabel(r))}</option>`).join('')}
  </select>`;

  const pct = r => totalSessions > 0 ? fP(r.sessions / totalSessions * 100) : '—';
  const eng = r => r.engagementRate != null ? fP(r.engagementRate * 100) : '—';
  // "(not set)" é sessão sem cidade identificada, não uma cidade — fora da contagem, dentro das sessões.
  const nCities = filtered.filter(c => c.city !== '(not set)').length;
  const summary = `${fN(nCities)} ${nCities === 1 ? 'cidade' : 'cidades'} ·${fN(filteredSessions)} sessões${totalSessions > 0 ? ` (${fP(filteredSessions / totalSessions * 100)} do site)` : ''}`;

  body.innerHTML = `
    <div class="kpi-grid cols-4" style="margin-bottom:8px">${cards.join('')}</div>
    ${ga4Note(coverage)}
    <div class="card">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:4px">
        <div class="card-title" style="margin:0">📍 Cidades (${disp(S.start)} → ${disp(S.end)})</div>
        <div style="display:flex;align-items:center;gap:10px">
          <span class="c-muted" style="font-size:12px">${summary}</span>
          ${stateSelect}
        </div>
      </div>
      <div class="table-wrap"><table>
        <thead><tr>
          <th>Cidade</th>
          <th>Estado</th>
          ${sortTh('ga4-cities', 'Sessões', 'sessions')}
          <th class="r">% das sessões</th>
          ${sortTh('ga4-cities', 'Pageviews', 'pageviews')}
          ${sortTh('ga4-cities', 'Taxa de engajamento', 'engagementRate')}
        </tr></thead>
        <tbody>${sorted.length ? sorted.slice(0, 100).map(r => `
          <tr>
            <td>${r.city === '(not set)' ? '<span class="c-muted">Não identificada</span>' : escHtml(r.city)}</td>
            <td>${escHtml(ga4RegionLabel(r.region))}</td>
            <td class="r">${fN(r.sessions)}</td>
            <td class="r">${pct(r)}</td>
            <td class="r">${fN(r.pageviews)}</td>
            <td class="r">${eng(r)}</td>
          </tr>`).join('') : emptyRow(6, 'Sem dados de cidade no período')}</tbody>
      </table></div>
    </div>
  `;
}
