// Única fonte de dado do frontend: fetch estático em data/<brand>.json, publicado
// pelo GitHub Action do repo asun-dashboard-sync (roda 1x/dia). Substitui o
// js/api.js do dashboard original (que chamava /api/* via Netlify Functions +
// Postgres) — aqui não existe backend, então tudo é lido de um dump JSON e
// agregado no browser (ver js/aggregate.js).
const _brandDataCache = {};

// Chave AES-GCM derivada da senha (ver js/crypto.js) — setada por app.js depois que o usuário
// desbloqueia o dashboard. data/<brand>.json chega cifrado (Fase 2), precisa dessa chave pra
// decifrar antes de virar o objeto que o resto do app usa.
let _aesKey = null;
function setAesKey(key) { _aesKey = key; }

async function loadBrandData(brand) {
  if (_brandDataCache[brand]) return _brandDataCache[brand];
  if (!_aesKey) throw new Error('Dashboard bloqueado — desbloqueie com a senha antes de carregar dados.');
  const res = await fetch(`data/${brand}.json`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Não foi possível carregar os dados de "${brand}" (HTTP ${res.status}). O sync ainda não publicou dados pra essa marca?`);
  const envelope = await res.json();
  const data = await decryptEnvelope(envelope, _aesKey);
  _brandDataCache[brand] = data;
  return data;
}
