// Fase 2 (senha compartilhada + criptografia client-side) — data/<brand>.json chega cifrado
// (AES-256-GCM) do repo de sync. A chave é derivada aqui no browser via Web Crypto a partir da
// senha digitada; a senha nunca é enviada pra lugar nenhum, só usada localmente pra derivar a
// chave de decifragem. Contraparte Node em asun-dashboard-sync/scripts/lib/crypto.mjs.

// Tem que ser IDÊNTICO ao PBKDF2_SALT_B64/PBKDF2_ITERATIONS do lado do sync — senão a chave
// derivada aqui não bate com a usada pra cifrar, e a decifragem falha mesmo com a senha certa.
const PBKDF2_SALT_B64 = 'd8WdxT2lXDoGkXq+ZqrP0w==';
const PBKDF2_ITERATIONS = 150000;

function b64ToBytes(b64) {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}
function bytesToB64(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

// Deriva os 32 bytes brutos da chave AES a partir da senha — mesma saída do
// pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 32, 'sha256') do lado do sync.
async function deriveRawKey(password) {
  const salt = b64ToBytes(PBKDF2_SALT_B64);
  const passwordKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    passwordKey, 256);
  return new Uint8Array(bits);
}

async function importAesKey(rawKeyBytes) {
  return crypto.subtle.importKey('raw', rawKeyBytes, 'AES-GCM', false, ['decrypt']);
}

// Decifra o envelope {v, iv, data} e devolve o objeto JS já parseado. Lança se a senha/chave
// estiver errada (AES-GCM falha na verificação da tag de autenticação).
async function decryptEnvelope(envelope, aesKey) {
  const iv = b64ToBytes(envelope.iv);
  const raw = b64ToBytes(envelope.data);
  const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, raw);
  return JSON.parse(new TextDecoder().decode(plainBuf));
}
