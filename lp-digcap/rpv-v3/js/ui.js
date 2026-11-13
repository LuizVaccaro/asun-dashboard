/* UI da LP v3 (sem relação com o rastreio, que fica em main.js): cabeçalho, entrada suave, destaque do menu, barra fixa mobile. */
(function () {
  var root = document.documentElement;
  var header = document.querySelector(".header");
  function onScroll() { if (header) header.classList.toggle("is-stuck", window.scrollY > 8); }
  window.addEventListener("scroll", onScroll, { passive: true }); onScroll();

  // Entrada suave (fade-up). Sem IntersectionObserver ou com movimento reduzido: tudo visível.
  var items = [].slice.call(document.querySelectorAll(".reveal"));
  if ("IntersectionObserver" in window && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
    items.forEach(function (el) { io.observe(el); });
  } else { root.classList.add("reveal-timeout"); }

  // Menu: destaca a seção que está na tela.
  var links = [].slice.call(document.querySelectorAll(".nav a"));
  if ("IntersectionObserver" in window && links.length) {
    var map = {};
    links.forEach(function (a) { var id = (a.getAttribute("href") || "").split("#")[1]; var s = id && document.getElementById(id); if (s) map[id] = a; });
    var so = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        links.forEach(function (a) { a.classList.remove("is-active"); });
        var a = map[e.target.id]; if (a) a.classList.add("is-active");
      });
    }, { rootMargin: "-45% 0px -50% 0px", threshold: 0 });
    Object.keys(map).forEach(function (id) { so.observe(document.getElementById(id)); });
  }

  // Barra fixa com o CTA no mobile: aparece depois do hero e some quando o formulário está na tela.
  var bar = document.getElementById("sticky-bar"), hero = document.getElementById("hero"), form = document.getElementById("qualificacao");
  if (bar && hero) {
    var formOn = false;
    function upd() {
      var past = hero.getBoundingClientRect().bottom < 0;
      var show = past && !formOn;
      bar.classList.toggle("show", show);
      bar.setAttribute("aria-hidden", String(!show));
      var a = bar.querySelector("a"); if (a) a.tabIndex = show ? 0 : -1;
    }
    if ("IntersectionObserver" in window && form) {
      new IntersectionObserver(function (es) { formOn = es[0].isIntersecting; upd(); }, { threshold: 0 }).observe(form);
    }
    window.addEventListener("scroll", upd, { passive: true }); upd();
  }
})();
