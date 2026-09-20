// Site (Google Analytics 4) — acessos do site por marca: sessões, novos usuários, pageviews,
// taxa de engajamento, canais de tráfego e cidades. Mesmo estilo de card com sparkline da aba
// Busca Orgânica (orgMetricCard, js/tabs/organico.js) + tabelas ordenáveis. Dado vem de
// buildGa4 (js/aggregate.js) — leia lá por que só métricas aditivas entram (sem "usuários
// ativos" nem eventos-chave).
let _ga4Data = null;

// sessionDefaultChannelGroup vem do GA4 em inglês; o que não estiver aqui aparece como veio.
const GA4_CHANNELS_PT = {
  'Direct': 'Direto',
  'Organic Search': 'Busca orgânica',
  'Paid Search': 'Busca paga',
  'Paid Social': 'Social pago',
  'Organic Social': 'Social orgânico',
  'Paid Shopping': 'Shopping pago',
  'Organic Shopping': 'Shopping orgânico',
  'Paid Video': 'Vídeo pago',
  'Organic Video': 'Vídeo orgânico',
  'Paid Other': 'Outros pagos',
  'Cross-network': 'Cross-network (PMax/Demand Gen)',
  'Referral': 'Referência',
  'Email': 'E-mail',
  'Display': 'Display',
  'AI Assistant': 'Assistente de IA',
  'Unassigned': 'Não atribuído',
};

async function tabGa4() {
  loading();
  _ga4Data = null;
  await renderGa4();
}

function ga4Note(coverage, hasCities) {
  const cov = hasCities && coverage != null
    ? ` As cidades listadas cobrem ${fP(coverage * 100)} das sessões do período (o sync guarda as 30 cidades com mais sessões por dia; a cauda menor fica de fora).`
    : '';
  return `<div class="c-muted" style="font-size:12px;margin:-8px 0 16px">
    "Novos usuários" é somável entre dias; "usuários ativos" não é (a mesma pessoa em 2 dias contaria 2x), por isso não aparece. Taxa de engajamento = sessões engajadas ÷ sessões do período. O GA4 revisa os números dos últimos ~14 dias, então o fim do período pode mudar um pouco.${cov}
  </div>`;
}

function ga4Table(tableId, title, firstColsHead, rows, totalSessions, rowHtml, emptyMsg) {
  const st = getSort(tableId, 'sessions', 'desc');
  const sorted = sortRows(rows, st.key, st.dir);
  registerSortRenderer(tableId, renderGa4);
  const cols = firstColsHead.length + 4;
  return `<div class="card" style="margin-bottom:16px">
    <div class="card-title">${title} (${disp(S.start)} → ${disp(S.end)})</div>
    <div class="table-wrap"><table>
      <thead><tr>
        ${firstColsHead.map(h => `<th>${h}</th>`).join('')}
        ${sortTh(tableId, 'Sessões', 'sessions')}
        <th class="r">% das sessões</th>
        ${sortTh(tableId, 'Pageviews', 'pageviews')}
        ${sortTh(tableId, 'Taxa de engajamento', 'engagementRate')}
      </tr></thead>
      <tbody>${sorted.length ? sorted.slice(0, 100).map(r => rowHtml(r, totalSessions)).join('') : emptyRow(cols, emptyMsg)}</tbody>
    </table></div>
  </div>`;
}

async function renderGa4() {
  const body = document.getElementById('content');
  body.innerHTML = `<div class="loading"><div class="spinner"></div>Carregando Site (GA4)…</div>`;

  if (!_ga4Data) {
    const brandData = await loadBrandData(S.brand);
    _ga4Data = buildGa4(brandData, S.start, S.end);
  }
  const { daily, channels, cities } = _ga4Data;

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

  const pct = (r, total) => total > 0 ? fP(r.sessions / total * 100) : '—';
  const eng = r => r.engagementRate != null ? fP(r.engagementRate * 100) : '—';

  const channelsHtml = ga4Table('ga4-channels', '🚦 Canais de Tráfego', ['Canal'], channels, totalSessions,
    (r, total) => `<tr>
      <td>${escHtml(GA4_CHANNELS_PT[r.channel] || r.channel)}</td>
      <td class="r">${fN(r.sessions)}</td>
      <td class="r">${pct(r, total)}</td>
      <td class="r">${fN(r.pageviews)}</td>
      <td class="r">${eng(r)}</td>
    </tr>`, 'Sem dados de canal no período');

  const citiesHtml = ga4Table('ga4-cities', '📍 Cidades', ['Cidade', 'Estado'], cities, totalSessions,
    (r, total) => `<tr>
      <td>${r.city === '(not set)' ? '<span class="c-muted">Não identificada</span>' : escHtml(r.city)}</td>
      <td>${escHtml(r.region || '—')}</td>
      <td class="r">${fN(r.sessions)}</td>
      <td class="r">${pct(r, total)}</td>
      <td class="r">${fN(r.pageviews)}</td>
      <td class="r">${eng(r)}</td>
    </tr>`, 'Sem dados de cidade no período');

  body.innerHTML = `
    <div class="kpi-grid cols-4" style="margin-bottom:8px">${cards.join('')}</div>
    ${ga4Note(coverage, cities.length > 0)}
    ${channelsHtml}
    ${citiesHtml}
  `;
}
