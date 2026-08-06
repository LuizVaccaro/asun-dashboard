// Única fonte de dado do frontend: fetch estático em data/<brand>.json, publicado
// pelo GitHub Action do repo asun-dashboard-sync (roda 1x/dia). Substitui o
// js/api.js do dashboard original (que chamava /api/* via Netlify Functions +
// Postgres) — aqui não existe backend, então tudo é lido de um dump JSON e
// agregado no browser (ver js/aggregate.js).
const _brandDataCache = {};

async function loadBrandData(brand) {
  if (_brandDataCache[brand]) return _brandDataCache[brand];
  const res = await fetch(`data/${brand}.json`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Não foi possível carregar os dados de "${brand}" (HTTP ${res.status}). O sync ainda não publicou dados pra essa marca?`);
  const data = await res.json();
  _brandDataCache[brand] = data;
  return data;
}
