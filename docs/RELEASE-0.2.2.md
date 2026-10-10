# Qiaomu Design 0.2.2

The AI Designer previously continued one history for each canvas, allowing old directions and failed turns to influence later requests. New chat now preserves the artwork and starts an isolated context. The title opens a compact conversation menu for switching, renaming, deleting or exploring a separate canvas. Drafts and the active conversation survive reopening; legacy chats migrate when their canvas is opened. Starting blank creates a separate file, never clears the original.

Only recent complete successful pairs in the active conversation reach a provider. Current canvas and selection remain visible beside the composer. Failed requests and prose-only warnings stay in display history and are excluded with their associated prompts. Hidden previous-turn pattern/spec state resets when switching. In-flight requests cannot switch threads; stale replies after leaving a file cannot enter another conversation. Settings writes are ordered and captured before queuing.

## Validation

108 unit/regression tests, lint, TypeScript and production build. Real Obsidian QA uses an injected deferred assistant to inspect the actual provider input without paid calls: legacy migration, rapid-click deduplication, draft persistence during generation, busy navigation lock, context isolation, scope deselection, rename/delete/cancel, branch snapshot selection with original file unchanged, separate blank artwork and canvas filename migration. Reload QA verifies active/history/drafts/current artwork; 620/900/1468 px layouts keep a 12 px header gap with no overlap. Color/drawing/Gallery behavior remains covered by existing tests.

Storage keeps up to 30 conversations per canvas and the latest 100 messages per conversation; the UI requires deletion before creating a 31st chat. Model input is limited to the last three successful pairs and 6,000 characters. Rich previews and per-turn canvas snapshots remain available during the editing session, as in the earlier version; reopening retains words, statuses and drafts rather than embedding artwork snapshots into settings. Older saved chats are preserved during migration.

## Release boundaries

Use the existing official workflow: exact candidate preview, authenticated draft-asset verification, isolated fresh/upgrade checks, publish, anonymous exact-URL verification, version PR merge, formal review and public listing. Record current evidence in the release/PR; this document alone does not assert those gates. Existing 0.2.1 nonblocking scan advisories and provenance recommendations remain disclosed. Desktop macOS QA does not certify other hosts or physical stylus hardware.
