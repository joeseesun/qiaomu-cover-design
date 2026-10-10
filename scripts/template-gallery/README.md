# Template gallery

Renders every template with the real template code and the bundled fonts, so a change to `src/templates.ts` can be checked
across platforms in one look.

```bash
npm run gallery
```

Then open http://localhost:4377/ in a browser. When the page says *Done*, the contact sheets are in
`artifacts/template-gallery/` (git-ignored).

Query options:

| option | meaning | default |
| --- | --- | --- |
| `sizes` | platform ids, comma separated | `xhs,youtube,wechat` |
| `only` | template ids to render | all in the gallery |
| `all=1` | include hidden templates | off |
| `t` / `s` / `b` | headline / subtitle / label | a sample |
| `w` | thumbnail size in px | 260 |
| `per` | templates per sheet | 12 |
| `out` | sheet file name prefix | `gallery` |

Worth checking after any template change: a long Chinese title, an English title, and the 9:16 and 5:2 sizes.
