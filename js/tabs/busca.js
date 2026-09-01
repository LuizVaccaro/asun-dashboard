// Busca Orgânica (Google Search Console) — cliques/impressões/CTR/posição média do
// tráfego orgânico do Google, por marca. Mesmo estilo de card com sparkline usado na
// aba Orgânico (js/tabs/organico.js: orgMetricCard/orgStatCard/orgAxisChart), mais duas
// tabelas ordenáveis (principais buscas e páginas) — dado vem de
// buildSearchConsole (js/aggregate.js), que já agrega dia×termo/página em totais por
// termo/página no período selecionado.
let _buscaData = null;

async function tabBusca() {
  loading();
  _buscaData = null;
  await renderBusca();
}

function buscaCtrPositionNote() {
  return `<div class="c-muted" style="font-size:12px;margin:-8px 0 16px">
    CTR e Posição Média são recalculados a partir dos cliques/impressões do período (não é a média simples dos CTRs/posições diárias) — mesmo critério que o próprio Search Console usa. Dado do Search Console costuma levar 2-3 dias pra ficar definitivo; os últimos dias do período podem não aparecer ainda.
  </div>`;
}

async function renderBusca() {
  const body = document.getElementById('content');
  body.innerHTML = `<div class="loading"><div class="spinner"></div>Carregando Busca Orgânica…</div>`;

  if (!_buscaData) {
    const brandData = await loadBrandData(S.brand);
    _buscaData = buildSearchConsole(brandData, S.start, S.end);
  }
  const { daily, queries, pages } = _buscaData;
  const dates = daily.map(d => d.date);
  const totalClicks = sum(daily, 'clicks');
  const totalImpressions = sum(daily, 'impressions');
  const avgCtr = totalImpressions > 0 ? totalClicks / totalImpressions : null;
  const avgPosition = totalImpressions > 0
    ? daily.reduce((s, d) => s + (Number(d.position) || 0) * (Number(d.impressions) || 0), 0) / totalImpressions
    : null;

  // CTR/Posição não são inteiros (orgStatCard formata com fN) — card custom com fP/toFixed(1).
  const statCard = (icon, label, valueHtml, color) => `<div class="card">
    <div class="kpi-label">${icon} ${label}</div>
    <div class="kpi-value" style="color:${color}">${valueHtml}</div>
    <div style="height:8px"></div>
  </div>`;

  const cards = [
    orgMetricCard('🔍', 'Cliques', dates, daily.map(d => +d.clicks || 0), totalClicks, '#2563eb'),
    orgMetricCard('👁️', 'Impressões', dates, daily.map(d => +d.impressions || 0), totalImpressions, '#9551FB'),
    statCard('🎯', 'CTR Médio', fP(avgCtr != null ? avgCtr * 100 : null), '#16a34a'),
    statCard('📍', 'Posição Média', avgPosition != null ? avgPosition.toFixed(1) : '—', '#ed723e'),
  ];

  const stQ = getSort('sc-queries', 'clicks', 'desc');
  const sortedQueries = sortRows(queries, stQ.key, stQ.dir);
  registerSortRenderer('sc-queries', renderBusca);

  const stP = getSort('sc-pages', 'clicks', 'desc');
  const sortedPages = sortRows(pages, stP.key, stP.dir);
  registerSortRenderer('sc-pages', renderBusca);

  body.innerHTML = `
    <div class="kpi-grid cols-4" style="margin-bottom:8px">${cards.join('')}</div>
    ${buscaCtrPositionNote()}
    <div class="card" style="margin-bottom:16px">
      <div class="card-title">🔍 Principais Buscas (${disp(S.start)} → ${disp(S.end)})</div>
      <div class="table-wrap"><table>
        <thead><tr>
          <th>Termo de busca</th>
          ${sortTh('sc-queries', 'Cliques', 'clicks')}
          ${sortTh('sc-queries', 'Impressões', 'impressions')}
          ${sortTh('sc-queries', 'CTR', 'ctr')}
          ${sortTh('sc-queries', 'Posição', 'position', 'asc')}
        </tr></thead>
        <tbody>${sortedQueries.length ? sortedQueries.slice(0, 100).map(r => `
          <tr>
            <td>${escHtml(r.query)}</td>
            <td class="r">${fN(r.clicks)}</td>
            <td class="r">${fN(r.impressions)}</td>
            <td class="r">${fP(r.ctr * 100)}</td>
            <td class="r">${r.position != null ? r.position.toFixed(1) : '—'}</td>
          </tr>`).join('') : emptyRow(5, 'Sem dados de busca no período')}</tbody>
      </table></div>
    </div>
    <div class="card">
      <div class="card-title">📄 Páginas Mais Acessadas (${disp(S.start)} → ${disp(S.end)})</div>
      <div class="table-wrap"><table>
        <thead><tr>
          <th>Página</th>
          ${sortTh('sc-pages', 'Cliques', 'clicks')}
          ${sortTh('sc-pages', 'Impressões', 'impressions')}
          ${sortTh('sc-pages', 'CTR', 'ctr')}
          ${sortTh('sc-pages', 'Posição', 'position', 'asc')}
        </tr></thead>
        <tbody>${sortedPages.length ? sortedPages.slice(0, 100).map(r => `
          <tr>
            <td><a href="${escHtml(r.page)}" target="_blank" rel="noopener" style="color:var(--brand);text-decoration:none">${escHtml(r.page)}</a></td>
            <td class="r">${fN(r.clicks)}</td>
            <td class="r">${fN(r.impressions)}</td>
            <td class="r">${fP(r.ctr * 100)}</td>
            <td class="r">${r.position != null ? r.position.toFixed(1) : '—'}</td>
          </tr>`).join('') : emptyRow(5, 'Sem dados de página no período')}</tbody>
      </table></div>
    </div>
  `;
}
