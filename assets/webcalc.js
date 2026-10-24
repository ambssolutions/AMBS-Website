/* Website calculator blocks ([data-webcalc]): redraws the results and the 12-month chart as the sliders move.
   The sums and the chart come from blocks.mjs, the same code that drew the block on the page, so the two always match.
   The wording comes from the block's hidden [data-tpl] lines, so it follows the language the visitor picked. */
import { CALC_RANGES, calcNumber, calcFigures, calcChart } from "./blocks.mjs?v=1ea9e5bd";

function init(root) {
  const words = root.querySelector(".blk-calc-words");
  const t = (k, n) => {
    const el = words && words.querySelector('[data-tpl="' + k + '"]');
    return el ? el.textContent.replace("{n}", n) : "";
  };
  const inputs = root.querySelectorAll("input[data-k]");
  const chart = root.querySelector(".blk-calc-chart");
  const draw = () => {
    const v = {};
    inputs.forEach((i) => { v[i.dataset.k] = calcNumber(i.dataset.k, i.value); });
    for (const k in CALC_RANGES) if (!(k in v)) v[k] = CALC_RANGES[k].start;
    const fig = calcFigures(v, t);
    root.querySelectorAll("[data-o]").forEach((o) => { o.textContent = fig[o.dataset.o]; });
    root.querySelectorAll("[data-r]").forEach((o) => { o.textContent = fig[o.dataset.r]; });
    if (chart) chart.innerHTML = calcChart(fig.perMonth, v.cost, t);
  };
  inputs.forEach((i) => i.addEventListener("input", draw));
  // a language switch rewrites the hidden wording; draw again in the new language
  if (words && "MutationObserver" in window) new MutationObserver(draw).observe(words, { subtree: true, childList: true, characterData: true });
  draw();
}

document.querySelectorAll("[data-webcalc]").forEach((r) => {
  if (r.dataset.ready) return;
  r.dataset.ready = "1";
  init(r);
});
