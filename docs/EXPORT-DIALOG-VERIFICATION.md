# Export dialog verification

Verified on 2026-10-10 in the isolated `qiaomu-home-dashboard-qa` vault, macOS desktop Obsidian.

The installed export result markup had no matching CSS. Its intrinsic 1146px-wide image escaped a 300px grid track and covered the form. This change completes that export-only markup already present in the working checkout, including its translated labels and disabled destination option; other pending AI/editor changes are excluded.

The result track now has an explicit image box and zero intrinsic minimum widths. Desktop uses separate preview/form columns; narrow windows stack them. Long paths wrap, destination inputs shrink, and range-input margins no longer cause horizontal overflow. New exports default to JPEG at 92% and use `.jpg`; saved global/design choices retain priority.

`tests/host/export-dialog.js` exercises the real modal: light/dark themes at 1400×900, 900×640, 760×700 and 460×740, image containment, form separation, horizontal overflow, visible footer, format/quality/filename changes, default JPG, retained WebP and English labels. It exports and reads back JPEG (70,119 bytes), PNG (104,635 bytes), and WebP (25,210 bytes), each 1080×1920, checking MIME, decoded dimensions and written file signatures. Temporary designs and output images are removed; saved language/export preferences are restored.

`npm run check` passed lint, TypeScript and build; 44 unit tests passed, one unrelated native-canvas gallery audit was skipped because the native canvas binary is unavailable. `npm run package` passed.

The QA vault receives updates from concurrent work. Its latest installed files were preserved after testing; this report proves the candidate during this test, not that this candidate remains installed. No mobile-device or official directory acceptance is claimed.
