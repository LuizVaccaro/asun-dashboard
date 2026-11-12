/* ==========================================================================
   DigCap LP — staging (não publicado). Base: lp-v1 do Design + copy lp-v2.
   Todos os padrões trocáveis estão no objeto CONFIG logo abaixo.
   Nomes de campos e eventos: /workspace/clientes/digcap/conversoes-gtm.md
   ========================================================================== */

var CONFIG = {
  // --- Padrões pedidos pelo Gestor de Projetos (trocáveis) ---
  headline: "A",              // "A" | "B" | "C"  (A recomendada pela copy)
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
  consentVersion: "lp-v2-rascunho-2026-11-12", // versão (e data) do texto de consentimento; trocar quando a DigCap aprovar o texto
  clickIdCookieDays: 7,       // conversoes-gtm.md §4.5: "primeiro valor visto na sessão/7 dias". (Pedido do PM: 90 dias se o doc não dissesse nada; o doc diz 7.)
  clickIdPolicy: "first",     // "first" = mantém o primeiro valor visto (doc §4.5) | "last" = o clique novo sobrescreve
  cookieNames: { gclid: "gclid", fbclid: "fbclid" },
  cookieDomain: "",           // vazio = host atual. Na produção pode ser ".digcap.com.br" se a LP ficar em subdomínio.
  markLocalSubmitsAsTest: false, // true = com Pipedrive OFF, form_submit sai com is_test:true (evita contar conversão de teste se o GTM estiver ligado)

  // --- Modo staging ---
  internalMode: true,         // true = faixa interna, slots "[a confirmar]", bloco de prova social. Na publicação: false.
  allowUrlOverrides: true,    // permite ?headline=B&oab=required&whatsapp=on&passo=2 (só staging). Na publicação: false.
  debugLog: true              // loga o payload no console (contém dados pessoais do teste). Na publicação: false.
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
   confirmed:true  = nome vem do documento (ainda "a confirmar" no Pipedrive real).
   confirmed:false = campo NÃO listado no documento; nome sugerido, precisa de decisão/permissão. */
var PIPEDRIVE_FIELD_MAP = {
  nome:             { pipedrive: "person.name",          confirmed: true },
  email:            { pipedrive: "person.email",         confirmed: true },
  telefone:         { pipedrive: "person.phone",         confirmed: true },
  e_advogado:       { pipedrive: "e_advogado",           confirmed: true },
  tipo_credito:     { pipedrive: "tipo_de_credito",      confirmed: true },
  fase:             { pipedrive: "fase_do_processo",     confirmed: true },
  recorrencia:      { pipedrive: "recorrencia_carteira", confirmed: true },
  utm_source:       { pipedrive: "utm_source",           confirmed: true },
  utm_medium:       { pipedrive: "utm_medium",           confirmed: true },
  utm_campaign:     { pipedrive: "utm_campaign",         confirmed: true },
  utm_content:      { pipedrive: "utm_content",          confirmed: true },
  utm_term:         { pipedrive: "utm_term",             confirmed: true },
  gclid:            { pipedrive: "gclid",                confirmed: true },
  fbclid:           { pipedrive: "fbclid",               confirmed: true },
  landing_url:      { pipedrive: "landing_url",          confirmed: true },
  is_test:          { pipedrive: "is_test",              confirmed: true },
  wbraid:           { pipedrive: "wbraid",               confirmed: false },
  gbraid:           { pipedrive: "gbraid",               confirmed: false },
  _fbp:             { pipedrive: "fbp",                  confirmed: false },
  _fbc:             { pipedrive: "fbc",                  confirmed: false },
  ga_client_id:     { pipedrive: "ga_client_id",         confirmed: false },
  consent_version:  { pipedrive: "consent_version",      confirmed: false },
  referrer:         { pipedrive: "referrer",             confirmed: false },
  form_id:          { pipedrive: "form_id",              confirmed: false },
  submitted_at:     { pipedrive: "submitted_at",         confirmed: false },
  event_id:         { pipedrive: "event_id",             confirmed: false },
  oab:              { pipedrive: "oab_numero",           confirmed: false },
  oab_uf:           { pipedrive: "oab_uf",               confirmed: false },
  processo:         { pipedrive: "numero_processo",      confirmed: false }
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

  /* ---------- Atribuição: URL -> cookies first-party -> campos ocultos ---------- */
  var UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];
  var CLICK_COOKIE_KEYS = ["gclid", "fbclid"];          // também em cookie first-party
  var CLICK_SESSION_KEYS = ["wbraid", "gbraid"];
  var params = new URLSearchParams(location.search);

  // UTMs + wbraid/gbraid ficam num cookie first-party único (mesma validade dos click ids); gclid/fbclid em cookies próprios.
  var ATTR_COOKIE = "dc_attr";
  function loadStoredAttr() {
    try { return JSON.parse(getCookie(ATTR_COOKIE) || "{}") || {}; } catch (e) { return {}; }
  }
  function currentPolicy() {
    // Links de QA (?qa=1) sempre sobrescrevem, para o time poder testar o link Google e depois o link Meta no mesmo navegador.
    return isTest() ? "last" : CONFIG.clickIdPolicy;
  }

  function captureAttribution() {
    var stored = loadStoredAttr();
    var out = {};
    var changed = false;
    var policy = currentPolicy();
    UTM_KEYS.concat(CLICK_SESSION_KEYS).forEach(function (k) {
      var fromUrl = (params.get(k) || "").trim();
      var v = stored[k] || "";
      if (fromUrl && (!v || policy === "last")) { v = fromUrl; }
      if (v !== (stored[k] || "")) { stored[k] = v; changed = true; }
      out[k] = v;
    });
    if (changed) setCookie(ATTR_COOKIE, JSON.stringify(stored), CONFIG.clickIdCookieDays);
    CLICK_COOKIE_KEYS.forEach(function (k) {
      var name = CONFIG.cookieNames[k] || k;
      var fromUrl = (params.get(k) || "").trim();
      var fromCookie = getCookie(name);
      var v = fromCookie;
      if (fromUrl && (!fromCookie || policy === "last")) {
        v = fromUrl;
        setCookie(name, v, CONFIG.clickIdCookieDays);   // nunca grava vazio, nunca apaga
      }
      out[k] = v || "";
    });
    return out;
  }

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

  var attribution = captureAttribution();

  function setHidden(id, v) { var el = document.getElementById(id); if (el) el.value = v || ""; }
  function fillHiddenFields() {
    attribution = captureAttribution();
    Object.keys(attribution).forEach(function (k) { setHidden(k, attribution[k]); });
    setHidden("_fbp", readFbp());
    setHidden("_fbc", readFbc(attribution.fbclid));
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
  var HEADLINES = {
    A: "Antecipação de honorários para advogados",
    B: "Seus honorários de RPV e precatório, antecipados pela DigCap",
    C: "Honorários parados em processos contra entes públicos? A DigCap antecipa"
  };
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
    var bar = document.querySelector(".progress-bar");
    if (label) {
      if (step === "1" || step === "blocked") label.textContent = "Passo 1 de 2";
      else if (step === "2") label.textContent = "Passo 2 de 2";
      else label.textContent = "Enviado";
    }
    if (bar) bar.style.width = (step === "2" || step === "thanks") ? "100%" : "";
    if (opts.focus === false) return;
    var target = null;
    if (step === "2") target = document.getElementById("nome");
    else if (step === "blocked") target = document.getElementById("step-blocked");
    else if (step === "thanks") target = document.getElementById("step-thanks");
    else if (step === "1") target = document.querySelector("input[name='e_advogado']");
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
    var adv = document.querySelector("input[name='e_advogado']:checked");
    var tipos = document.querySelectorAll("input[name='tipo_credito']:checked");
    var fase = document.getElementById("fase");
    var rec = document.querySelector("input[name='recorrencia']:checked");
    var bad = [
      markInvalid("field-advogado", !adv),
      markInvalid("field-tipo", tipos.length === 0),
      markInvalid("field-fase", !fase || !fase.value),
      markInvalid("field-recorrencia", !rec)
    ];
    return bad.indexOf(true) === -1;
  }
  function validateStep2() {
    var requiredOab = root.getAttribute("data-oab") === "required";
    var oab = document.getElementById("oab"), oabUf = document.getElementById("oab_uf");
    var proc = document.getElementById("processo");
    var procDigits = digits(proc && proc.value).length;
    var bad = [
      markInvalid("field-nome", !document.getElementById("nome").value.trim()),
      markInvalid("field-email", !emailOk(document.getElementById("email").value.trim())),
      markInvalid("field-telefone", digits(document.getElementById("telefone").value).length < 10),
      markInvalid("field-oab", requiredOab && (!oab.value.trim() || !oabUf.value)),
      markInvalid("field-processo", procDigits > 0 && procDigits !== 20),
      markInvalid("field-consentimento", !document.getElementById("consentimento").checked)
    ];
    return bad.indexOf(true) === -1;
  }

  /* ---------- Payload / Pipedrive ---------- */
  function val(id) { var el = document.getElementById(id); return el ? el.value : ""; }

  function buildPayload() {
    fillHiddenFields();
    var tipos = [];
    document.querySelectorAll("input[name='tipo_credito']:checked").forEach(function (c) { tipos.push(c.value); });
    var adv = document.querySelector("input[name='e_advogado']:checked");
    var rec = document.querySelector("input[name='recorrencia']:checked");
    var p = {
      // qualificação + contato
      e_advogado: adv ? adv.value : "",
      tipo_credito: tipos,
      fase: val("fase"),
      recorrencia: rec ? rec.value : "",
      nome: val("nome").trim(),
      email: val("email").trim(),
      telefone: val("telefone"),
      oab: val("oab").trim(),
      oab_uf: val("oab_uf"),
      processo: val("processo"),
      consentimento: document.getElementById("consentimento").checked,
      // ocultos (nomes exatos do conversoes-gtm.md / lp-v2)
      utm_source: val("utm_source"), utm_medium: val("utm_medium"), utm_campaign: val("utm_campaign"),
      utm_term: val("utm_term"), utm_content: val("utm_content"),
      gclid: val("gclid"), fbclid: val("fbclid"), wbraid: val("wbraid"), gbraid: val("gbraid"),
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

    var form = document.getElementById("form-qualificacao");
    var errBox = document.getElementById("submit-error");
    if (form) form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (submitting) return;
      if (root.getAttribute("data-form-step") !== "2") return;
      if (errBox) errBox.classList.remove("is-visible");
      if (!validateStep2()) { focusFirstInvalid(document.getElementById("step-2")); return; }

      var btn = document.getElementById("btn-enviar");
      var payload = buildPayload();
      submitting = true;
      if (btn) { btn.disabled = true; btn.setAttribute("aria-busy", "true"); }

      sendLead(payload).then(function () {
        // Sucesso (HTTP ok com Pipedrive ligado; fluxo local com Pipedrive desligado).
        // Evento EXATAMENTE como em conversoes-gtm.md §4.1 — no callback de sucesso, nunca no clique.
        push({
          event: "form_submit",
          form_id: CONFIG.formId,
          form_status: "success",
          is_test: payload.is_test,
          lead_source: CONFIG.leadSource
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

  window.DigCapLP = {
    CONFIG: CONFIG, PIPEDRIVE_FIELD_MAP: PIPEDRIVE_FIELD_MAP, HEADLINES: HEADLINES,
    setHeadline: setHeadline, setOab: setOab, setWhatsapp: setWhatsapp, setStep: setStep,
    lastPayload: null, lastEnvelope: null
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
