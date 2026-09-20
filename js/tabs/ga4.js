// Cidades (Google Analytics 4) — acessos do site por cidade do Rio Grande do Sul, por marca:
// cards do site inteiro (sessões, novos usuários, pageviews, taxa de engajamento) + tabela de
// cidades do RS (mais a linha "Não identificada" do próprio RS). Mesmo estilo de card com
// sparkline da aba Busca Orgânica (orgMetricCard, js/tabs/organico.js). Dado vem de buildGa4
// (js/aggregate.js) — leia lá por que só métricas aditivas entram (sem "usuários ativos" nem
// eventos-chave) e por que só o RS.
let _ga4Data = null;

async function tabGa4() {
  loading();
  _ga4Data = null;
  await renderGa4();
}

function ga4Note(coverage) {
  const cov = coverage != null
    ? ` As cidades do RS listadas somam ${fP(coverage * 100)} das sessões do site no período; o restante vem de outros estados/países (fora da lista) ou da cauda menor de cidades (o sync guarda as 30 cidades com mais sessões por dia).`
    : '';
  return `<div class="c-muted" style="font-size:12px;margin:-8px 0 16px">
    Os cards mostram o site inteiro; a tabela mostra só o Rio Grande do Sul. "Novos usuários" é somável entre dias; "usuários ativos" não é (a mesma pessoa em 2 dias contaria 2x), por isso não aparece. Taxa de engajamento = sessões engajadas ÷ sessões do período. O GA4 revisa os números dos últimos ~14 dias, então o fim do período pode mudar um pouco.${cov}
  </div>`;
}

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
  const citySessions = sum(cities, 'sessions');
  const coverage = totalSessions > 0 ? citySessions / totalSessions : null;

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

  const st = getSort('ga4-cities', 'sessions', 'desc');
  const sorted = sortRows(cities, st.key, st.dir);
  registerSortRenderer('ga4-cities', renderGa4);

  const pct = r => totalSessions > 0 ? fP(r.sessions / totalSessions * 100) : '—';
  const eng = r => r.engagementRate != null ? fP(r.engagementRate * 100) : '—';
  // "(not set)" é sessão sem cidade identificada, não uma cidade — fora da contagem, dentro das sessões.
  const nCities = cities.filter(c => c.city !== '(not set)').length;
  const summary = `${fN(nCities)} ${nCities === 1 ? 'cidade' : 'cidades'} do RS · ${fN(citySessions)} sessões${totalSessions > 0 ? ` (${fP(citySessions / totalSessions * 100)} do site)` : ''}`;

  body.innerHTML = `
    <div class="kpi-grid cols-4" style="margin-bottom:8px">${cards.join('')}</div>
    ${ga4Note(coverage)}
    <div class="card">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:4px">
        <div class="card-title" style="margin:0">📍 Cidades do RS (${disp(S.start)} → ${disp(S.end)})</div>
        <span class="c-muted" style="font-size:12px">${summary}</span>
      </div>
      <div class="table-wrap"><table>
        <thead><tr>
          <th>Cidade</th>
          ${sortTh('ga4-cities', 'Sessões', 'sessions')}
          <th class="r">% das sessões</th>
          ${sortTh('ga4-cities', 'Pageviews', 'pageviews')}
          ${sortTh('ga4-cities', 'Taxa de engajamento', 'engagementRate')}
        </tr></thead>
        <tbody>${sorted.length ? sorted.slice(0, 100).map(r => `
          <tr>
            <td>${r.city === '(not set)' ? '<span class="c-muted">Não identificada</span>' : escHtml(r.city)}</td>
            <td class="r">${fN(r.sessions)}</td>
            <td class="r">${pct(r)}</td>
            <td class="r">${fN(r.pageviews)}</td>
            <td class="r">${eng(r)}</td>
          </tr>`).join('') : emptyRow(5, 'Sem dados de cidade no período')}</tbody>
      </table></div>
    </div>
  `;
}
