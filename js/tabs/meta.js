// Meta Ads — sub-abas Campanhas e Criativos. Porta de js/tabs/meta.js do dashboard
// original: só troca apiGet('meta-campaigns'/'meta-creatives') por
// buildMetaCampaigns/buildMetaCreatives (js/aggregate.js).
let _metaSubTab = 'campanhas';
let _metaCampRaw = null;       // [{campaign_name, funnel_stage, date, spend, clicks, conversions, conversion_value}]
let _metaCampFilter = null;
let _metaCampFunnelFilter = null; // null | 'topo' | 'vendas'
let _metaCreativeRaw = null;   // [{campaign_name, adset_name, creative_name, creative_format, thumbnail_url, permalink_url, spend, clicks, conversions, reach}]
// Filtros de Criativos são multi-seleção (msState/renderMultiSelect em utils.js) — permite
// comparar o resultado de mais de uma campanha/conjunto de uma vez.

function metaSubtabBtn(id, label) {
  const active = _metaSubTab === id;
  return `<button class="subtab-btn${active ? ' active' : ''}" onclick="switchMetaSubTab('${id}')">${label}</button>`;
}

function renderMetaSubtabs() {
  return `<div class="subtabs">${metaSubtabBtn('campanhas', 'Campanhas')}${metaSubtabBtn('criativos', 'Criativos')}</div>`;
}

async function tabMeta() {
  loading();
  ensureCreativeModal();
  _metaSubTab = 'campanhas';
  _metaCampFilter = null;
  _metaCampFunnelFilter = null;
  _metaCreativeRaw = null;
  msReset('metaCreativeCampaigns');
  msReset('metaCreativeAdsets');

  const brandData = await loadBrandData(S.brand);
  const data = buildMetaCampaigns(brandData, S.start, S.end);
  _metaCampRaw = data.rows;
  registerSortRenderer('meta-campanhas', () => { if (_metaSubTab === 'campanhas') renderMetaCampanhas(); });

  document.getElementById('content').innerHTML = `<div id="m-subtabs">${renderMetaSubtabs()}</div><div id="m-subtab-body"></div>`;
  renderMetaCampanhas();
}

async function switchMetaSubTab(id) {
  _metaSubTab = id;
  document.getElementById('m-subtabs').innerHTML = renderMetaSubtabs();
  if (id === 'campanhas') { renderMetaCampanhas(); return; }

  const body = document.getElementById('m-subtab-body');
  body.innerHTML = `<div class="loading"><div class="spinner"></div>Carregando criativos…</div>`;
  if (!_metaCreativeRaw) {
    const brandData = await loadBrandData(S.brand);
    const data = buildMetaCreatives(brandData, S.start, S.end);
    _metaCreativeRaw = data.rows;
  }
  if (_metaSubTab === 'criativos') renderMetaCriativos();
}

function renderMetaCampanhas(filterCamp, filterFunnel) {
  if (filterCamp !== undefined) _metaCampFilter = filterCamp || null;
  if (filterFunnel !== undefined) _metaCampFunnelFilter = filterFunnel || null;
  if (!_metaCampRaw) return;

  const funnelScoped = _metaCampFunnelFilter ? _metaCampRaw.filter(r => r.funnel_stage === _metaCampFunnelFilter) : _metaCampRaw;
  const rows = _metaCampFilter ? funnelScoped.filter(r => r.campaign_name === _metaCampFilter) : funnelScoped;

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

  const st = getSort('meta-campanhas', 'spend', 'desc');
  const sorted = sortRows(campRows, st.key, st.dir);

  const totSpend = sum(campRows, 'spend'), totClicks = sum(campRows, 'clicks'), totConv = sum(campRows, 'conversions');
  const totConvValue = sum(campRows, 'conversion_value');
  // Ticket médio usa só as conversões das campanhas "venda(s)" no nome (mesma lógica do google.js).
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

  document.getElementById('m-subtab-body').innerHTML = `
    <div style="margin-bottom:16px;display:flex;align-items:center;gap:20px;flex-wrap:wrap">
      <div style="display:flex;align-items:center;gap:10px">
        <label style="font-size:12px;color:var(--muted-dark)">Campanha</label>
        <select class="filter-select" onchange="renderMetaCampanhas(this.value)" style="min-width:280px">
          <option value="">Todas as Campanhas</option>
          ${allCampaigns.map(c => `<option value="${escAttr(c)}" ${_metaCampFilter === c ? 'selected' : ''}>${escHtml(c)}</option>`).join('')}
        </select>
      </div>
      <div style="display:flex;align-items:center;gap:10px">
        <label style="font-size:12px;color:var(--muted-dark)">Filtrar Funil</label>
        <select class="filter-select" onchange="renderMetaCampanhas(undefined, this.value||null)">
          <option value="" ${!_metaCampFunnelFilter ? 'selected' : ''}>Topo + Vendas</option>
          <option value="vendas" ${_metaCampFunnelFilter === 'vendas' ? 'selected' : ''}>Só Vendas/Conversão</option>
          <option value="topo" ${_metaCampFunnelFilter === 'topo' ? 'selected' : ''}>Só Topo de Funil</option>
        </select>
      </div>
    </div>

    <div class="kpi-grid cols-4" style="margin-bottom:12px">
      ${kpiCard('Investimento', totSpend, undefined, fR, 'c-orange')}
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
        ${chartRows.length ? '<canvas id="metaChart"></canvas>' : '<div class="c-muted" style="text-align:center;padding:40px">Sem dados</div>'}
      </div>
    </div>

    <div class="card">
      <div class="card-title">Meta Ads — Campanhas (${disp(S.start)} → ${disp(S.end)})</div>
      <div class="table-wrap"><table>
        <thead><tr>
          ${sortTh('meta-campanhas', 'Campanha', 'campaign_name', 'asc', '')}
          <th>Funil</th>
          ${sortTh('meta-campanhas', 'Investimento', 'spend')}
          ${sortTh('meta-campanhas', 'Cliques', 'clicks')}
          ${sortTh('meta-campanhas', 'Conversões', 'conversions')}
          ${sortTh('meta-campanhas', 'CAC', 'cac')}
          ${sortTh('meta-campanhas', 'Valor Vendas', 'conversion_value')}
          ${sortTh('meta-campanhas', 'ROAS', 'roas')}
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
    renderComboChart('metaChart', chartRows.map(r => disp(r.date)),
      [{ label: 'Investimento', data: chartRows.map(r => r.spend), backgroundColor: '#ed723e' }],
      [{ label: 'Conversões', data: chartRows.map(r => r.conversions), borderColor: '#16a34a', yAxisID: 'y1' }]);
  }
}

function renderMetaCriativos() {
  if (!_metaCreativeRaw) return;

  const selCampaigns = msState('metaCreativeCampaigns').selected;
  const selAdsets = msState('metaCreativeAdsets').selected;
  const rows = _metaCreativeRaw.filter(r =>
    (selCampaigns.size === 0 || selCampaigns.has(r.campaign_name)) &&
    (selAdsets.size === 0 || selAdsets.has(r.adset_name)));
  const sorted = rows.slice().sort((a, b) => b.spend - a.spend);

  const allCampaigns = [...new Set(_metaCreativeRaw.map(r => r.campaign_name))].sort();
  const allAdsets = [...new Set(_metaCreativeRaw.map(r => r.adset_name))].sort();

  document.getElementById('m-subtab-body').innerHTML = `
    <div style="margin-bottom:16px;display:flex;align-items:center;gap:20px;flex-wrap:wrap">
      ${renderMultiSelect('metaCreativeCampaigns', 'Campanha', 'Todas as Campanhas', allCampaigns, 'renderMetaCriativos', 280)}
      ${renderMultiSelect('metaCreativeAdsets', 'Conjunto de Anúncios', 'Todos os Conjuntos', allAdsets, 'renderMetaCriativos', 280)}
    </div>
    <div class="card">
      <div class="card-title">Meta Ads — Criativos (${disp(S.start)} → ${disp(S.end)})</div>
      ${sorted.length ? sorted.map(metaCreativeRow).join('') : '<div class="c-muted" style="text-align:center;padding:40px">Sem dados</div>'}
    </div>
  `;
}

function metaCreativeRow(r) {
  return `
    <div class="top-row">
      ${previewThumb(r.creative_name, r.thumbnail_url, r.permalink_url, 56)}
      <div class="top-info">
        <div class="top-name">${escHtml(r.creative_name || '—')}</div>
        <div class="top-meta">${escHtml(r.campaign_name)} · ${escHtml(r.adset_name)}${r.creative_format ? ' · ' + escHtml(r.creative_format) : ''}</div>
      </div>
      <div class="top-metrics">
        <div class="metric"><span class="metric-label">Gasto</span><span class="metric-value">${fR(r.spend)}</span></div>
        <div class="metric"><span class="metric-label">Alcance</span><span class="metric-value">${fN(r.reach)}</span></div>
        <div class="metric"><span class="metric-label">Cliques</span><span class="metric-value">${fN(r.clicks)}</span></div>
        <div class="metric"><span class="metric-label">Conversões</span><span class="metric-value c-brand">${fN(r.conversions)}</span></div>
      </div>
    </div>`;
}
