// Replica no browser as agregações que o dashboard original (Netlify) fazia via SQL
// nos endpoints /api/daily-performance, /api/kpis-overview, /api/meta-campaigns,
// /api/meta-creatives, /api/google-campaigns, /api/instagram-organic e
// /api/facebook-organic — agora sem backend, a partir do dump completo carregado
// por loadBrandData() (js/data.js). Cada build*() abaixo devolve exatamente o
// shape que a aba (js/tabs/*.js) já esperava do fetch original, então os tabs em
// si mudam o mínimo possível.

// mesmo gate `name ILIKE '%venda%'` usado pelo SQL original: Valor de Vendas/Ticket/ROAS
// só contam campanhas com "venda"/"vendas" no nome — funnel_stage='vendas' é mais amplo
// (inclui Leads/Whatsapp) e não tem valor de compra real associado.
const isSalesCampaign = name => /venda/i.test(name || '');

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
      funnel_stage: r.funnel_stage,
      spend: r.spend,
      clicks: r.clicks,
      conversions: r.conversions,
      conversion_value: isSalesCampaign(r.campaign_name) ? r.conversion_value : 0,
      sales_conversions: isSalesCampaign(r.campaign_name) ? r.conversions : 0,
    }));
  const googleRows = data.google_ads
    .filter(r => inRange(r.date, start, end))
    .map(r => ({
      date: r.date,
      platform: 'Google Ads',
      funnel_stage: r.funnel_stage,
      spend: r.spend,
      clicks: r.clicks,
      conversions: r.conversions,
      conversion_value: isSalesCampaign(r.campaign_name) ? r.conversion_value : 0,
      sales_conversions: isSalesCampaign(r.campaign_name) ? r.conversions : 0,
    }));
  return { rows: [...metaRows, ...googleRows] };
}

// ── kpis-overview ── totais do período + opcional comparação (sem conversion_value:
// o dashboard original também não devolvia esse campo aqui) ──
function buildKpisOverview(data, start, end, cmpStart, cmpEnd) {
  const rowsInRange = (s, e) => [
    ...data.meta_ads.filter(r => inRange(r.date, s, e)),
    ...data.google_ads.filter(r => inRange(r.date, s, e)),
  ];
  const totalsOf = rows => ({
    spend: sum(rows, 'spend'),
    clicks: sum(rows, 'clicks'),
    conversions: sum(rows, 'conversions'),
  });

  const totals = totalsOf(rowsInRange(start, end));
  if (cmpStart && cmpEnd) {
    const cmpTotals = totalsOf(rowsInRange(cmpStart, cmpEnd));
    totals.cmpSpend = cmpTotals.spend;
    totals.cmpConversions = cmpTotals.conversions;
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
      conversion_value: isSalesCampaign(r.campaign_name) ? r.conversion_value : 0,
    }));
  return { rows };
}

// ── google-campaigns ── já granularidade campanha×dia, só filtra e aplica o gate ──
function buildGoogleCampaigns(data, start, end) {
  const rows = data.google_ads
    .filter(r => inRange(r.date, start, end))
    .map(r => ({
      campaign_name: r.campaign_name,
      funnel_stage: r.funnel_stage,
      date: r.date,
      spend: r.spend,
      clicks: r.clicks,
      conversions: r.conversions,
      conversion_value: isSalesCampaign(r.campaign_name) ? r.conversion_value : 0,
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
        spend: 0, clicks: 0, conversions: 0, reach: 0,
      };
    }
    byAd[r.ad_id].spend += Number(r.spend) || 0;
    byAd[r.ad_id].clicks += Number(r.clicks) || 0;
    byAd[r.ad_id].conversions += Number(r.conversions) || 0;
    byAd[r.ad_id].reach += Number(r.reach) || 0; // mesmo SUM(reach) do endpoint original — não deduplica pessoas entre dias
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
