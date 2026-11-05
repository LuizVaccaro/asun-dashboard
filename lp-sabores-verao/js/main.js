// ===== Configuração (troque aqui) =====
const SHEETS_ENDPOINT = ''; // URL do Google Apps Script (Web App) — vazio = não envia pra planilha
const WHATSAPP_NUMBER = '5551981225612';
const PRICE_PER_TICKET = 150;
const CASHBACK_PER_TICKET = 75;
const META_PIXEL_ID = '389598543371140'; // init + PageView ficam no snippet do index.html
const MAX_TICKETS = 999; // trava técnica anti-erro de digitação. NÃO é limite comercial e não aparece na página.

const EVENT_NAME = 'Sabores de Verão Asun';
const VARIANT = (document.body && document.body.dataset.variant) || 'A'; // A = copy-lp.md · B = copy-lp-versao-b.md
const LEAD_ORIGIN = 'lp-sabores-verao';
const SHEETS_TIMEOUT_MS = 2500;
const DUP_KEY = 'asun_sv_leads'; // telefones já enviados neste navegador (estado "duplicidade")

// ===== Helpers =====
const fmtInt = (n) => n.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
const brl = (n) => `R$\u00a0${fmtInt(n)}`; // R$ + nbsp (não quebra)
const onlyDigits = (s) => String(s || '').replace(/\D/g, '');

function calc(qtd) {
  const q = Number.isInteger(qtd) && qtd > 0 ? qtd : 0;
  return { total: q * PRICE_PER_TICKET, cashback: q * CASHBACK_PER_TICKET };
}

function formatPhone(digits) {
  const d = digits.slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

// Template do copy-lp.md (cashback só nas lojas Asun; sem cidade)
function buildWhatsAppMessage(lead) {
  return [
    'Oi! Fiz minha solicitação de reserva pro Sabores de Verão Asun (17/11, Capão da Canoa).',
    '',
    `Nome: ${lead.nome}`,
    `Ingressos: ${lead.quantidade}`,
    `Total: R$ ${fmtInt(lead.total)}`,
    `Cashback nas lojas Asun: R$ ${fmtInt(lead.cashback)}`,
    '',
    'Pode confirmar a disponibilidade e me passar como faço o pagamento?'
  ].join('\n');
}

function buildWhatsAppUrl(lead) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(buildWhatsAppMessage(lead))}`;
}

async function sendToSheets(lead) {
  if (!SHEETS_ENDPOINT) return { skipped: true };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), SHEETS_TIMEOUT_MS);
  try {
    // text/plain + no-cors evita preflight CORS no Google Apps Script (doPost lê e.postData.contents como JSON).
    await fetch(SHEETS_ENDPOINT, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(lead),
      keepalive: true,
      signal: ctrl.signal
    });
    return { ok: true };
  } catch (err) {
    console.warn('[sheets] falha no envio do lead (seguindo para o WhatsApp):', err);
    return { ok: false, error: err };
  } finally {
    clearTimeout(timer);
  }
}

function trackLead(lead) {
  if (typeof window.fbq !== 'function') return;
  window.fbq('track', 'Lead', {
    content_name: EVENT_NAME,
    content_category: `LP versão ${VARIANT}`,
    value: lead.total,
    currency: 'BRL',
    num_items: lead.quantidade
  });
}

const sentPhones = () => { try { return JSON.parse(localStorage.getItem(DUP_KEY) || '[]'); } catch { return []; } };
const rememberPhone = (p) => { try { const a = sentPhones(); if (!a.includes(p)) { a.push(p); localStorage.setItem(DUP_KEY, JSON.stringify(a)); } } catch { /* sem storage */ } };

// ===== Página =====
document.documentElement.classList.add('js');

document.addEventListener('DOMContentLoaded', () => {
  initReveal();
  initStickyBar();
  initFaq();
  initForm();
});

function initReveal() {
  const els = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) { els.forEach((el) => el.classList.add('in')); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -8% 0px' });
  els.forEach((el) => io.observe(el));
}

// Barra fixa (mobile): aparece depois do hero, some com a Reserva visível
function initStickyBar() {
  const bar = document.getElementById('sticky-bar');
  const hero = document.getElementById('hero');
  const res = document.getElementById('reserva');
  if (!bar || !hero || !res || !('IntersectionObserver' in window)) return;
  let heroVisible = true, resVisible = false;
  const update = () => {
    const show = !heroVisible && !resVisible;
    bar.classList.toggle('show', show);
    bar.setAttribute('aria-hidden', show ? 'false' : 'true');
    bar.querySelector('a').tabIndex = show ? 0 : -1;
  };
  new IntersectionObserver(([e]) => { heroVisible = e.isIntersecting; update(); }).observe(hero);
  new IntersectionObserver(([e]) => { resVisible = e.isIntersecting; update(); }, { threshold: 0.05 }).observe(res);
}

// FAQ: <details> nativo; mantém um aberto por vez
function initFaq() {
  const items = document.querySelectorAll('.faq details');
  items.forEach((d) => d.addEventListener('toggle', () => {
    if (d.open) items.forEach((o) => { if (o !== d) o.open = false; });
  }));
}

function initForm() {
  const form = document.getElementById('reserva-form');
  if (!form) return;
  const $ = (id) => document.getElementById(id);
  const f = {
    nome: $('nome'), whatsapp: $('whatsapp'), quantidade: $('quantidade'),
    precoOk: $('aceite-preco'), lgpdOk: $('aceite-lgpd')
  };
  const totalEl = $('total');
  const cashbackEl = $('cashback');
  const qtdResumoEl = $('qtd-resumo');
  const statusEl = $('form-status');
  const btn = $('enviar');
  const btnLabel = btn.querySelector('.btn-label');
  const btnText = btnLabel.textContent;
  const success = $('form-success');
  const stepper = form.querySelector('.stepper');

  const readQtd = () => {
    const v = f.quantidade.value.trim();
    return /^\d+$/.test(v) ? parseInt(v, 10) : NaN;
  };

  function updateSummary() {
    const q = readQtd();
    const { total, cashback } = calc(q);
    qtdResumoEl.textContent = Number.isInteger(q) && q > 0 ? fmtInt(q) : '0';
    totalEl.textContent = brl(total);
    cashbackEl.textContent = brl(cashback);
  }

  function setError(input, msg) {
    const el = form.querySelector(`.error[data-for="${input.id}"]`);
    if (el) el.textContent = msg || '';
    input.classList.toggle('invalid', !!msg);
    input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    if (input === f.quantidade) stepper.classList.toggle('invalid', !!msg);
  }

  function validate() {
    const errors = [];
    const check = (input, msg) => { setError(input, msg); if (msg) errors.push(input); };
    const nome = f.nome.value.trim().replace(/\s+/g, ' ');
    check(f.nome, nome.length >= 3 && nome.includes(' ') ? '' : 'Informe seu nome completo.');
    const phone = onlyDigits(f.whatsapp.value);
    check(f.whatsapp, /^[1-9]{2}9?\d{8}$/.test(phone) ? '' : 'Informe um WhatsApp válido com DDD.');
    const q = readQtd();
    let qMsg = '';
    if (!Number.isInteger(q) || q < 1) qMsg = 'Escolha pelo menos 1 ingresso.';
    else if (q > MAX_TICKETS) qMsg = 'Confira a quantidade de ingressos.'; // só anti-typo, sem citar teto
    check(f.quantidade, qMsg);
    check(f.precoOk, f.precoOk.checked ? '' : 'Marque esta opção pra continuar.');
    check(f.lgpdOk, f.lgpdOk.checked ? '' : 'Marque esta opção pra continuar.');
    if (errors.length) { errors[0].focus(); return null; }
    const { total, cashback } = calc(q);
    return {
      nome, whatsapp: phone, quantidade: q, total, cashback,
      timestamp: new Date().toISOString(), origem: `${LEAD_ORIGIN}-${VARIANT.toLowerCase()}`, variante: VARIANT,
      pagina: location.href.split('#')[0]
    };
  }

  Object.values(f).forEach((input) => {
    const evt = input.type === 'checkbox' ? 'change' : 'input';
    input.addEventListener(evt, () => { setError(input, ''); statusEl.textContent = ''; });
  });

  // Stepper (−/+) e campo de quantidade
  form.querySelectorAll('.step-btn').forEach((b) => b.addEventListener('click', () => {
    const cur = readQtd();
    const base = Number.isInteger(cur) ? cur : 1;
    const next = Math.min(MAX_TICKETS, Math.max(1, base + Number(b.dataset.step)));
    f.quantidade.value = String(next);
    setError(f.quantidade, '');
    updateSummary();
  }));
  f.quantidade.addEventListener('input', () => {
    const clean = onlyDigits(f.quantidade.value).replace(/^0+(?=\d)/, '');
    if (clean !== f.quantidade.value) f.quantidade.value = clean;
    updateSummary();
  });
  f.quantidade.addEventListener('blur', () => { if (f.quantidade.value === '') { f.quantidade.value = '1'; updateSummary(); } });

  // Máscara do WhatsApp
  f.whatsapp.addEventListener('input', () => {
    f.whatsapp.value = formatPhone(onlyDigits(f.whatsapp.value));
  });

  function showSuccess(lead, duplicate) {
    const url = buildWhatsAppUrl(lead);
    $('wa-continue').href = url;
    if (duplicate) {
      $('success-title').textContent = 'Solicitação já enviada';
      $('success-text').textContent = 'Já recebemos uma solicitação com esse WhatsApp. É só continuar a conversa com a nossa equipe.';
    }
    form.hidden = true;
    success.hidden = false;
    success.focus();
    return url;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    statusEl.textContent = '';
    const lead = validate();
    if (!lead) return;

    // Duplicidade (mesmo WhatsApp já enviado neste navegador): não reenvia lead nem dispara Lead de novo
    if (sentPhones().includes(lead.whatsapp)) {
      showSuccess(lead, true);
      return;
    }

    btn.disabled = true;
    btn.classList.add('loading');
    btnLabel.textContent = 'Enviando sua solicitação...';

    // 1) Planilha (pula se SHEETS_ENDPOINT vazio; falha não bloqueia o WhatsApp)
    await sendToSheets(lead);

    // 2) Meta Pixel Lead — somente após envio válido
    trackLead(lead);
    rememberPhone(lead.whatsapp);

    btn.disabled = false;
    btn.classList.remove('loading');
    btnLabel.textContent = btnText;

    // 3) Estado de sucesso + WhatsApp na mesma aba (window.open após await costuma ser bloqueado)
    const url = showSuccess(lead, false);
    setTimeout(() => { window.location.href = url; }, 900);
  });

  updateSummary();
}

// Exposto para testes no console
window.__lp = { calc, brl, buildWhatsAppMessage, buildWhatsAppUrl, config: { SHEETS_ENDPOINT, WHATSAPP_NUMBER, PRICE_PER_TICKET, CASHBACK_PER_TICKET, META_PIXEL_ID, MAX_TICKETS } };
