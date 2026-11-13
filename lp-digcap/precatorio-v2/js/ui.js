/* UI da LP (sem relação com o rastreio, que fica em main.js): cabeçalho, entrada suave, barra fixa mobile. */
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
