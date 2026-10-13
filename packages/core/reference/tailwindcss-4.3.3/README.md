# Tailwind CSS 4.3.3 — reference theme

`theme.css` and `LICENSE` are copied unchanged from the npm package `tailwindcss@4.3.3`
(`package/theme.css`, `package/LICENSE`, MIT). They are the source of `presetTw4`'s theme
(D-068): `scripts/tw4-theme.mjs` reads this file and writes `src/presets/tw4Theme.ts`.

Do not edit `theme.css` by hand. To move to another Tailwind version, put the new files in a new
`reference/tailwindcss-<version>/` folder, point the script at it and regenerate — the version and
the SHA-256 of the source go into the generated module, and the tests check them.
