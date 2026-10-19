Style sheet tidy tools (Node, with `npm install postcss postcss-selector-parser`):

- `node dead.js in.css out.css` removes rules whose class or id appears nowhere in the site's code.
- `node overridden.js in.css out.css` removes settings that a later rule with exactly the same selector always overrides.

Only use them together with a before/after check of every element's final style.
