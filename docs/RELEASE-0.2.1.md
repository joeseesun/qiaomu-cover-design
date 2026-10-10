# Qiaomu Design 0.2.1 release candidate

Previously Qiaomu Cover Design. Only the product display name changes: plugin ID `qiaomu-cover-design`, `.qcover` schema, settings, storage directories and integration IDs are preserved.

## Changes

- Image Gallery with generated/uploaded pictures, editable image jobs, local-folder references and recommended/searchable Unsplash photos. Multi-select insertion is one undo step; the trash button confirms bulk removal. Local files are hidden, never deleted.
- Smooth continuous drawing with perfect-freehand, inline color/width controls, B/Escape, pressure support and per-stroke undo; original Lucide image/sparkles artwork retained.
- AI generation stays open with progress and previews; optional background work, durable results, selection editing, model aliases and Seedream/Jimeng capability-aware forms.
- Stable snapping/context menus, aligned toolbar/color controls, pastel-first mesh palettes and compact notifications.
- Official three-file installs include the offline sticker/icon pack in main.js. Full license notices are embedded. ZIP installs retain fonts, asset pack and license files.
- Minimum Obsidian 1.11.4 matches the SecretComponent/secretStorage APIs used for Unsplash. Older release compatibility entries remain unchanged.

## Verification

104 local tests, ESLint, TypeScript and production build passed; production dependency audit reports zero vulnerabilities. Real Obsidian 1.14.4 QA covers Gallery upload/search/rename, batch deletion/cancel/partial identity safety, local hide/restore, undo/redo, drawing with native Electron mouse events, saved editable paths, toolbar/snapping, menus and color controls. A store-style asset check removes the external asset pack temporarily and verifies embedded sticker/icon insertion, browsing, saving and undo/redo. QA upgrades preserve data.json, gallery files, image jobs and fonts.

Seedream 5.0 Lite and Jimeng 4.5 text-to-image and reference editing were tested with configured services. Other model versions have protocol/parameter tests; account availability and paid outputs were not tested for every version. Codex image editing, physical stylus hardware, Windows/Linux, popout windows and mobile devices are not certified by this QA. This plugin is desktop-only.

## Official scan handling

The first preview (1f8030e6085800ef9bb9702ac03189823f4383c1) identified five blocking source-rule groups. The candidate replaces nonliteral Node imports, innerHTML SVG construction, navigator OS detection and static style assignments, and aligns minimum-host metadata with required APIs. English README and service/file-access disclosures were added. The final changed SHA must be scanned again before publication.

Nonblocking advisory warnings are evaluated separately: strict type assertions and DOM helper preferences concern existing typed/canvas code; detached font fetch callbacks do not use `this`; local HTML creation and timer/window ownership still need popout QA. Control-character filename validation is intentional. Settings retain the imperative API for the declared older host rather than adopting 1.13-only search definitions. Compatibility CSS warnings use a 1.7.4 baseline below the declared minimum; clip-path/underline/masonry are decorative and fall back to ordinary content. Important overrides and :has are scoped to plugin UI, not global app ancestors; theme and narrow-window QA passed. A duplicate text-align was removed. Deprecated Fabric methods remain supported by pinned Fabric 7.4.0, while IME keyCode is a legacy fallback. These are not claimed to be zero-warning certification.

Preview scan, GitHub release, anonymous asset downloads, official review, public listing, client index/search and native install are distinct release gates. Current evidence is recorded in the release/PR and official entry; this document alone does not assert publication.
