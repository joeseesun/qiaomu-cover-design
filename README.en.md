# Qiaomu Design

[中文](README.md) | **English**

**Turn notes, ideas and images into editable covers and posters inside Obsidian.**

[Download](https://github.com/joeseesun/qiaomu-cover-design/releases/latest) · [Feature guide in Chinese](README.md#feature-tour) · [Issues](https://github.com/joeseesun/qiaomu-cover-design/issues) · [MIT license](LICENSE)

![Concept illustration: notes become editable designs and finished covers](docs/images/readme/01-hero.png)

The editorial illustrations in this guide were made with Codex's built-in image generator. They explain workflows; they are **not application screenshots or promises of plugin-generated output**. The template contact sheet below is rendered from actual repository code. See [media provenance and prompts](docs/images/readme/README.md).

**Desktop Obsidian 1.11.4+ · Offline core editing · Optional AI · Free and open source**

Previously Qiaomu Cover Design. The plugin ID `qiaomu-cover-design` and `.qcover` format remain unchanged. Existing designs, settings and image history do not need to be migrated because of the rename. This guide describes the **0.2.2** implementation.

## Start with a note; finish with a reusable design

Create social covers, article headers, video thumbnails, reading cards and posters without moving your copy through several tools. Begin with a note, choose a template or ask AI for a layout, refine individual elements, then export an image and optionally insert it back into the note.

Keep the `.qcover` source for future edits. Export PNG, JPEG or WebP for publishing. Core editing does not require an AI account.

## Quick start

1. Download the complete `qiaomu-cover-design-VERSION.zip` from [Releases](https://github.com/joeseesun/qiaomu-cover-design/releases/latest).
2. Extract its `qiaomu-cover-design` directory into your vault's `.obsidian/plugins/`.
3. Reload Obsidian and enable **Qiaomu Design** under Community plugins.
4. Run **Create cover from current note** or **New cover** from the command palette.
5. Choose a platform and template, edit the headline, add an image, then export.
6. Reopen the saved `.qcover` to continue editing.

Designs default to `Cover designs/`; exports default to `Cover designs/Exports/`. Both are configurable. A successful first run produces a reopenable source design and an exported image.

The complete ZIP contains fonts and license files. A three-file install (`main.js`, `manifest.json`, `styles.css`) also works: stickers/icons are embedded in the bundle, while missing default fonts download on first use. The complete ZIP is preferable for initial offline use.

**Upgrade by merging release files into the plugin directory. Preserve `data.json`, `gallery/`, `image-jobs/`, custom fonts and caches.** Do not delete the entire plugin directory first. GitHub releases and official community-directory approval are separate; check the actual directory before assuming an in-app listing exists.

## Product tour

### AI copy and editable layouts

![Concept illustration: brief, candidate layouts, editable composition](docs/images/readme/02-ai-layout.png)

Configure a layout model under **Models & services**, then enter a brief or use the command to create a cover from your current note or selection. The note command takes at most the first 6,000 characters; select the important passage for long notes.

Compare up to seven candidate previews, choose one and keep editing the resulting canvas. Layout instructions can create editable text and shapes. Image generation is optional and off by default for the layout flow. You can request changes to copy, colors, fonts and composition; complex requests are limited by the supported operation protocol and model output.

Example brief:

> Create a clear editorial cover for “30 days of AI writing.” Use a strong headline, a short subtitle for beginners, and a blue-and-cream palette. Do not generate an image yet.

New chat preserves the artwork while isolating prior chat context. Click the conversation title to switch, rename or delete history; drafts persist per conversation. The composer shows the current canvas or selection. Applied turns offer an independent direction during the current editing session; starting blank creates a separate file. Only recent successful pairs from the active conversation enter model context. Reopening retains words, statuses and drafts; rich previews and canvas snapshots remain session-local. Storage is bounded to 30 conversations per canvas and the latest 100 messages each. An offline assistant supports a smaller set of Chinese/English commands.

### Formats, templates and consistent series

![Concept illustration: portrait, square, landscape and banner compositions](docs/images/readme/03-formats.png)

| Preset | Canvas size |
| --- | --- |
| Xiaohongshu portrait / square | 1080 × 1440 / 1080 × 1080 |
| YouTube thumbnail | 1280 × 720 |
| Bilibili feed / upload / HD | 1146 × 717 / 1200 × 900 / 1920 × 1080 |
| Douyin / Channels vertical | 1080 × 1920 |
| WeChat article banner | 1410 × 600 |
| X header | 1500 × 600 |
| General square / landscape / portrait | 1080 × 1080 / 1920 × 1080 / 1200 × 1600 |

These are built-in presets, not a guarantee of current platform upload rules. Safety guides indicate typical overlay/crop areas. The YouTube preset includes a 2 MB export target.

Switching a template-based cover to a new shape recomputes its layout. Freeform additions scale to fit; entirely hand-built canvases use scaling. Inspect long titles, image edges and safety zones after switching.

Reuse templates while keeping your copy, compare A/B design directions, and save up to six series styles containing layout, palette and fonts. A/B means visual comparison, not online traffic experiments or click-through analytics. A saved series is a style preset, not a full canvas duplicate.

**Actual template output:**

![Real code-rendered folio, notes and swiss templates at three platform sizes](docs/images/readme/templates-real.png)

Rendered with this repository's template code and fonts. Columns: Xiaohongshu, YouTube, WeChat. Rows: folio, notes, swiss. This is a template contact sheet, not an Obsidian screenshot. [Reproduction](docs/images/readme/README.md#真实模板输出)

### Canvas, layers and drawing

![Concept illustration: independently editable text, images, layers and drawing](docs/images/readme/04-canvas.png)

- Double-click text to edit. Adjust weight, italics, line height, letter spacing, stroke, shadow and background.
- Move, resize, rotate, flip, round and crop pictures; use solid, gradient or mesh backgrounds.
- Use guides, snapping, centering, marquee selection and Shift selection.
- Search, rename, order, hide and lock layers; group and ungroup while preserving editable child elements.
- Use context menus for AI editing, transparent selection export and object operations.
- Toggle freehand drawing with `B`, choose color and width (1–100 px), and exit with `Escape`. Each stroke stays a movable, scalable, recolorable path with its own undo step.

Pressure input is implemented, but physical stylus hardware has not completed the recorded QA. Mouse drawing uses uniform pressure. The compact insertion toolbar can show icons or icons plus text; zoom and fit controls sit at the lower right.

### Fonts and offline assets

![Concept illustration: type specimens, palettes, stickers and line icons](docs/images/readme/05-fonts-assets.png)

The default library contains **34 open-source font files**, including weights and Latin/CJK faces, and **12 curated font pairings**. Thirty-four is a file count, not a count of distinct families. Use system fonts or import TTF, OTF, WOFF and WOFF2 files.

Complete ZIP installs include the library. Three-file installs fetch missing fonts (about 31 MB) from [qiaomu-cover-fonts](https://github.com/joeseesun/qiaomu-cover-fonts) through jsDelivr with GitHub fallback. Each binary is checked against the compiled size/SHA-256 manifest. System fallback applies while fonts are unavailable; completed downloads work offline.

Fluent Emoji Flat stickers and Lucide icons are embedded in `main.js`. Third-party notices are included in the bundle and full ZIP. Fonts use SIL OFL; see [THIRD_PARTY.md](THIRD_PARTY.md). System font availability varies by device.

### One Gallery, four sources

![Concept illustration: uploaded/generated pictures, jobs, folders and Unsplash](docs/images/readme/06-gallery.png)

| Tab | What it does | Removal behavior |
| --- | --- | --- |
| My images | Generated/uploaded pictures; search, filter, rename and preview | Deletes the library file, not independent copies embedded in designs |
| Image jobs | Status, results, prompt reuse and reference editing | Removing a job keeps generated images and clears task prompt/reference files |
| Local folders | Shallow PNG/JPEG/WebP browsing and insertion | Hide/restore only; never deletes originals or follows symlinks |
| Unsplash | Recommended photos, search and insertion | Uses your key/proxy, preserves photographer links and records download tracking |

Insert up to 24 pictures in one batch and undo the batch once. Bulk deletion asks for confirmation. Failed removals stay selected for retry.

Gallery uploads accept up to 30 MB and 36 MP; local-folder reads accept up to 30 MB. Direct canvas import has a separate 25 MB limit and may downsample large images. A file accepted into Gallery may still need resizing before canvas insertion.

### Image generation and selection editing

![Concept illustration: reference image, edit request, preview, insert or replace](docs/images/readme/07-image-ai.png)

Open **AI image generation**, select a configured model/aspect ratio, enter a prompt and optionally add references. The dialog stays visible while generating; you can explicitly send the job to the background. Results are previewed before you choose to insert anything and can be recovered from Gallery's image jobs.

Select an image, text, shape, group or multiple objects and choose **AI edit**. A single bitmap uses its original image as reference; other selections are rendered into a transparent PNG containing only selected objects. Choose **Insert copy** or **Replace** after previewing.

Single-image replacement preserves placement, transform, crop, mask and layer order. If the source selection changed during generation, replacement is rejected, but insertion remains available. **Replacing editable text/shapes with an AI result turns that selection into a bitmap.** Undo restores the original objects. Generated lettering is not editable text.

Choose a result to continue creating with it as the next reference; another request is sent only after entering/confirming the next instruction. Prompt presets fill drafts rather than sending immediately.

Layout and image models are configured separately. Supported adapters include Codex CLI, Seedream/Ark, Jimeng-compatible services and other image protocols exposed in settings. Bring your own account, endpoint and credentials; cloud usage may incur charges. Model aliases affect display names only. A discovered model does not prove account entitlement. [Detailed adapter limits](docs/AI-MODELS.md)

Failed paid generation is not automatically resubmitted. Reloading can interrupt an active connection; this does not guarantee provider cancellation or a refund. Completed results are persisted.

### Export and keep the source

![Concept illustration: editable qcover source and PNG, JPEG, WebP exports](docs/images/readme/08-export.png)

Export PNG/JPEG/WebP at 1–3×, adjust quality and optionally fit built-in file-size limits. Choose a vault folder, the source note's folder or a system folder. Filename tokens include `{name}`, `{platform}`, `{size}`, `{date}` and `{time}`.

Optionally insert the image into the source note, update its `cover` property or copy to the clipboard. Repeated exports use new filenames. Clipboard availability depends on system permissions.

For a partial export, use the selection context menu to save a transparent PNG cropped to selected bounds, preserving layer order with a maximum 4096 px long edge. Cancelling the save dialog writes nothing.

The plugin does not automatically publish to social networks. Keep `.qcover` for editing and publish exported images yourself.

## Shortcuts

Canvas focus is required; text editing retains normal input behavior. Use Command on macOS and Control on Windows/Linux.

| Action | Shortcut |
| --- | --- |
| Undo / redo | Cmd/Ctrl+Z / Cmd/Ctrl+Shift+Z |
| Save / duplicate / select all | Cmd/Ctrl+S / D / A |
| Group / ungroup | Cmd/Ctrl+G / Cmd/Ctrl+Shift+G |
| Rename / delete | F2 / Delete |
| Move / move 10 px | Arrow / Shift+Arrow |
| Drawing / exit drawing | B / Escape |

## Privacy, storage and limits

Core editing collects no client telemetry and does not upload your canvas. Network requests occur for font downloads, explicitly configured AI services, Unsplash and About-page follow/donation QR images hosted at `radio.qiaomu.ai`. AI requests send prompts, relevant text/canvas context and selected reference images to your chosen provider. Custom endpoints/proxies are your responsibility.

Codex CLI runs a local process using your configured account. Local-folder browsing and system export can access chosen locations outside the vault. Unsplash credentials use Obsidian secret storage. AI configuration lives in local plugin settings, not `.qcover` files; **do not publish or casually sync `data.json` containing credentials**.

Back up designs, exports, imported fonts, `data.json`, `gallery/` and `image-jobs/`. External folder references do not move original files. Embedded images increase design size. Autosave/conflict protection is not a replacement for backups; avoid simultaneous edits on different devices.

Desktop only. No hosted sharing service or vector-node editor. Windows/Linux, physical stylus hardware, Codex image editing and popout windows remain outside the recorded certification. The plugin is free; donations do not unlock features. Provider fees and third-party licenses still apply.

## Development and verification

Node.js 22 matches CI:

```sh
git clone https://github.com/joeseesun/qiaomu-cover-design.git
cd qiaomu-cover-design
npm ci --ignore-scripts
npm run check
```

`check` runs ESLint, automated tests, TypeScript and production esbuild. Full ZIP packaging uses `npm run package` and requires font binaries/licenses matching `src/fontmanifest.ts`; a basic build does not require the full font library. The repository's `deploy` script targets a maintainer-specific QA path and is not a general install command.

On **2026-10-10**, this documentation pass ran the checks: **103 passed, 1 skipped, 0 failed** out of 104 tests, plus successful lint/type/build checks. Production dependency audit reported zero vulnerabilities. The skipped test requires a native Canvas binary for full template layout checks. Separately, three templates at three sizes were freshly rendered in a browser from 0.2.1 code; this is not full host certification.

The [0.2.1 record](docs/RELEASE-0.2.1.md) separately documents prior Obsidian 1.14.4 QA and real Seedream 5.0 Lite/Jimeng 4.5 generation/reference-editing checks. Those paid service checks were not rerun for this documentation change. Other model versions have protocol/parameter coverage, not paid output certification. [Verification details](docs/VERIFICATION.md)

The runtime uses native Obsidian FileView, Fabric.js 7 and perfect-freehand. It bundles no React/Next.js runtime or remotely loaded executable code. AI layout operations are constrained canvas instructions, not arbitrary filesystem/export commands.

## Sources, contribution and author

Adapted from the same author's [cover4xiaohongshu](https://github.com/joeseesun/cover4xiaohongshu), preserving its history; the plugin runtime was independently implemented with Obsidian FileView and Fabric. See [analysis](docs/ANALYSIS.md), [third-party licenses](THIRD_PARTY.md), [contribution guide](CONTRIBUTING.md), [security reporting](SECURITY.md) and [code of conduct](CODE_OF_CONDUCT.md).

Report reproducible bugs with plugin/host/OS versions and sanitized screenshots. Never include keys, private notes or sensitive reference images.

**向阳乔木** · [Website](https://qiaomu.ai) · [Blog](https://blog.qiaomu.ai) · [Recommendations](https://tuijian.qiaomu.ai) · [X @vista8](https://x.com/vista8) · [GitHub](https://github.com/joeseesun) · WeChat: 向阳乔木推荐看

MIT © 向阳乔木. Third-party fonts and assets retain their own licenses.
