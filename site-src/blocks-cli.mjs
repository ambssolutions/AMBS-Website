/* Used by build.py: reads { pages: {slug: blocks}, sections: {id: section} } as JSON on stdin and
   writes { pages: {slug: html}, sections: {id: html}, strings: {key: english} } to stdout. */
import { renderBlocks, renderSection } from "./assets/blocks.mjs";
let raw = "";
for await (const c of process.stdin) raw += c;
const input = JSON.parse(raw || "{}");
const out = { pages: {}, sections: {}, strings: {} };
for (const [slug, blocks] of Object.entries(input.pages || {})) out.pages[slug] = renderBlocks(blocks);
for (const [id, sec] of Object.entries(input.sections || {})) out.sections[id] = renderSection(id, sec, out.strings);
process.stdout.write(JSON.stringify(out));
