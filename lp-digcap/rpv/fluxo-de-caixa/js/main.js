/* ==========================================================================
   DigCap LP — frente "rpv", direção "fluxo-de-caixa" (staging, NÃO publicado). Mesmo rastreamento do site principal.
   Todos os padrões trocáveis estão no objeto CONFIG logo abaixo.
   Nomes de campos e eventos: /workspace/clientes/digcap/conversoes-gtm.md
   ========================================================================== */

var CONFIG = {
  // --- Padrões pedidos pelo Gestor de Projetos (trocáveis) ---
  variant: "frente-rpv-fluxo-de-caixa",   // valor de lp_variant no payload/Pipedrive
  headline: "A",              // "A" | "B"  (A é o padrão; ?headline=B alterna)
  headlines: {
      "A": "Muitas RPVs a receber e a conta do escritório vencendo? Antecipe seus honorários.",
      "B": "RPVs a receber? Antecipe seus honorários."
  },
  lpFrente: "rpv",              // valor do campo oculto lp_frente (payload e form_submit)
  stepLabels: { s1: "Passo 1 de 2: qualificação e contato", s2: "Passo 2 de 2: processo (opcional)" },
  defaultOrder: ["hero", "caixa", "conta-do-escritorio", "para-quem-e", "como-funciona", "seguro", "quem-e-a-digcap", "casos", "qualificacao", "faq", "cta-final"],   // ordem padrão das seções (?ordem=a,b,c ou DigCapLP.setOrder([...]))
  oab: "optional",            // "optional" | "required"  (decisão final do Luiz)
  whatsapp: {
    enabled: false,           // WhatsApp DESLIGADO por padrão (CTA único = formulário)
    number: "",               // [a confirmar] número oficial, só dígitos com DDI, ex. 55DDDNUMERO. NÃO preencher sem ok.
    message: ""               // mensagem pré-preenchida opcional (sem dados pessoais)
  },

  // --- Pipedrive: PREPARADO, mas DESLIGADO ---
  pipedrive: {
    enabled: false,           // false = o fluxo termina localmente (payload no console / window.DigCapLP.lastPayload)
    endpoint: "",             // [a confirmar] URL de webhook/Make/Zapier/proxy. NUNCA colocar token do Pipedrive aqui (o token fica no servidor).
    timeoutMs: 10000
  },

  // --- Rastreamento ---
  gtmId: "",                  // [PLACEHOLDER] ID do contêiner GTM da DigCap, a confirmar (GTM-XXXXXXX). Vazio = GTM não é carregado.
  formId: "lp_advogados",     // conversoes-gtm.md §4.1
  leadSource: "lp_advogados", // conversoes-gtm.md §4.1
  consentVersion: "lp-frentes-v2-rascunho-2026-11-13", // texto de consentimento ainda é rascunho (a confirmar com a DigCap) // versão (e data) do texto de consentimento; trocar quando a DigCap aprovar o texto
  clickIdCookieDays: 90,      // validade dos cookies first-party de click id (gclid, fbclid, wbraid, gbraid, *_last) e do dc_attr (decisão do bot DigCap)
  clickIdPolicy: "first",     // origem = primeiro clique ("first"). O último clique é guardado À PARTE em gclid_last, fbclid_last, wbraid_last, gbraid_last. "last" = o clique novo sobrescreve também o primeiro.
  cookiesRequireConsent: true, // true = NENHUM cookie/localStorage/sessionStorage é escrito antes do consentimento (valores só em memória). Pendente da política de privacidade da DigCap.
  cookieConsentTrigger: "submit", // quando considerar o consentimento dado: "submit" = envio válido do passo 2 com a caixa marcada (padrão) | "checkbox" = ao marcar a caixa (desmarcar remove os cookies gravados nesta visita)
  cookieNames: { gclid: "gclid", fbclid: "fbclid", wbraid: "wbraid", gbraid: "gbraid" }, // o cookie de último clique é <nome>_last
  cookieDomain: "",           // vazio = host atual. Na produção pode ser ".digcap.com.br" se a LP ficar em subdomínio.
  markLocalSubmitsAsTest: false, // true = com Pipedrive OFF, form_submit sai com is_test:true (evita contar conversão de teste se o GTM estiver ligado)

  // --- Modo staging ---
  internalMode: false,        // true = faixa interna e notas de revisão (.review-note). Os trechos "[a confirmar]" ficam sempre visíveis.
  allowUrlOverrides: true,    // permite ?headline=B&oab=required&whatsapp=on&passo=2 (só staging). Na publicação: false.
  debugLog: false             // loga o payload no console (contém dados pessoais do teste). Na publicação: false.
};

/* Override para testes automatizados: window.DIGCAP_CONFIG_OVERRIDE = { pipedrive: { enabled: true, endpoint: "..." } } */
(function () {
  var o = window.DIGCAP_CONFIG_OVERRIDE;
  if (!o) return;
  Object.keys(o).forEach(function (k) {
    if (o[k] && typeof o[k] === "object" && !Array.isArray(o[k]) && CONFIG[k] && typeof CONFIG[k] === "object") {
      Object.keys(o[k]).forEach(function (kk) { CONFIG[k][kk] = o[k][kk]; });
    } else { CONFIG[k] = o[k]; }
  });
})();

/* Mapeamento campo do formulário -> campo do Pipedrive (conversoes-gtm.md §5).
   Em 12/11/2026 o bot DigCap definiu estes nomes como o padrão (incluindo os *_last, sugeridos por esta LP).
   confirmed:false ficaria em _unconfirmed_fields do envelope, se algum campo novo ainda não tiver decisão. */
var PIPEDRIVE_FIELD_MAP = {
  nome:             { pipedrive: "person.name",          confirmed: true },
  email:            { pipedrive: "person.email",         confirmed: true },
  telefone:         { pipedrive: "person.phone",         confirmed: true },
  e_advogado:       { pipedrive: "e_advogado",           confirmed: true },
  o_que_antecipar:  { pipedrive: "o_que_antecipar",      confirmed: false },
  fase:             { pipedrive: "fase_do_processo",     confirmed: true },
  qtd_processos:    { pipedrive: "qtd_processos",        confirmed: false },
  ente_devedor:     { pipedrive: "ente_devedor",         confirmed: false },
  lp_frente:        { pipedrive: "lp_frente",            confirmed: false },
  headline_variant: { pipedrive: "headline_variant",     confirmed: false },
  utm_source:       { pipedrive: "utm_source",           confirmed: true },
  utm_medium:       { pipedrive: "utm_medium",           confirmed: true },
  utm_campaign:     { pipedrive: "utm_campaign",         confirmed: true },
  utm_content:      { pipedrive: "utm_content",          confirmed: true },
  utm_term:         { pipedrive: "utm_term",             confirmed: true },
  gclid:            { pipedrive: "gclid",                confirmed: true },
  fbclid:           { pipedrive: "fbclid",               confirmed: true },
  landing_url:      { pipedrive: "landing_url",          confirmed: true },
  is_test:          { pipedrive: "is_test",              confirmed: true },
  wbraid:           { pipedrive: "wbraid",               confirmed: true },
  gbraid:           { pipedrive: "gbraid",               confirmed: true },
  _fbp:             { pipedrive: "fbp",                  confirmed: true },
  _fbc:             { pipedrive: "fbc",                  confirmed: true },
  ga_client_id:     { pipedrive: "ga_client_id",         confirmed: true },
  consent_version:  { pipedrive: "consent_version",      confirmed: true },
  referrer:         { pipedrive: "referrer",             confirmed: true },
  form_id:          { pipedrive: "form_id",              confirmed: true },
  submitted_at:     { pipedrive: "submitted_at",         confirmed: true },
  event_id:         { pipedrive: "event_id",             confirmed: true },
  gclid_last:       { pipedrive: "gclid_last",           confirmed: true },
  fbclid_last:      { pipedrive: "fbclid_last",          confirmed: true },
  wbraid_last:      { pipedrive: "wbraid_last",          confirmed: true },
  gbraid_last:      { pipedrive: "gbraid_last",          confirmed: true },
  lp_variant:       { pipedrive: "lp_variant",           confirmed: false },
  oab:              { pipedrive: "oab_numero",           confirmed: true },
  oab_uf:           { pipedrive: "oab_uf",               confirmed: true },
  processo:         { pipedrive: "numero_processo",      confirmed: true }
};

(function () {
  "use strict";
  var root = document.documentElement;
  window.dataLayer = window.dataLayer || [];

  var thisScript = document.currentScript;
  var isStatusPage = !!(thisScript && thisScript.getAttribute("data-page") === "status");

  /* ---------- Atributos de modo (antes da primeira pintura) ---------- */
  root.setAttribute("data-internal", CONFIG.internalMode ? "on" : "off");

  /* ---------- GTM (só com ID informado; nunca inventar) ---------- */
  if (CONFIG.gtmId && /^GTM-[A-Z0-9]+$/.test(CONFIG.gtmId)) {
    window.dataLayer.push({ "gtm.start": new Date().getTime(), event: "gtm.js" });
    var gs = document.createElement("script");
    gs.async = true;
    gs.src = "https://www.googletagmanager.com/gtm.js?id=" + encodeURIComponent(CONFIG.gtmId);
    document.head.appendChild(gs);
  } else if (CONFIG.gtmId) {
    console.warn("[DigCap LP] CONFIG.gtmId inválido, GTM não carregado:", CONFIG.gtmId);
  }

  /* ---------- Utilidades ---------- */
  function digits(v) { return (v || "").replace(/\D+/g, ""); }
  function emailOk(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v || ""); }
  function getCookie(name) {
    var parts = document.cookie ? document.cookie.split("; ") : [];
    for (var i = 0; i < parts.length; i++) {
      var eq = parts[i].indexOf("=");
      if (eq > -1 && parts[i].slice(0, eq) === name) {
        try { return decodeURIComponent(parts[i].slice(eq + 1)); } catch (e) { return parts[i].slice(eq + 1); }
      }
    }
    return "";
  }
  function setCookie(name, value, days) {
    var c = name + "=" + encodeURIComponent(value) + "; max-age=" + Math.round(days * 86400) + "; path=/; SameSite=Lax";
    if (CONFIG.cookieDomain) c += "; domain=" + CONFIG.cookieDomain;
    if (location.protocol === "https:") c += "; Secure";
    document.cookie = c;
  }
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "ev-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }
  function push(obj) { window.dataLayer.push(obj); }

  /* ---------- Atribuição: URL (+ cookies já existentes, só leitura) -> campos ocultos ----------
     Antes do consentimento nada é gravado: os valores ficam em memória e preenchem os campos ocultos
     na mesma visita. A gravação acontece em persistAttribution(), chamada só depois do consentimento
     (ou no carregamento, se CONFIG.cookiesRequireConsent=false). Ler cookies que já existem (de uma visita
     com consentimento) é permitido. */
  var UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];
  var CLICK_KEYS = ["gclid", "fbclid", "wbraid", "gbraid"];
  var ATTR_COOKIE = "dc_attr";                       // UTMs (primeiro valor), JSON
  var params = new URLSearchParams(location.search);
  var consentGiven = false;
  var writtenThisView = [];                          // nomes de cookies gravados nesta visita (para retirada de consentimento)

  function cookieName(k) { return (CONFIG.cookieNames && CONFIG.cookieNames[k]) || k; }
  function loadStoredAttr() {
    try { return JSON.parse(getCookie(ATTR_COOKIE) || "{}") || {}; } catch (e) { return {}; }
  }
  function currentPolicy() {
    // Links de QA (?qa=1) sempre sobrescrevem a origem, para testar o link Google e depois o link Meta no mesmo navegador.
    return isTest() ? "last" : CONFIG.clickIdPolicy;
  }

  // Calcula os valores (somente leitura; não escreve nada).
  function computeAttribution() {
    var stored = loadStoredAttr();
    var policy = currentPolicy();
    var out = {};
    UTM_KEYS.forEach(function (k) {
      var fromUrl = (params.get(k) || "").trim();
      out[k] = (fromUrl && (!stored[k] || policy === "last")) ? fromUrl : (stored[k] || "");
    });
    CLICK_KEYS.forEach(function (k) {
      var fromUrl = (params.get(k) || "").trim();
      var firstCookie = getCookie(cookieName(k));
      var lastCookie = getCookie(cookieName(k) + "_last");
      out[k] = (fromUrl && (!firstCookie || policy === "last")) ? fromUrl : (firstCookie || "");
      out[k + "_last"] = fromUrl || lastCookie || "";   // último clique: o desta visita, senão o último gravado
    });
    return out;
  }

  function writeCookie(name, value) {
    setCookie(name, value, CONFIG.clickIdCookieDays);
    if (writtenThisView.indexOf(name) === -1) writtenThisView.push(name);
  }

  // Grava os cookies first-party. Só chamar com consentimento (ou com cookiesRequireConsent=false).
  function persistAttribution() {
    var a = computeAttribution();
    var stored = loadStoredAttr(), changed = false;
    UTM_KEYS.forEach(function (k) {
      if (a[k] && a[k] !== stored[k]) { stored[k] = a[k]; changed = true; }
    });
    if (changed) writeCookie(ATTR_COOKIE, JSON.stringify(stored));
    CLICK_KEYS.forEach(function (k) {
      var n = cookieName(k);
      if (a[k] && a[k] !== getCookie(n)) writeCookie(n, a[k]);                              // origem (primeiro clique): nunca grava vazio
      if (a[k + "_last"] && a[k + "_last"] !== getCookie(n + "_last")) writeCookie(n + "_last", a[k + "_last"]); // último clique
    });
  }
  function grantConsent() {
    consentGiven = true;
    persistAttribution();
  }
  function revokeConsent() {
    consentGiven = false;
    writtenThisView.forEach(function (n) {
      document.cookie = n + "=; max-age=0; path=/" + (CONFIG.cookieDomain ? "; domain=" + CONFIG.cookieDomain : "");
    });
    writtenThisView = [];
  }
  function mayWriteCookies() { return !CONFIG.cookiesRequireConsent || consentGiven; }

  function readGaClientId() {
    var ga = getCookie("_ga");                       // GA1.1.1234567890.1700000000
    var m = /^GA\d\.\d+\.(\d+\.\d+)$/.exec(ga);
    return m ? m[1] : "";
  }
  function readFbp() { return getCookie("_fbp"); }
  function readFbc(fbclid) {
    var c = getCookie("_fbc");
    if (c) return c;
    // Formato oficial da Meta: fb.<subdomainIndex>.<timestamp ms>.<fbclid>
    return fbclid ? "fb." + 1 + "." + Date.now() + "." + fbclid : "";
  }

  var attribution = computeAttribution();

  function setHidden(id, v) { var el = document.getElementById(id); if (el) el.value = v || ""; }
  function fillHiddenFields() {
    attribution = computeAttribution();
    if (mayWriteCookies()) persistAttribution();
    Object.keys(attribution).forEach(function (k) { setHidden(k, attribution[k]); });
    setHidden("_fbp", readFbp());
    setHidden("_fbc", readFbc(attribution.fbclid_last || attribution.fbclid));
    setHidden("ga_client_id", readGaClientId());
    setHidden("consent_version", CONFIG.consentVersion);
    setHidden("landing_url", location.href);
    setHidden("referrer", document.referrer || "");
    setHidden("form_id", CONFIG.formId);
  }

  function isTest() {
    var q = params.get("qa");
    return q === "1" || q === "true";
  }

  /* ---------- Status pages (obrigado/, nao-advogado/): só layout ---------- */
  if (isStatusPage) { return; }

  /* ---------- Headline / OAB / WhatsApp / passo ---------- */
  var HEADLINES = CONFIG.headlines;
  var cfgHeadline = CONFIG.headline, cfgOab = CONFIG.oab, cfgWa = CONFIG.whatsapp.enabled;
  if (CONFIG.allowUrlOverrides) {
    if (params.get("headline")) cfgHeadline = params.get("headline").toUpperCase();
    if (params.get("oab") === "required" || params.get("oab") === "optional") cfgOab = params.get("oab");
    if (params.get("whatsapp") === "on") cfgWa = true;
    if (params.get("whatsapp") === "off") cfgWa = false;
  }

  function setHeadline(key) {
    if (!HEADLINES[key]) return;
    root.setAttribute("data-headline", key);
    var title = document.getElementById("hero-title");
    if (title) title.textContent = HEADLINES[key];
    document.querySelectorAll("[data-set-headline]").forEach(function (btn) {
      btn.setAttribute("aria-pressed", String(btn.getAttribute("data-set-headline") === key));
    });
  }
  function setOab(mode) {
    if (mode !== "required" && mode !== "optional") return;
    root.setAttribute("data-oab", mode);
    var required = mode === "required";
    var input = document.getElementById("oab"), uf = document.getElementById("oab_uf");
    if (input) input.required = required;
    if (uf) uf.required = required;
    document.querySelectorAll("[data-set-oab]").forEach(function (btn) {
      btn.setAttribute("aria-pressed", String(btn.getAttribute("data-set-oab") === mode));
    });
  }
  function setWhatsapp(on) {
    root.setAttribute("data-whatsapp", on ? "on" : "off");
    var fab = document.getElementById("wa-fab");
    if (fab) {
      var num = digits(CONFIG.whatsapp.number);
      if (on && num) {
        var href = "https://wa.me/" + num;
        if (CONFIG.whatsapp.message) href += "?text=" + encodeURIComponent(CONFIG.whatsapp.message);
        fab.setAttribute("href", href);
        fab.setAttribute("target", "_blank");
        fab.removeAttribute("aria-hidden");
      } else {
        fab.removeAttribute("href");
        if (on) console.warn("[DigCap LP] WhatsApp ligado, mas CONFIG.whatsapp.number está vazio (a confirmar). O botão fica como placeholder, sem link.");
      }
    }
    document.querySelectorAll("[data-set-whatsapp]").forEach(function (btn) {
      btn.setAttribute("aria-pressed", String((btn.getAttribute("data-set-whatsapp") === "on") === !!on));
    });
  }

  function setStep(step, opts) {
    opts = opts || {};
    root.setAttribute("data-form-step", step);
    var label = document.getElementById("progress-label");
    var bar = document.querySelector(".progress .b");
    if (label) {
      if (step === "1" || step === "blocked") label.textContent = CONFIG.stepLabels.s1;
      else if (step === "2") label.textContent = CONFIG.stepLabels.s2;
      else label.textContent = "Enviado";
    }
    if (bar) bar.style.width = (step === "2" || step === "thanks") ? "100%" : "";
    if (opts.focus === false) return;
    var target = null;
    if (step === "2") target = document.getElementById("processo");
    else if (step === "blocked") target = document.getElementById("step-blocked");
    else if (step === "thanks") target = document.getElementById("step-thanks");
    else if (step === "1") target = document.getElementById("nome");
    if (target) {
      var card = document.querySelector(".form-card");
      if (card && card.scrollIntoView) card.scrollIntoView({ block: "start" });
      try { target.focus({ preventScroll: true }); } catch (e) { target.focus(); }
    }
  }

  /* ---------- Máscaras ---------- */
  function initMasks() {
    var tel = document.getElementById("telefone");
    if (tel) tel.addEventListener("input", function () {
      var d = digits(tel.value).slice(0, 11);
      if (d.length <= 10) {
        tel.value = d.replace(/(\d{0,2})(\d{0,4})(\d{0,4})/, function (_, a, b, c) {
          return (a ? "(" + a : "") + (a.length === 2 ? ") " : "") + b + (c ? "-" + c : "");
        });
      } else {
        tel.value = d.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3");
      }
    });
    var proc = document.getElementById("processo");
    if (proc) proc.addEventListener("input", function () {
      var d = digits(proc.value).slice(0, 20), out = d;
      if (d.length > 7)  out = d.slice(0,7) + "-" + d.slice(7);
      if (d.length > 9)  out = d.slice(0,7) + "-" + d.slice(7,9) + "." + d.slice(9);
      if (d.length > 13) out = d.slice(0,7) + "-" + d.slice(7,9) + "." + d.slice(9,13) + "." + d.slice(13);
      if (d.length > 14) out = d.slice(0,7) + "-" + d.slice(7,9) + "." + d.slice(9,13) + "." + d.slice(13,14) + "." + d.slice(14);
      if (d.length > 16) out = d.slice(0,7) + "-" + d.slice(7,9) + "." + d.slice(9,13) + "." + d.slice(13,14) + "." + d.slice(14,16) + "." + d.slice(16);
      proc.value = out;
    });
  }

  /* ---------- Validação ---------- */
  function markInvalid(fieldId, on) {
    var f = document.getElementById(fieldId);
    if (f) f.classList.toggle("is-invalid", !!on);
    return !!on;
  }
  function focusFirstInvalid(scope) {
    var bad = (scope || document).querySelector(".field.is-invalid");
    if (!bad) return;
    var ctl = bad.querySelector("input, select, textarea");
    if (ctl) { try { ctl.focus({ preventScroll: false }); } catch (e) { ctl.focus(); } }
  }
  function clearOnInput() {
    document.querySelectorAll(".field").forEach(function (f) {
      var clear = function () { f.classList.remove("is-invalid"); };
      f.addEventListener("input", clear);
      f.addEventListener("change", clear);
    });
  }

  function validateStep1() {
    var requiredOab = root.getAttribute("data-oab") === "required";
    var oab = document.getElementById("oab"), oabUf = document.getElementById("oab_uf");
    var adv = document.querySelector("input[name='e_advogado']:checked");
    var oque = document.querySelector("input[name='o_que_antecipar']:checked");
    var qtd = document.querySelector("input[name='qtd_processos']:checked");
    var fase = document.getElementById("fase");
    var bad = [
      markInvalid("field-nome", !document.getElementById("nome").value.trim()),
      markInvalid("field-email", !emailOk(document.getElementById("email").value.trim())),
      markInvalid("field-telefone", digits(document.getElementById("telefone").value).length < 10),
      markInvalid("field-advogado", !adv),
      markInvalid("field-oab", requiredOab && (!oab.value.trim() || !oabUf.value)),
      markInvalid("field-o-que", !oque),
      markInvalid("field-fase", !fase || !fase.value),
      markInvalid("field-qtd", !qtd)
    ];
    return bad.indexOf(true) === -1;
  }
  function validateStep2() {
    var proc = document.getElementById("processo");
    var procDigits = digits(proc && proc.value).length;
    var bad = [
      markInvalid("field-processo", procDigits > 0 && procDigits !== 20),
      markInvalid("field-consentimento", !document.getElementById("consentimento").checked)
    ];
    return bad.indexOf(true) === -1;
  }

  /* ---------- Payload / Pipedrive ---------- */
  function val(id) { var el = document.getElementById(id); return el ? el.value : ""; }

  function buildPayload() {
    fillHiddenFields();
    var adv = document.querySelector("input[name='e_advogado']:checked");
    var oque = document.querySelector("input[name='o_que_antecipar']:checked");
    var qtd = document.querySelector("input[name='qtd_processos']:checked");
    var hv = root.getAttribute("data-headline") || "A";
    setHidden("headline_variant", hv);
    var p = {
      // qualificação + contato
      nome: val("nome").trim(),
      email: val("email").trim(),
      telefone: val("telefone"),
      e_advogado: adv ? adv.value : "",
      oab: val("oab").trim(),
      oab_uf: val("oab_uf"),
      o_que_antecipar: oque ? oque.value : "",
      fase: val("fase"),
      qtd_processos: qtd ? qtd.value : "",
      // passo 2 (opcionais) + consentimento
      processo: val("processo"),
      ente_devedor: val("ente"),
      consentimento: document.getElementById("consentimento").checked,
      lp_frente: CONFIG.lpFrente,
      headline_variant: hv,
      lp_variant: CONFIG.variant,
      // ocultos (nomes exatos do conversoes-gtm.md)
      utm_source: val("utm_source"), utm_medium: val("utm_medium"), utm_campaign: val("utm_campaign"),
      utm_term: val("utm_term"), utm_content: val("utm_content"),
      gclid: val("gclid"), fbclid: val("fbclid"), wbraid: val("wbraid"), gbraid: val("gbraid"),
      gclid_last: val("gclid_last"), fbclid_last: val("fbclid_last"), wbraid_last: val("wbraid_last"), gbraid_last: val("gbraid_last"),
      _fbp: val("_fbp"), _fbc: val("_fbc"), ga_client_id: val("ga_client_id"),
      consent_version: val("consent_version"),
      landing_url: val("landing_url"), referrer: val("referrer"),
      form_id: val("form_id"),
      submitted_at: new Date().toISOString(),
      is_test: isTest() || (!CONFIG.pipedrive.enabled && CONFIG.markLocalSubmitsAsTest),
      event_id: uuid()
    };
    setHidden("submitted_at", p.submitted_at);
    return p;
  }

  function toPipedrive(p) {
    var out = { person: {}, deal: {}, _unconfirmed_fields: [] };
    Object.keys(PIPEDRIVE_FIELD_MAP).forEach(function (k) {
      var m = PIPEDRIVE_FIELD_MAP[k];
      var v = p[k];
      if (Array.isArray(v)) v = v.join(", ");
      if (v === undefined || v === null) return;
      if (m.pipedrive.indexOf("person.") === 0) out.person[m.pipedrive.slice(7)] = v;
      else out.deal[m.pipedrive] = v;
      if (!m.confirmed) out._unconfirmed_fields.push(m.pipedrive);
    });
    return out;
  }

  function sendLead(payload) {
    var mapped = toPipedrive(payload);
    var envelope = { form: payload, pipedrive: mapped, pipedrive_enabled: !!CONFIG.pipedrive.enabled };
    window.DigCapLP.lastPayload = payload;
    window.DigCapLP.lastEnvelope = envelope;
    if (CONFIG.debugLog) console.log("[DigCap LP] payload " + JSON.stringify(envelope));
    document.dispatchEvent(new CustomEvent("digcap:lead", { detail: envelope }));

    if (!CONFIG.pipedrive.enabled) {
      return Promise.resolve({ ok: true, mode: "local" });
    }
    if (!CONFIG.pipedrive.endpoint) {
      console.error("[DigCap LP] pipedrive.enabled=true, mas CONFIG.pipedrive.endpoint está vazio (a confirmar). Nada enviado.");
      return Promise.reject(new Error("endpoint ausente"));
    }
    var ctrl = window.AbortController ? new AbortController() : null;
    var t = ctrl ? setTimeout(function () { ctrl.abort(); }, CONFIG.pipedrive.timeoutMs) : null;
    return fetch(CONFIG.pipedrive.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(envelope),
      signal: ctrl ? ctrl.signal : undefined,
      credentials: "omit"
    }).then(function (res) {
      if (t) clearTimeout(t);
      if (!res.ok) throw new Error("HTTP " + res.status);
      return { ok: true, mode: "pipedrive", status: res.status };
    });
  }

  /* ---------- Formulário ---------- */
  var viewFired = false, submitting = false;

  function init() {
    setHeadline(HEADLINES[cfgHeadline] ? cfgHeadline : "A");
    setOab(cfgOab);
    setWhatsapp(cfgWa);
    fillHiddenFields();
    initMasks();
    clearOnInput();

    document.querySelectorAll("[data-set-headline]").forEach(function (b) {
      b.addEventListener("click", function () { setHeadline(b.getAttribute("data-set-headline")); });
    });
    document.querySelectorAll("[data-set-oab]").forEach(function (b) {
      b.addEventListener("click", function () { setOab(b.getAttribute("data-set-oab")); });
    });
    document.querySelectorAll("[data-set-whatsapp]").forEach(function (b) {
      b.addEventListener("click", function () { setWhatsapp(b.getAttribute("data-set-whatsapp") === "on"); });
    });

    // FAQ
    document.querySelectorAll(".faq-q").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var item = btn.closest(".faq-item");
        var open = item.classList.contains("is-open");
        document.querySelectorAll(".faq-item").forEach(function (other) {
          other.classList.remove("is-open");
          var q = other.querySelector(".faq-q");
          if (q) q.setAttribute("aria-expanded", "false");
        });
        if (!open) { item.classList.add("is-open"); btn.setAttribute("aria-expanded", "true"); }
      });
    });

    // Passo inicial por URL (staging)
    if (CONFIG.allowUrlOverrides) {
      var passo = params.get("passo");
      if (passo === "2" || passo === "blocked" || passo === "thanks") setStep(passo, { focus: false });
    }

    // form_view: uma vez, quando o formulário entra na tela
    var card = document.querySelector(".form-card");
    function fireView() {
      if (viewFired) return;
      viewFired = true;
      push({ event: "form_view" });
    }
    if (card && "IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { if (e.isIntersecting) { fireView(); io.disconnect(); } });
      }, { threshold: 0.25 });
      io.observe(card);
    } else { fireView(); }

    // Pergunta 1: "Não" -> tela "não é advogado" (sem dados pessoais, sem Pipedrive, nunca conversão)
    document.querySelectorAll("input[name='e_advogado']").forEach(function (r) {
      r.addEventListener("change", function () {
        if (r.value === "nao" && r.checked) {
          setStep("blocked");
          push({ event: "lead_nao_advogado" });
        }
      });
    });
    var btnAlt = document.getElementById("btn-alterar-resposta");
    if (btnAlt) btnAlt.addEventListener("click", function () {
      var nao = document.querySelector("input[name='e_advogado'][value='nao']");
      if (nao) nao.checked = false;
      setStep("1");
    });

    var btnCont = document.getElementById("btn-continuar");
    if (btnCont) btnCont.addEventListener("click", function () {
      var adv = document.querySelector("input[name='e_advogado']:checked");
      if (adv && adv.value === "nao") { setStep("blocked"); return; }
      if (validateStep1()) {
        push({ event: "form_step1_complete" });
        setStep("2");
      } else {
        focusFirstInvalid(document.getElementById("step-1"));
      }
    });

    var btnVoltar = document.getElementById("btn-voltar");
    if (btnVoltar) btnVoltar.addEventListener("click", function () { setStep("1"); });

    // Trigger alternativo de consentimento: marcar a caixa (desmarcar remove os cookies gravados nesta visita).
    var consentBox = document.getElementById("consentimento");
    if (consentBox) consentBox.addEventListener("change", function () {
      if (!CONFIG.cookiesRequireConsent || CONFIG.cookieConsentTrigger !== "checkbox") return;
      if (consentBox.checked) grantConsent(); else revokeConsent();
    });

    var form = document.getElementById("form-qualificacao");
    var errBox = document.getElementById("submit-error");
    if (form) form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (submitting) return;
      if (root.getAttribute("data-form-step") !== "2") return;
      if (errBox) errBox.classList.remove("is-visible");
      if (!validateStep2()) { focusFirstInvalid(document.getElementById("step-2")); return; }

      var btn = document.getElementById("btn-enviar");
      // Consentimento dado (caixa marcada e passo 2 válido): só agora os cookies podem ser gravados (trigger "submit").
      if (CONFIG.cookiesRequireConsent && CONFIG.cookieConsentTrigger === "submit") grantConsent();
      var payload = buildPayload();
      submitting = true;
      if (btn) { btn.disabled = true; btn.setAttribute("aria-busy", "true"); }

      sendLead(payload).then(function () {
        // Sucesso (HTTP ok com Pipedrive ligado; fluxo local com Pipedrive desligado).
        // Evento do conversoes-gtm.md §4.1 (+ event_id, decisão de 12/11) — no callback de sucesso, nunca no clique.
        push({
          event: "form_submit",
          form_id: CONFIG.formId,
          form_status: "success",
          is_test: payload.is_test,
          lead_source: CONFIG.leadSource,
          lp_frente: CONFIG.lpFrente,
          event_id: payload.event_id           // mesmo event_id do payload (dedup Pixel/CAPI)
        });
        if (digits(payload.processo).length) push({ event: "process_number_filled" });
        setStep("thanks");
      }).catch(function (err) {
        console.error("[DigCap LP] falha no envio:", err);
        if (errBox) errBox.classList.add("is-visible");
      }).then(function () {
        submitting = false;
        if (btn) { btn.disabled = false; btn.removeAttribute("aria-busy"); }
      });
    });
  }

  /* Ordem das seções (do design da direção) */
  function setOrder(ids) {
    var m = document.getElementById("conteudo");
    if (!m) return;
    (ids && ids.length ? ids : CONFIG.defaultOrder).forEach(function (id) {
      var el = m.querySelector('[data-section="' + id.trim() + '"]');
      if (el) m.appendChild(el);
    });
  }
  if (CONFIG.allowUrlOverrides && params.get("ordem")) {
    var applyOrder = function () { setOrder(params.get("ordem").split(",")); };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", applyOrder); else applyOrder();
  }

  // Rolagem até #qualificacao descontando o header fixo (como no design da direção)
  function scrollToQualificacao(smooth) {
    var el = document.getElementById("qualificacao");
    if (!el) return;
    var header = document.querySelector(".header");
    var top = el.getBoundingClientRect().top + window.scrollY - ((header ? header.offsetHeight : 0) + 12);
    window.scrollTo({ top: Math.max(0, top), behavior: smooth ? "smooth" : "auto" });
  }
  document.addEventListener("click", function (ev) {
    var a = ev.target.closest && ev.target.closest('a[href="#qualificacao"]');
    if (!a) return;
    ev.preventDefault();
    try { history.replaceState(null, "", "#qualificacao"); } catch (e) {}
    scrollToQualificacao(!window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  });
  window.addEventListener("load", function () { if (location.hash === "#qualificacao") scrollToQualificacao(false); });

  window.DigCapLP = {
    CONFIG: CONFIG, PIPEDRIVE_FIELD_MAP: PIPEDRIVE_FIELD_MAP, HEADLINES: HEADLINES,
    setOrder: setOrder, setHeadline: setHeadline, setOab: setOab, setWhatsapp: setWhatsapp, setStep: setStep,
    lastPayload: null, lastEnvelope: null, hasConsent: function () { return consentGiven; }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
