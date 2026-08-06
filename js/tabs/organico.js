// Orgânico — sub-abas Instagram / Facebook, por marca. Porta de
// js/tabs/organico.js do dashboard original: só troca apiGet('instagram-organic'/
// 'facebook-organic') por buildInstagramOrganic/buildFacebookOrganic (js/aggregate.js).
// Layout de cards grandes (número + variação + mini-gráfico) inspirado no card
// "Desempenho" nativo do Gerenciador de Negócios da Meta. Duas famílias de card:
//   orgMetricCard  → métrica com série diária real (sparkline de verdade)
//   orgStatCard    → métrica que só existe como agregado do período pedido
//     (metric_type=total_value da API — não tem quebra diária, ver comentário
//     em asun-dashboard-sync/scripts/sync-organic.mjs)
// "Conversas" (mensageria) e "Conversões" (loja/catálogo) do card nativo da Meta
// não aparecem aqui: exigem permissões extras (mensageria) ou catálogo de
// produtos configurado, que essa conta não tem.
let _orgSubTab = 'instagram';
let _igOrgData = null;
let _fbOrgData = null;

function orgSubtabBtn(id, label) {
  const active = _orgSubTab === id;
  return `<button class="subtab-btn${active ? ' active' : ''}" onclick="switchOrgSubTab('${id}')">${label}</button>`;
}

function renderOrgSubtabs() {
  return `<div class="subtabs">${orgSubtabBtn('instagram', '📷 Instagram')}${orgSubtabBtn('facebook', '📘 Facebook')}</div>`;
}

async function tabOrganico() {
  loading();
  ensureCreativeModal();
  _orgSubTab = 'instagram';
  _igOrgData = null;
  _fbOrgData = null;

  document.getElementById('content').innerHTML = `<div id="org-subtabs">${renderOrgSubtabs()}</div><div id="org-subtab-body"></div>`;
  await renderInstagramOrganic();
}

async function switchOrgSubTab(id) {
  _orgSubTab = id;
  document.getElementById('org-subtabs').innerHTML = renderOrgSubtabs();
  if (id === 'instagram') await renderInstagramOrganic();
  else await renderFacebookOrganic();
}

// ── Mini-gráfico com grade horizontal ──
function orgFillForward(vals) {
  let last = 0;
  return vals.map(v => { if (v != null) last = v; return last; });
}

function orgAxisChart(dates, vals, color, height = 70) {
  const filled = orgFillForward(vals);
  if (!filled.length) return `<div style="height:${height}px"></div>`;
  const max = Math.max(...filled), min = Math.min(...filled);
  const range = (max - min) || 1;
  const stepX = 100 / ((filled.length - 1) || 1);
  const pts = filled.map((v, i) => `${(i * stepX).toFixed(2)},${(94 - (v - min) / range * 88).toFixed(2)}`).join(' ');

  return `<div style="position:relative;height:${height}px;margin-top:8px">
    <svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="none" style="display:block">
      <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
    </svg>
  </div>`;
}

// Card com série diária real (sparkline de verdade) + variação vs primeira metade do período.
function orgMetricCard(icon, label, dates, series, total, color, opts = {}) {
  const filled = orgFillForward(series);
  const half = Math.floor(filled.length / 2) || 1;
  const prevAvg = filled.slice(0, half).reduce((a, b) => a + b, 0) / half;
  const currAvg = filled.slice(half).reduce((a, b) => a + b, 0) / (filled.length - half || 1);
  const delta = prevAvg > 0 ? (currAvg - prevAvg) / prevAvg : null;
  const trendHtml = delta != null
    ? `<span class="${delta >= 0 ? 'd-up' : 'd-down'}" style="font-size:12px;font-weight:700">${delta >= 0 ? '↑' : '↓'} ${Math.abs(delta * 100).toFixed(1)}%</span>`
    : '';
  const sub = opts.sub ? `<div style="font-size:12px;color:var(--muted-dark);margin-top:6px">${opts.sub}</div>` : '';

  return `<div class="card">
    <div style="display:flex;align-items:center;justify-content:space-between">
      <div class="kpi-label">${icon} ${label}</div>
      ${trendHtml}
    </div>
    <div class="kpi-value" style="color:${color}">${fN(total)}</div>
    ${sub}
    ${orgAxisChart(dates, series, color)}
  </div>`;
}

// Card só com o agregado do período (métrica metric_type=total_value da Meta, sem quebra diária).
function orgStatCard(icon, label, total, color, sub) {
  return `<div class="card">
    <div class="kpi-label">${icon} ${label}</div>
    <div class="kpi-value" style="color:${color}">${fN(total)}</div>
    ${sub ? `<div style="font-size:12px;color:var(--muted-dark);margin-top:6px">${sub}</div>` : '<div style="height:8px"></div>'}
  </div>`;
}

function orgPeriodNote() {
  return `<div class="c-muted" style="font-size:12px;margin:-8px 0 16px">
    Visualizações, interações e cliques são o total do período selecionado (a Meta só entrega essas métricas agregadas, sem quebra por dia). "Conversas" e "Conversões" do Gerenciador não aparecem aqui — exigem permissão de mensageria e catálogo de produtos configurado, que essa conta não tem.
  </div>`;
}

// ── Instagram ────────────────────────────────────────────────────────────
async function renderInstagramOrganic() {
  const body = document.getElementById('org-subtab-body');
  body.innerHTML = `<div class="loading"><div class="spinner"></div>Carregando Instagram…</div>`;

  if (!_igOrgData) {
    const brandData = await loadBrandData(S.brand);
    _igOrgData = buildInstagramOrganic(brandData, S.start, S.end);
  }
  const { media, daily } = _igOrgData;
  const sortedDaily = daily.slice().sort((a, b) => a.date < b.date ? -1 : 1);
  const dates = sortedDaily.map(d => d.date);
  const s = (k) => sum(sortedDaily, k);
  const lastFollowers = [...sortedDaily].reverse().find(d => d.follower_count != null)?.follower_count ?? null;
  // views/follows_and_unfollows/accounts_engaged são metric_type=total_value: só um valor agregado
  // por sync (gravado no dia mais recente do range pedido), não uma série — pega o último não-nulo.
  const lastAgg = (k) => [...sortedDaily].reverse().find(d => d[k] != null)?.[k] ?? null;
  const netFollows = lastAgg('follows_and_unfollows');

  const cards = [
    orgMetricCard('👁️', 'Alcance', dates, sortedDaily.map(d => +d.reach || 0), s('reach'), '#16a34a'),
    orgMetricCard('👥', 'Seguidores', dates, sortedDaily.map(d => d.follower_count != null ? +d.follower_count : null), lastFollowers, 'var(--brand)',
      { sub: `Variação líquida no período: <strong>${netFollows == null ? '—' : (netFollows >= 0 ? '+' : '') + fN(netFollows)}</strong>` }),
    orgStatCard('🎬', 'Visualizações', lastAgg('views'), '#2563eb'),
    orgStatCard('💬', 'Interações', lastAgg('accounts_engaged'), '#9551FB', `${fN(lastAgg('total_interactions'))} interações no conteúdo`),
    orgStatCard('🔗', 'Cliques no Link', lastAgg('website_clicks'), '#ed723e'),
    orgStatCard('🙋', 'Visitas ao Perfil', lastAgg('profile_views'), '#e0435a'),
  ];

  const st = getSort('ig-media', 'posted_at', 'desc');
  const withEngagement = media.map(r => ({ ...r, engagement: (r.like_count || 0) + (r.comments_count || 0) + (r.saved || 0) + (r.shares || 0) }));
  const sorted = sortRows(withEngagement, st.key, st.dir);
  registerSortRenderer('ig-media', renderInstagramOrganic);

  body.innerHTML = `
    <div class="kpi-grid cols-3" style="margin-bottom:8px">${cards.join('')}</div>
    ${orgPeriodNote()}
    <div class="card">
      <div class="card-title">📷 Posts Orgânicos (${disp(S.start)} → ${disp(S.end)})</div>
      <div class="table-wrap"><table>
        <thead><tr>
          <th></th>
          <th>Tipo</th>
          ${sortTh('ig-media', 'Data', 'posted_at')}
          ${sortTh('ig-media', 'Alcance', 'reach')}
          ${sortTh('ig-media', 'Curtidas', 'like_count')}
          ${sortTh('ig-media', 'Comentários', 'comments_count')}
          ${sortTh('ig-media', 'Salvos', 'saved')}
          ${sortTh('ig-media', 'Engajamento', 'engagement')}
        </tr></thead>
        <tbody>${sorted.length ? sorted.map(r => `
          <tr>
            <td>${previewThumb(r.caption, r.thumbnail_url || r.media_url, r.permalink, 48)}</td>
            <td class="c-muted">${escHtml(r.media_product_type === 'REELS' ? 'Reels' : r.media_type === 'CAROUSEL_ALBUM' ? 'Carrossel' : r.media_type === 'VIDEO' ? 'Vídeo' : 'Foto')}</td>
            <td class="c-muted">${r.posted_at ? new Date(r.posted_at).toLocaleDateString('pt-BR') : '—'}</td>
            <td class="r">${fN(r.reach)}</td>
            <td class="r">${fN(r.like_count)}</td>
            <td class="r">${fN(r.comments_count)}</td>
            <td class="r">${fN(r.saved)}</td>
            <td class="r c-brand"><strong>${fN(r.engagement)}</strong></td>
          </tr>`).join('') : emptyRow(8, 'Sem posts no período')}</tbody>
      </table></div>
    </div>
  `;
}

// ── Facebook ─────────────────────────────────────────────────────────────
async function renderFacebookOrganic() {
  const body = document.getElementById('org-subtab-body');
  body.innerHTML = `<div class="loading"><div class="spinner"></div>Carregando Facebook…</div>`;

  if (!_fbOrgData) {
    const brandData = await loadBrandData(S.brand);
    _fbOrgData = buildFacebookOrganic(brandData, S.start, S.end);
  }
  const { posts, daily } = _fbOrgData;
  const sortedDaily = daily.slice().sort((a, b) => a.date < b.date ? -1 : 1);
  const dates = sortedDaily.map(d => d.date);
  const s = (k) => sum(sortedDaily, k);
  const followersSeries = sortedDaily.filter(d => d.page_follows != null);
  const lastFollows = followersSeries.length ? +followersSeries[followersSeries.length - 1].page_follows : null;
  const followDelta = followersSeries.length > 1 ? lastFollows - +followersSeries[0].page_follows : null;

  const cards = [
    orgMetricCard('👁️', 'Visualizações', dates, sortedDaily.map(d => +d.page_views || 0), s('page_views'), '#2563eb'),
    orgMetricCard('👥', 'Seguidores', dates, sortedDaily.map(d => d.page_follows != null ? +d.page_follows : null), lastFollows, 'var(--brand)',
      { sub: followDelta != null ? `Variação no período: <strong>${followDelta >= 0 ? '+' : ''}${fN(followDelta)}</strong>` : undefined }),
    orgMetricCard('💬', 'Interações', dates, sortedDaily.map(d => +d.page_engaged_users || 0), s('page_engaged_users'), '#9551FB'),
    orgMetricCard('🎬', 'Vídeos e Reels', dates, sortedDaily.map(d => +d.page_video_views || 0), s('page_video_views'), '#ed723e'),
  ];

  const st = getSort('fb-posts', 'created_time', 'desc');
  const withEngagement = posts.map(r => ({ ...r, engagement: (r.likes || 0) + (r.comments || 0) + (r.shares || 0) }));
  const sorted = sortRows(withEngagement, st.key, st.dir);
  registerSortRenderer('fb-posts', renderFacebookOrganic);

  body.innerHTML = `
    <div class="kpi-grid cols-4" style="margin-bottom:8px">${cards.join('')}</div>
    ${orgPeriodNote()}
    <div class="card">
      <div class="card-title">📘 Posts Orgânicos (${disp(S.start)} → ${disp(S.end)})</div>
      ${!sorted.length ? `<div class="c-muted" style="font-size:12px;margin-bottom:12px">A listagem de posts do Facebook precisa da permissão <code>pages_read_engagement</code> (separada da usada pros KPIs acima) — ainda não liberada nessa conta.</div>` : ''}
      <div class="table-wrap"><table>
        <thead><tr>
          <th></th>
          ${sortTh('fb-posts', 'Data', 'created_time')}
          ${sortTh('fb-posts', 'Alcance', 'reach')}
          ${sortTh('fb-posts', 'Curtidas', 'likes')}
          ${sortTh('fb-posts', 'Comentários', 'comments')}
          ${sortTh('fb-posts', 'Compart.', 'shares')}
          ${sortTh('fb-posts', 'Engajamento', 'engagement')}
        </tr></thead>
        <tbody>${sorted.length ? sorted.map(r => `
          <tr>
            <td>${previewThumb((r.message || '').slice(0, 60), r.thumbnail_url, r.permalink_url, 48)}</td>
            <td class="c-muted">${r.created_time ? new Date(r.created_time).toLocaleDateString('pt-BR') : '—'}</td>
            <td class="r">${fN(r.reach)}</td>
            <td class="r">${fN(r.likes)}</td>
            <td class="r">${fN(r.comments)}</td>
            <td class="r">${fN(r.shares)}</td>
            <td class="r c-brand"><strong>${fN(r.engagement)}</strong></td>
          </tr>`).join('') : emptyRow(7, 'Sem posts no período')}</tbody>
      </table></div>
    </div>
  `;
}
