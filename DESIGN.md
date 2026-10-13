# Cover designer

The existing neutral Obsidian drawer remains the visual baseline. The user's content and the cover canvas are the focus.

- Describe a topic or paste source material, then compare up to seven complete copy/layout previews. Initial AI creation applies the first proposal and keeps the alternatives available. Explicitly requesting proposals on an existing canvas leaves it intact until a choice is clicked.
- Creating from a linked note reads its body with AI by default; manual template-only creation is an explicit secondary action. Missing model configuration opens setup instead of silently falling back to the note filename.
- Image service configuration describes capability. Each request separately opts into generation. Otherwise image operations are removed before execution, including from third-party assistants.
- Keep one short outcome in chat. Hide successful template/decor/safe-area housekeeping; retain errors, readability warnings and export paths.
- Templates use distinct installed display fonts for titles and calm body faces. Font loading precedes preview measurement. All exported text remains editable on the canvas.
- Reuse the drawer's ink, muted, line and hover tokens. Choice cards are compact horizontal thumbnails, browsable by trackpad, mouse drag and arrow keys, with neutral selected states and keyboard focus. Previews use the same copy, palette, points and font pairing as application.
- Temporary picture choice resets after the request; source text cannot silently opt into an image job.

- Direct image generation lives to the left of Insert. It uses an explicitly chosen saved image model and the user prompt, without the layout planner or cover-only image rules. Add one independent image layer; keep existing layers, undo history, model defaults and late-result canvas identity intact.
