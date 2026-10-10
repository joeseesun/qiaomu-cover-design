# Qiaomu Design

[中文使用说明](README.zh-CN.md)

Previously Qiaomu Cover Design. The plugin ID and `.qcover` format stay the same; existing designs, model settings and image history continue to work.

Create editable covers and posters inside Obsidian. Use platform presets for Xiaohongshu, YouTube, Bilibili, WeChat, X and more; add text, shapes, offline stickers and icons, draw smooth strokes, and export PNG/JPEG/WebP. Designs are saved as `.qcover` files in your vault, with undo/redo, named layers, groups and selection tools.

Optional AI tools compose copy and layouts, generate images, or edit selected images/elements. Configure your own Codex CLI or supported cloud provider (including Seedream and Jimeng); generation stays visible until you choose to send it to the background. Review results before inserting or replacing anything. Gallery combines generated/uploaded pictures, image jobs, local-folder references and Unsplash photos. Bulk deletion asks for confirmation; local-folder pictures are only hidden from Gallery.

The AI Designer keeps separate conversations for each canvas. New chat preserves your artwork while clearing prior chat context; the title menu switches, renames or deletes conversations and preserves drafts. Applied turns offer an independent canvas direction during the current editing session. Starting from a blank canvas creates a separate file. Only recent successful pairs from the active chat enter model context, alongside the current canvas.

**Desktop only; Obsidian 1.11.4 or newer.** Offline editing needs no account. Cloud AI requires your own provider account and may incur charges. Unsplash requires your own Access Key or proxy. The plugin is free; optional donations do not unlock features. Opening About loads the author’s follow/donation QR images from radio.qiaomu.ai. No client telemetry is collected. Network requests occur for the default font library (GitHub/jsDelivr), configured AI providers (prompts and selected reference images), and Unsplash (search, photos and required download tracking). Custom endpoints/proxies are user supplied. Codex CLI runs a local process using your configured account. Local-folder browsing, system export and CLI work may access files outside the vault; folder browsing is shallow, ignores symlinks and never deletes originals.

Install from the [GitHub release](https://github.com/joeseesun/qiaomu-cover-design/releases/tag/0.2.2), or open the [official directory listing](https://community.obsidian.md/plugins/qiaomu-cover-design). Directory indexing and client search availability are separate from webpage publication. For manual installation, extract the complete ZIP into `.obsidian/plugins/`; preserve `data.json`, `gallery/`, `image-jobs/`, custom fonts and caches when upgrading. The official installer needs only the three root plugin assets; stickers/icons are embedded in `main.js`, and fonts are fetched with SHA-256 verification on first use.


## Getting started

Run **New cover**, **Open Qiaomu Design**, or **Create cover from current note** from the command palette. Add/edit text, shapes, stickers and pictures on the canvas. Double-click text to type, use the right inspector to refine it, and use layers to name/group/lock objects. Designs default to `Cover designs/`; exported pictures default to `Cover designs/Exports/`, both configurable. Reopen a `.qcover` file to continue editing.

Configure layout and image models separately under **Models & services**. Model aliases only change display names. Seedream, Jimeng and Codex CLI have separate request adapters; provider version/account availability still applies. Layout recommendations show up to seven previews. AI image editing sends selected reference images or a rendered selection to the chosen provider. Replacement of editable text/shapes creates a bitmap; undo restores the original elements. Generation is never automatically retried as a paid request.

Gallery supports search, preview, upload, renaming, confirmed deletion and multi-select insertion (up to 24 pictures per batch). Deleting uploaded/generated library files does not change independent copies already inserted into designs. Removing jobs keeps their pictures. Local-folder browsing shows only direct PNG/JPEG/WebP files; hidden pictures can be restored. Uploads are limited to 30 MB and 36 MP. Unsplash pictures keep photographer/source links and use its download tracking endpoint on insertion.

Drawing uses B to toggle, Escape to exit, inline color/width controls and one undo step per stroke. Paths remain movable/scalable/recolorable. Drag on blank space to select elements, Shift to extend selection, and use context menus for ordering, grouping, locking, AI editing or selection export. Zoom/fit controls sit at the lower right. Export PNG/JPEG/WebP at 1–3×, to the vault or a user-chosen system folder; note insertion and cover-property updates are optional user actions.

## Fonts and offline assets

The default library has 34 open-source font files, with their SIL OFL notices. Official installs download missing fonts (about 31 MB) from [qiaomu-cover-fonts](https://github.com/joeseesun/qiaomu-cover-fonts) through jsDelivr with GitHub fallback; every binary is checked against the compiled size/SHA-256 manifest. System fonts are used while downloads are unavailable; completed downloads work offline. The complete ZIP contains the full font library and licenses.

Fluent Emoji Flat stickers and Lucide line icons are compressed and embedded in `main.js`, so official three-file installs need no separate asset download. Full copyright/permission notices are embedded in the bundle and included in the ZIP. The optional ZIP disk copy is named `assets-pack.json.gz`.

## Compatibility and limits

Desktop Obsidian 1.11.4+. AI configuration is stored in the plugin's local settings, not design files; protect/avoid syncing local credentials. Images are embedded in designs; generated pictures/jobs and uploaded Gallery copies live in the plugin's `image-jobs/` and `gallery/` directories. Back up these directories and `data.json` when moving vaults. A reload can interrupt active connections; unfinished requests are not automatically resubmitted. This is not a guarantee of cloud-provider cancellation.

Seedream 5.0 Lite and Jimeng 4.5 generation/reference editing have real service QA. Other advertised versions have protocol/parameter coverage, not paid end-to-end certification. Windows/Linux, physical stylus hardware, Codex image editing and popout windows remain unverified. There is no public design-sharing service or vector-node editor.

## Development and sources

```sh
npm ci
npm run check
npm run package
```

Checks run ESLint, tests, TypeScript and production esbuild. The ZIP is produced only by the package script, including validated font files. Node/Electron access is confined to desktop local capabilities. No remotely loaded executable code, React or Next.js is bundled.

This project adapts [cover4xiaohongshu](https://github.com/joeseesun/cover4xiaohongshu), by the same author, retaining its history. The plugin runtime is independently implemented with Obsidian FileView and Fabric. See [analysis](docs/ANALYSIS.md), [third-party licenses](THIRD_PARTY.md), [verification](docs/VERIFICATION.md), [release candidate record](docs/RELEASE-0.2.1.md) and [issues](https://github.com/joeseesun/qiaomu-cover-design/issues).

MIT © 向阳乔木.
