// Google Ads — dropdown de campanha (seleção única) + filtro de funil + KPIs +
// gráfico diário + tabela. Porta de js/tabs/google.js do dashboard original: só
// troca apiGet('google-campaigns') por buildGoogleCampaigns() (js/aggregate.js).
let _googleRaw = null; // [{campaign_name, funnel_stage, date, spend, clicks, conversions, conversion_value}]
let _googleFilter = null; // null = todas as campanhas
let _googleFunnelFilter = null; // null | 'topo' | 'vendas'

async function tabGoogle() {
  loading();
  const brandData = await loadBrandData(S.brand);
  const data = buildGoogleCampaigns(brandData, S.start, S.end);
  _googleRaw = data.rows;
  _googleFilter = null;
  _googleFunnelFilter = null;
  registerSortRenderer('google', () => renderGoogleBody());
  renderGoogleBody();
}

function renderGoogleBody(filterCamp, filterFunnel) {
  if (filterCamp !== undefined) _googleFilter = filterCamp || null;
  if (filterFunnel !== undefined) _googleFunnelFilter = filterFunnel || null;
  if (!_googleRaw) return;

  const funnelScoped = _googleFunnelFilter ? _googleRaw.filter(r => r.funnel_stage === _googleFunnelFilter) : _googleRaw;
  const rows = _googleFilter ? funnelScoped.filter(r => r.campaign_name === _googleFilter) : funnelScoped;

  const byCamp = {};
  for (const r of rows) {
    if (!byCamp[r.campaign_name]) byCamp[r.campaign_name] = { campaign_name: r.campaign_name, funnel_stage: r.funnel_stage, spend: 0, clicks: 0, conversions: 0, conversion_value: 0 };
    byCamp[r.campaign_name].spend            += Number(r.spend);
    byCamp[r.campaign_name].clicks           += Number(r.clicks);
    byCamp[r.campaign_name].conversions      += Number(r.conversions);
    byCamp[r.campaign_name].conversion_value += Number(r.conversion_value);
  }
  const campRows = Object.values(byCamp).map(r => ({
    ...r,
    cac: r.conversions > 0 ? r.spend / r.conversions : null,
    roas: r.spend > 0 ? r.conversion_value / r.spend : null,
  }));

  const st = getSort('google', 'spend', 'desc');
  const sorted = sortRows(campRows, st.key, st.dir);

  const totSpend = sum(campRows, 'spend'), totClicks = sum(campRows, 'clicks'), totConv = sum(campRows, 'conversions');
  const totConvValue = sum(campRows, 'conversion_value');
  // Ticket médio usa só as conversões das campanhas "venda(s)" no nome — dividir pelo total geral
  // (que inclui campanhas de topo/tráfego sem valor associado) subestimaria o ticket.
  const totSalesConv = sum(campRows.filter(r => /venda/i.test(r.campaign_name)), 'conversions');
  const totCAC = totConv > 0 ? totSpend / totConv : null;
  const totTicket = totSalesConv > 0 ? totConvValue / totSalesConv : null;
  const totROAS = totSpend > 0 ? totConvValue / totSpend : null;

  const byDate = {};
  for (const r of rows) {
    if (!byDate[r.date]) byDate[r.date] = { date: r.date, spend: 0, conversions: 0 };
    byDate[r.date].spend       += Number(r.spend);
    byDate[r.date].conversions += Number(r.conversions);
  }
  const chartRows = Object.values(byDate).sort((a, b) => a.date < b.date ? -1 : 1);

  const allCampaigns = [...new Set(funnelScoped.map(r => r.campaign_name))].sort();

  document.getElementById('content').innerHTML = `
    <div style="margin-bottom:16px;display:flex;align-items:center;gap:20px;flex-wrap:wrap">
      <div style="display:flex;align-items:center;gap:10px">
        <label style="font-size:12px;color:var(--muted-dark)">Campanha</label>
        <select class="filter-select" onchange="renderGoogleBody(this.value)" style="min-width:280px">
          <option value="">Todas as Campanhas</option>
          ${allCampaigns.map(c => `<option value="${escAttr(c)}" ${_googleFilter === c ? 'selected' : ''}>${escHtml(c)}</option>`).join('')}
        </select>
      </div>
      <div style="display:flex;align-items:center;gap:10px">
        <label style="font-size:12px;color:var(--muted-dark)">Filtrar Funil</label>
        <select class="filter-select" onchange="renderGoogleBody(undefined, this.value||null)">
          <option value="" ${!_googleFunnelFilter ? 'selected' : ''}>Topo + Vendas</option>
          <option value="vendas" ${_googleFunnelFilter === 'vendas' ? 'selected' : ''}>Só Vendas/Conversão</option>
          <option value="topo" ${_googleFunnelFilter === 'topo' ? 'selected' : ''}>Só Topo de Funil</option>
        </select>
      </div>
    </div>

    <div class="kpi-grid cols-4" style="margin-bottom:12px">
      ${kpiCard('Investimento', totSpend, undefined, fR, 'c-blue')}
      ${kpiCard('Cliques', totClicks, undefined, fN, 'c-green')}
      ${kpiCard('Conversões', totConv, undefined, fN, 'c-brand')}
      ${kpiCard('CAC Médio', totCAC, undefined, fR, 'c-brand', true)}
    </div>
    <div class="kpi-grid cols-3" style="margin-bottom:20px">
      ${kpiCard('Valor de Vendas', totConvValue, undefined, fR, 'c-green')}
      ${kpiCard('Ticket Médio', totTicket, undefined, fR, 'c-blue')}
      ${kpiCard('ROAS', totROAS, undefined, fX, 'c-brand')}
    </div>

    <div class="card" style="margin-bottom:16px">
      <div class="card-title">Investimento diário</div>
      <div style="height:260px">
        ${chartRows.length ? '<canvas id="googleChart"></canvas>' : '<div class="c-muted" style="text-align:center;padding:40px">Sem dados</div>'}
      </div>
    </div>

    <div class="card">
      <div class="card-title">Google Ads — Campanhas (${disp(S.start)} → ${disp(S.end)})</div>
      <div class="table-wrap"><table>
        <thead><tr>
          ${sortTh('google', 'Campanha', 'campaign_name', 'asc', '')}
          <th>Funil</th>
          ${sortTh('google', 'Investimento', 'spend')}
          ${sortTh('google', 'Cliques', 'clicks')}
          ${sortTh('google', 'Conversões', 'conversions')}
          ${sortTh('google', 'CAC', 'cac')}
          ${sortTh('google', 'Valor Vendas', 'conversion_value')}
          ${sortTh('google', 'ROAS', 'roas')}
        </tr></thead>
        <tbody>${sorted.length ? sorted.map(r => `
          <tr>
            <td><strong>${escHtml(r.campaign_name)}</strong></td>
            <td>${funnelBadge(r.funnel_stage)}</td>
            <td class="r">${fR(r.spend)}</td>
            <td class="r">${fN(r.clicks)}</td>
            <td class="r">${fN(r.conversions)}</td>
            <td class="r">${r.cac != null ? fR(r.cac) : '—'}</td>
            <td class="r">${fR(r.conversion_value)}</td>
            <td class="r">${r.roas != null ? fX(r.roas) : '—'}</td>
          </tr>`).join('') : emptyRow(8)}</tbody>
      </table></div>
    </div>
  `;

  if (chartRows.length) {
    renderComboChart('googleChart', chartRows.map(r => disp(r.date)),
      [{ label: 'Investimento', data: chartRows.map(r => r.spend), backgroundColor: '#2563eb' }],
      [{ label: 'Conversões', data: chartRows.map(r => r.conversions), borderColor: '#16a34a', yAxisID: 'y1' }]);
  }
}
