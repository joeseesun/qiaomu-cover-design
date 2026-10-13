# Qiaomu Design 0.3.2 candidate

From a note's context menu, **Create cover from current note → Create** previously created a template using the filename without invoking AI. Even initial AI creation could leave the main canvas unchanged while showing proposals in the drawer.

Now Create and Enter read the linked note through the existing text-model connection and apply the first editable design. Alternatives remain available. **Create manually** explicitly keeps offline template creation; missing AI configuration opens setup instead of silently falling back to the filename. Explicit proposal requests on an existing canvas still leave it unchanged until a choice is clicked.

The export check also found badge text being recoloured against the page background instead of its own pill. Readability now checks the badge background, including over full-bleed images, while retaining explicit user colours and the existing warning behavior.

## Verification

- Default-Create regression reproduced on 0.3.1: `Default Create bypassed AI`, with no host errors.
- Badge contrast regression reproduced before the fix: `Readability pass made badge text unreadable against its own background`, with no host errors.
- `npm run check`: 140 passed, 0 failed; one existing native Canvas template case skipped because its binary is unavailable. Lint, type checking and production build passed. `npm audit --omit=dev`: no vulnerabilities.
- Obsidian 1.14.4 synthetic QA: file-menu event and actual modal-button click; body in the wire payload; first proposal applied and saved; explicit proposals preserve the canvas; switching and reopening; English Enter; no-model setup; explicit manual/offline creation; badge contrast. Model configuration restored after fixtures.
- Actual Kimi K3, default Create with no supplementary brief: “朗读中断，进度不丢”, subtitle “Reader 4.0.1：暂停位置保存，重开接着读”. Seven proposals, first selected, editable canvas and PNG export. Final badge text is white on black. No host errors or model warnings.
- Full ZIP checks font digests and licenses. The ZIP's main.js, manifest.json and styles.css match the production build byte-for-byte.

Other providers, Windows/Linux and official community installation were not individually verified in this patch. Official preview, public Release and directory verification are separate release gates; this document records the tested candidate, not completed publication.
