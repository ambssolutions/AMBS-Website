/* Website ROI calculator blocks ([data-webcalc]): the job value buttons and box, the sliders, the month / year /
   3 years switch, numbers that count to their new value, and a small results bar that stays in view on phones.
   The sums and the chart come from blocks.mjs, the same code that drew the block on the page, so the two always match.
   The wording comes from the block's hidden [data-tpl] lines, so it follows the language the visitor picked. */
import { CALC_RANGES, calcNumber, calcFigures, calcChart, calcFill } from "./blocks.mjs?v=47faba2b";

const still = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

function init(root) {
  const words = root.querySelector(".blk-calc-words");
  const t = (k, n) => {
    const el = words && words.querySelector('[data-tpl="' + k + '"]');
    return el ? calcFill(el.textContent, n) : "";
  };
  const ranges = root.querySelectorAll('input[type="range"][data-k]');
  const jobBox = root.querySelector('input[data-k="job"]');
  const chips = root.querySelectorAll("[data-job]");
  const periods = root.querySelectorAll("[data-p]");
  const chart = root.querySelector(".blk-calc-chart");
  const bigEl = root.querySelector('[data-r="big"]');
  let job = calcNumber("job", jobBox ? jobBox.value : "");
  let period = root.dataset.period || "year";
  let shown = null, anim = 0;

  // the big number counts from where it was to the new amount
  const countTo = (to) => {
    cancelAnimationFrame(anim);
    if (still || shown === null) { shown = to; bigEl.textContent = "$" + Math.round(to).toLocaleString("en-NZ"); return; }
    const from = shown, t0 = performance.now(), dur = 420;
    const tick = (now) => {
      const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      shown = from + (to - from) * e;
      bigEl.textContent = "$" + Math.round(shown).toLocaleString("en-NZ");
      if (k < 1) anim = requestAnimationFrame(tick);
    };
    anim = requestAnimationFrame(tick);
  };

  const draw = () => {
    const v = {};
    ranges.forEach((i) => { v[i.dataset.k] = calcNumber(i.dataset.k, i.value); });
    v.job = job;
    for (const k in CALC_RANGES) if (!(k in v)) v[k] = CALC_RANGES[k].start;
    const fig = calcFigures(v, t, period);
    root.querySelectorAll("[data-o]").forEach((o) => { o.textContent = fig[o.dataset.o]; });
    root.querySelectorAll("[data-r]").forEach((o) => { if (o !== bigEl) o.textContent = fig[o.dataset.r]; });
    countTo(fig.bigN);
    chips.forEach((c) => c.setAttribute("aria-pressed", String(+c.dataset.job === job)));
    periods.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.p === period)));
    if (chart) chart.innerHTML = calcChart(fig.perMonth, v.cost, t);
  };

  ranges.forEach((i) => i.addEventListener("input", draw));
  chips.forEach((c) => c.addEventListener("click", () => {
    job = calcNumber("job", c.dataset.job);
    if (jobBox) jobBox.value = Math.round(job).toLocaleString("en-NZ");
    draw();
  }));
  if (jobBox) {
    jobBox.addEventListener("input", () => {
      const digits = jobBox.value.replace(/[^0-9]/g, "");
      if (!digits) return;
      job = calcNumber("job", digits);
      draw();
    });
    // tidy the box when they leave it: commas, and kept within the range the sums allow
    jobBox.addEventListener("change", () => { job = calcNumber("job", jobBox.value); jobBox.value = Math.round(job).toLocaleString("en-NZ"); draw(); });
    jobBox.addEventListener("focus", () => jobBox.select());
  }
  periods.forEach((b) => b.addEventListener("click", () => { period = b.dataset.p; draw(); }));

  // phones: the results bar shows while the sliders are on screen and the results card is not
  const card = root.querySelector(".blk-calc-card"), inputs = root.querySelector(".blk-calc-in");
  if (card && inputs && "IntersectionObserver" in window) {
    let cardIn = false, inIn = false;
    const set = () => root.classList.toggle("blk-calc--bar", inIn && !cardIn);
    new IntersectionObserver((es) => es.forEach((e) => { if (e.target === card) cardIn = e.isIntersecting; else inIn = e.isIntersecting; set(); }), { rootMargin: "-80px 0px -40% 0px" })
      .observe(card);
    new IntersectionObserver((es) => es.forEach((e) => { inIn = e.isIntersecting; set(); }), { rootMargin: "-80px 0px 0px 0px" }).observe(inputs);
  }

  // a language switch rewrites the hidden wording; draw again in the new language
  if (words && "MutationObserver" in window) new MutationObserver(draw).observe(words, { subtree: true, childList: true, characterData: true });
  draw();
}

document.querySelectorAll("[data-webcalc]").forEach((r) => {
  if (r.dataset.ready) return;
  r.dataset.ready = "1";
  init(r);
});
