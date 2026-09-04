// Replica no browser as agregações que o dashboard original (Netlify) fazia via SQL
// nos endpoints /api/daily-performance, /api/kpis-overview, /api/meta-campaigns,
// /api/meta-creatives, /api/google-campaigns, /api/instagram-organic e
// /api/facebook-organic — agora sem backend, a partir do dump completo carregado
// por loadBrandData() (js/data.js). Cada build*() abaixo devolve exatamente o
// shape que a aba (js/tabs/*.js) já esperava do fetch original, então os tabs em
// si mudam o mínimo possível.

// Valor de Vendas/Ticket/CAC Vendas só contam conversões de compra de verdade — o sinal muda
// por plataforma porque a precisão disponível é diferente:
//
// Meta: cada linha já carrega `is_purchase_goal` (calculado no sync a partir da meta de
// otimização do conjunto de anúncios daquele anúncio) — é o sinal mais preciso que existe,
// não depende de nome de campanha. Um "Leads | Clube asun | CBO" tem funnel_stage='vendas'
// (pega intenção de conversão) mas is_purchase_goal=false — não é venda de verdade, não pode
// entrar aqui (testado: usar funnel_stage pro Meta inflava o número de "vendas" com leads).
//
// Google: cada linha de google_ads já vem com `conversion_value`/`sales_conversions` filtrados
// pra categoria PURCHASE da própria conversão (calculado no sync via
// segments.conversion_action_category — ver fetchPurchaseConversions em
// asun-dashboard-sync/scripts/sync-google-ads.mjs), não precisa de gate aqui. Isso substituiu um
// gate por nome de campanha (funnel_stage='vendas') que inflava/subestimava o Ticket Médio:
// campanhas com nome não-óbvio (ex: "[S] Categorias - LM Gravataí" na Leve Mais) caíam no
// default 'vendas' e contavam centenas de conversões de clique em categoria (valor ~R$0) junto
// com vendas de verdade, derrubando o ticket médio artificialmente.
const isMetaSalesRow = row => !!row.is_purchase_goal;

function inRange(dateStr, start, end) {
  if (!dateStr) return false;
  const d = dateStr.length > 10 ? dateStr.slice(0, 10) : dateStr;
  return d >= start && d <= end;
}

// ── daily-performance ── union Meta+Google, linhas cruas (o tab agrega por data) ──
function buildDailyPerformance(data, start, end) {
  const metaRows = data.meta_ads
    .filter(r => inRange(r.date, start, end))
    .map(r => ({
      date: r.date,
      platform: 'Meta Ads',
      campaign_name: r.campaign_name,
      funnel_stage: r.funnel_stage,
      spend: r.spend,
      // Meta: sinal de venda é por ad×dia (is_purchase_goal), granular demais pra restringir
      // spend do mesmo jeito que o Google (excluir o dia inteiro do anúncio zeraria o
      // "aquecimento" que ajudou a gerar a venda em outro dia) — sales_spend usa o spend cheio.
      sales_spend: r.spend,
      clicks: r.clicks,
      conversions: r.conversions,
      conversion_value: isMetaSalesRow(r) ? r.conversion_value : 0,
      sales_conversions: isMetaSalesRow(r) ? r.conversions : 0,
    }));
  const googleRows = data.google_ads
    .filter(r => inRange(r.date, start, end))
    .map(r => ({
      date: r.date,
      platform: 'Google Ads',
      campaign_name: r.campaign_name,
      funnel_stage: r.funnel_stage,
      spend: r.spend,
      // Google: sales_spend já vem restrito à(s) campanha(s) confiável(is) de venda desde o sync
      // (ver isTrustedSalesCampaign em sync-google-ads.mjs) — campanhas tipo "Obter Rotas"/
      // "Categorias" não entram aqui, mesmo somando spend real no canal.
      sales_spend: r.sales_spend,
      clicks: r.clicks,
      conversions: r.conversions,
      conversion_value: r.conversion_value,
      sales_conversions: r.sales_conversions,
    }));
  return { rows: [...metaRows, ...googleRows] };
}

// ── kpis-overview ── totais do período + opcional comparação. Reaproveita buildDailyPerformance
// (mesmo gate de venda usado em todo o resto do dashboard) pra que a comparação cubra TODOS os
// cards do Desempenho Diário (Meta/Google/CAC/Valor de Vendas/Ticket/ROAS), não só Investimento e
// Conversões — antes os outros cards ficavam sempre "Sem comp." mesmo com "Comparar com" marcado.
function buildKpisOverview(data, start, end, cmpStart, cmpEnd) {
  const rowsInRange = (s, e) => buildDailyPerformance(data, s, e).rows;
  const totalsOf = rows => {
    const spend = sum(rows, 'spend');
    const salesSpend = sum(rows, 'sales_spend');
    const conversionValue = sum(rows, 'conversion_value');
    const salesConversions = sum(rows, 'sales_conversions');
    return {
      spend,
      salesSpend,
      clicks: sum(rows, 'clicks'),
      conversions: sum(rows, 'conversions'),
      conversionValue,
      salesConversions,
      metaSpend: sum(rows.filter(r => r.platform === 'Meta Ads'), 'spend'),
      googleSpend: sum(rows.filter(r => r.platform === 'Google Ads'), 'spend'),
      // CAC/ROAS usam sales_spend (investimento só das campanhas/canais que geram venda de
      // verdade), não spend total — senão o investimento em campanhas de topo/tráfego sem venda
      // (Obter Rotas, Categorias) diluía o custo por venda pra baixo... e sem venda nenhuma
      // associada, inflava artificialmente pra cima quando dividido pelas poucas vendas reais.
      cac: salesConversions > 0 ? salesSpend / salesConversions : null,
      ticket: salesConversions > 0 ? conversionValue / salesConversions : null,
      roas: salesSpend > 0 ? conversionValue / salesSpend : null,
    };
  };

  const totals = totalsOf(rowsInRange(start, end));
  if (cmpStart && cmpEnd) {
    const cmpTotals = totalsOf(rowsInRange(cmpStart, cmpEnd));
    totals.cmpSpend = cmpTotals.spend;
    totals.cmpConversions = cmpTotals.conversions;
    totals.cmpMetaSpend = cmpTotals.metaSpend;
    totals.cmpGoogleSpend = cmpTotals.googleSpend;
    totals.cmpCAC = cmpTotals.cac;
    totals.cmpConversionValue = cmpTotals.conversionValue;
    totals.cmpTicket = cmpTotals.ticket;
    totals.cmpROAS = cmpTotals.roas;
  }
  return { totals };
}

// ── meta-campaigns ── linhas cruas por ad×dia (o tab já agrupa por campanha) ──
function buildMetaCampaigns(data, start, end) {
  const rows = data.meta_ads
    .filter(r => inRange(r.date, start, end))
    .map(r => ({
      campaign_name: r.campaign_name,
      funnel_stage: r.funnel_stage,
      date: r.date,
      spend: r.spend,
      clicks: r.clicks,
      conversions: r.conversions,
      conversion_value: isMetaSalesRow(r) ? r.conversion_value : 0,
      sales_conversions: isMetaSalesRow(r) ? r.conversions : 0,
    }));
  return { rows };
}

// ── google-campaigns ── já granularidade campanha×dia, conversion_value/sales_conversions já
// vêm filtrados pra PURCHASE do sync, só filtra por data ──
function buildGoogleCampaigns(data, start, end) {
  const rows = data.google_ads
    .filter(r => inRange(r.date, start, end))
    .map(r => ({
      campaign_name: r.campaign_name,
      funnel_stage: r.funnel_stage,
      date: r.date,
      spend: r.spend,
      sales_spend: r.sales_spend,
      clicks: r.clicks,
      conversions: r.conversions,
      conversion_value: r.conversion_value,
      sales_conversions: r.sales_conversions,
    }));
  return { rows };
}

// ── meta-creatives ── agrega por anúncio (ad_id) somando o período — servidor original
// fazia esse SUM/GROUP BY no Postgres; aqui somamos as linhas diárias por ad_id ──
function buildMetaCreatives(data, start, end) {
  const filtered = data.meta_ads.filter(r => inRange(r.date, start, end));
  const byAd = {};
  for (const r of filtered) {
    if (!byAd[r.ad_id]) {
      byAd[r.ad_id] = {
        campaign_name: r.campaign_name,
        adset_name: r.adset_name,
        creative_name: r.creative_name,
        creative_format: r.creative_format ?? null,
        thumbnail_url: r.thumbnail_url ?? null,
        permalink_url: r.permalink_url ?? null,
        spend: 0, clicks: 0, conversions: 0, reach: 0, conversion_value: 0, sales_conversions: 0,
      };
    }
    byAd[r.ad_id].spend += Number(r.spend) || 0;
    byAd[r.ad_id].clicks += Number(r.clicks) || 0;
    byAd[r.ad_id].conversions += Number(r.conversions) || 0;
    byAd[r.ad_id].reach += Number(r.reach) || 0; // mesmo SUM(reach) do endpoint original — não deduplica pessoas entre dias
    // Mesmo gate is_purchase_goal do meta-campaigns/daily-performance (ver comentário no topo do
    // arquivo) — só conta como venda de verdade quando o conjunto de anúncios daquele ad tem meta
    // de otimização de compra.
    byAd[r.ad_id].conversion_value  += isMetaSalesRow(r) ? Number(r.conversion_value) || 0 : 0;
    byAd[r.ad_id].sales_conversions += isMetaSalesRow(r) ? Number(r.conversions) || 0 : 0;
  }
  return { rows: Object.values(byAd) };
}

// ── instagram-organic / facebook-organic ── filtra por data, sem agregação extra ──
function buildInstagramOrganic(data, start, end) {
  const media = data.instagram_media
    .filter(r => inRange(r.posted_at, start, end))
    .sort((a, b) => (a.posted_at < b.posted_at ? 1 : -1));
  const daily = data.instagram_daily.filter(r => inRange(r.date, start, end));
  return { media, daily };
}

function buildFacebookOrganic(data, start, end) {
  const posts = data.facebook_posts
    .filter(r => inRange(r.created_time, start, end))
    .sort((a, b) => (a.created_time < b.created_time ? 1 : -1));
  const daily = data.facebook_daily.filter(r => inRange(r.date, start, end));
  return { posts, daily };
}

// ── search-console ── busca orgânica (Google Search Console) ──
// daily: uma linha por dia, direto do sync (dimensions=['date']). queries/pages vêm com
// granularidade dia×termo/página (dimensions=['date','query'|'page']) — agregadas aqui por
// termo/página somando clicks/impressions; CTR recalculado do zero (não dá pra somar CTR
// diário direto) e posição média ponderada por impressões (dia com mais impressão pesa mais,
// mesmo critério que o próprio Search Console usa pra agregar posição no período).
function aggregateByKey(rows, keyName) {
  const byKey = new Map();
  for (const r of rows) {
    const key = r[keyName];
    const prev = byKey.get(key) ?? { [keyName]: key, clicks: 0, impressions: 0, positionWeighted: 0 };
    prev.clicks += Number(r.clicks) || 0;
    prev.impressions += Number(r.impressions) || 0;
    prev.positionWeighted += (Number(r.position) || 0) * (Number(r.impressions) || 0);
    byKey.set(key, prev);
  }
  return [...byKey.values()].map(r => ({
    [keyName]: r[keyName],
    clicks: r.clicks,
    impressions: r.impressions,
    ctr: r.impressions > 0 ? r.clicks / r.impressions : 0,
    position: r.impressions > 0 ? r.positionWeighted / r.impressions : null,
  }));
}

function buildSearchConsole(data, start, end) {
  const daily = (data.search_console_daily || [])
    .filter(r => inRange(r.date, start, end))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  const queryRows = (data.search_console_queries || []).filter(r => inRange(r.date, start, end));
  const pageRows = (data.search_console_pages || []).filter(r => inRange(r.date, start, end));
  const queries = aggregateByKey(queryRows, 'query');
  const pages = aggregateByKey(pageRows, 'page');
  return { daily, queries, pages };
}
