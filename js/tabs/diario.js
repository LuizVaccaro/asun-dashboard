// Desempenho Diário — visão geral somando as plataformas. Porta de
// js/tabs/diario.js do dashboard original: só troca apiGet('daily-performance'/
// 'kpis-overview') por buildDailyPerformance/buildKpisOverview (js/aggregate.js),
// que agregam localmente a partir do dump já carregado por loadBrandData().
//
// Filtro de Funil (Topo x Vendas): campanhas de topo de funil (alcance/reconhecimento)
// não têm intenção direta de compra — misturar com campanhas de vendas distorce o CAC/
// ROAS. Por isso o filtro de funil existe ao lado do filtro de canal, e todos os KPIs
// (incluindo os cards de Meta Ads/Google Ads) são recalculados a partir das linhas já
// filtradas no cliente, sem novo fetch.
let _diarioRaw = null;      // linhas cruas: [{date, platform, funnel_stage, spend, clicks, conversions, conversion_value, sales_conversions}]
let _diarioTotals = null;   // {totals} — só usada pra comparação de período
let _diarioChannelFilter = null; // null | 'Meta Ads' | 'Google Ads'
let _diarioFunnelFilter = null;  // null | 'topo' | 'vendas'

async function tabDiario() {
  loading();
  const data = await loadBrandData(S.brand);

  const totals = buildKpisOverview(data, S.start, S.end,
    S.compare && S.cmpStart && S.cmpEnd ? S.cmpStart : undefined,
    S.compare && S.cmpStart && S.cmpEnd ? S.cmpEnd : undefined);
  const daily = buildDailyPerformance(data, S.start, S.end);

  _diarioTotals = totals;
  _diarioRaw = daily.rows;
  _diarioChannelFilter = null;
  _diarioFunnelFilter = null;
  registerSortRenderer('diario', () => renderDiarioBody());
  renderDiarioBody();
}

function filterDiarioRows(rows, channelFilter, funnelFilter) {
  return rows.filter(r =>
    (!channelFilter || r.platform === channelFilter) &&
    (!funnelFilter || r.funnel_stage === funnelFilter));
}

function buildDiarioRows(rows) {
  const byDate = {};
  for (const r of rows) {
    if (!byDate[r.date]) byDate[r.date] = { date: r.date, spend: 0, clicks: 0, conversions: 0, conversion_value: 0, sales_conversions: 0 };
    byDate[r.date].spend            += Number(r.spend);
    byDate[r.date].clicks           += Number(r.clicks);
    byDate[r.date].conversions      += Number(r.conversions);
    byDate[r.date].conversion_value += Number(r.conversion_value);
    byDate[r.date].sales_conversions += Number(r.sales_conversions);
  }
  return Object.values(byDate).map(r => ({
    ...r,
    cac: r.conversions > 0 ? r.spend / r.conversions : null,
    // CAC de Vendas: só conta a conversão de venda (purchase) real, não todo evento (lead/whatsapp
    // misturado junto). É o número que bate quando se olha por plataforma/campanha — no agregado
    // geral, o CAC "de todas as conversões" fica artificialmente baixo por causa desses outros
    // eventos com custo por ação muito menor.
    cac_vendas: r.sales_conversions > 0 ? r.spend / r.sales_conversions : null,
    roas: r.spend > 0 ? r.conversion_value / r.spend : null,
  }));
}

function renderDiarioBody(filterChannel, filterFunnel) {
  if (filterChannel !== undefined) _diarioChannelFilter = filterChannel;
  if (filterFunnel !== undefined) _diarioFunnelFilter = filterFunnel;
  if (!_diarioRaw) return;

  const filtered = filterDiarioRows(_diarioRaw, _diarioChannelFilter, _diarioFunnelFilter);
  const rows = buildDiarioRows(filtered);

  const totSpend = sum(rows, 'spend'), totClicks = sum(rows, 'clicks'), totConv = sum(rows, 'conversions');
  const totConvValue = sum(rows, 'conversion_value');
  const totSalesConv = sum(rows, 'sales_conversions');
  // CAC Médio do card usa só conversões de venda (purchase), não o total de conversões —
  // mistura de lead/whatsapp/purchase no agregado geral distorcia o número pra baixo.
  const totCAC = totSalesConv > 0 ? totSpend / totSalesConv : null;
  const totTicket = totSalesConv > 0 ? totConvValue / totSalesConv : null;
  const totROAS = totSpend > 0 ? totConvValue / totSpend : null;

  const funnelRows = filterDiarioRows(_diarioRaw, _diarioChannelFilter, null);
  const metaSpend   = sum(funnelRows.filter(r => r.platform === 'Meta Ads' && (!_diarioFunnelFilter || r.funnel_stage === _diarioFunnelFilter)), 'spend');
  const googleSpend = sum(funnelRows.filter(r => r.platform === 'Google Ads' && (!_diarioFunnelFilter || r.funnel_stage === _diarioFunnelFilter)), 'spend');

  const st = getSort('diario', 'date', 'desc');
  const sorted = sortRows(rows, st.key, st.dir);

  document.getElementById('content').innerHTML = `
    <div style="margin-bottom:16px;display:flex;align-items:center;gap:20px;flex-wrap:wrap">
      <div style="display:flex;align-items:center;gap:10px">
        <label style="font-size:12px;color:var(--muted-dark);white-space:nowrap">Filtrar Canal</label>
        <select class="filter-select" onchange="renderDiarioBody(this.value||null)">
          <option value="" ${!_diarioChannelFilter ? 'selected' : ''}>Todos os Canais</option>
          <option value="Meta Ads" ${_diarioChannelFilter === 'Meta Ads' ? 'selected' : ''}>Meta Ads</option>
          <option value="Google Ads" ${_diarioChannelFilter === 'Google Ads' ? 'selected' : ''}>Google Ads</option>
        </select>
      </div>
      <div style="display:flex;align-items:center;gap:10px">
        <label style="font-size:12px;color:var(--muted-dark);white-space:nowrap">Filtrar Funil</label>
        <select class="filter-select" onchange="renderDiarioBody(undefined, this.value||null)">
          <option value="" ${!_diarioFunnelFilter ? 'selected' : ''}>Topo + Vendas</option>
          <option value="vendas" ${_diarioFunnelFilter === 'vendas' ? 'selected' : ''}>Só Vendas/Conversão</option>
          <option value="topo" ${_diarioFunnelFilter === 'topo' ? 'selected' : ''}>Só Topo de Funil</option>
        </select>
      </div>
    </div>

    <div class="kpi-grid cols-4" style="margin-bottom:12px">
      ${kpiCard('Investimento Total', totSpend, _diarioTotals.totals?.cmpSpend, fR, 'c-brand')}
      ${kpiCard('Meta Ads', metaSpend, undefined, fR, 'c-orange')}
      ${kpiCard('Google Ads', googleSpend, undefined, fR, 'c-blue')}
      ${kpiCard('Conversões', totConv, _diarioTotals.totals?.cmpConversions, fN, 'c-green')}
    </div>
    <div class="kpi-grid cols-4" style="margin-bottom:20px">
      ${kpiCard('CAC Médio', totCAC, undefined, fR, 'c-brand', true)}
      ${kpiCard('Valor de Vendas', totConvValue, undefined, fR, 'c-green')}
      ${kpiCard('Ticket Médio', totTicket, undefined, fR, 'c-blue')}
      ${kpiCard('ROAS', totROAS, undefined, fX, 'c-brand')}
    </div>

    <div class="card" style="margin-bottom:16px">
      <div class="card-title">Investimento x Conversões (diário)</div>
      <div style="height:280px">
        ${sorted.length ? '<canvas id="diarioChart"></canvas>' : '<div class="c-muted" style="text-align:center;padding:40px">Sem dados</div>'}
      </div>
    </div>

    <div class="card">
      <div class="card-title">Performance Diária — ${disp(S.start)} → ${disp(S.end)}</div>
      <div class="table-wrap"><table>
        <thead><tr>
          ${sortTh('diario', 'Data', 'date', 'desc', '')}
          ${sortTh('diario', 'Investimento', 'spend')}
          ${sortTh('diario', 'Cliques', 'clicks')}
          ${sortTh('diario', 'Conversões', 'conversions')}
          ${sortTh('diario', 'CAC', 'cac')}
          ${sortTh('diario', 'Vendas', 'sales_conversions')}
          ${sortTh('diario', 'CAC Vendas', 'cac_vendas')}
          ${sortTh('diario', 'Valor Vendas', 'conversion_value')}
          ${sortTh('diario', 'ROAS', 'roas')}
        </tr></thead>
        <tbody>${sorted.length ? sorted.map(r => `
          <tr>
            <td><strong>${disp(r.date)}</strong></td>
            <td class="r">${fR(r.spend)}</td>
            <td class="r">${fN(r.clicks)}</td>
            <td class="r">${fN(r.conversions)}</td>
            <td class="r">${r.cac != null ? fR(r.cac) : '—'}</td>
            <td class="r">${fN(r.sales_conversions)}</td>
            <td class="r">${r.cac_vendas != null ? fR(r.cac_vendas) : '—'}</td>
            <td class="r">${fR(r.conversion_value)}</td>
            <td class="r">${r.roas != null ? fX(r.roas) : '—'}</td>
          </tr>`).join('') : emptyRow(9)}</tbody>
      </table></div>
    </div>
  `;

  if (sorted.length) {
    const chrono = [...sorted].sort((a, b) => a.date < b.date ? -1 : 1);
    renderComboChart('diarioChart', chrono.map(r => disp(r.date)),
      [{ label: 'Investimento', data: chrono.map(r => r.spend), backgroundColor: '#2563eb' }],
      [
        { label: 'Conversões', data: chrono.map(r => r.conversions), borderColor: '#16a34a', yAxisID: 'y1' },
        { label: 'CAC Vendas', data: chrono.map(r => r.cac_vendas), borderColor: '#e0435a', yAxisID: 'y', borderDash: [5, 3] },
      ]);
  }
}
