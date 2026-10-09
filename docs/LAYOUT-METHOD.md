# Layout method for covers

How a cover is laid out, written so a person or an agent can follow it step by step. The numbers are enforced by `layoutPass` in the plugin; the same text is in the assistant's system prompt (`src/ai.ts`).

## 0. Decide before you draw
1. **One sentence.** What does this cover say? At most 14 characters a line, two lines at most.
2. **One focal point.** The headline or the subject, never both at the same weight.
3. **Viewing size.** Feeds show covers 120 to 360 px wide. If the headline cannot be read at 150 px wide, redo it.

## 1. Grid and margins
- Margin on every side: at least 6 % of the short side. Keep important things 10 % from the edge.
- All text shares one left edge (or one centre axis). Spacing in multiples of 8.
- Keep at least 30 % of the canvas empty. White space is a layout element, not leftover.

## 2. Hierarchy
- Title : subtitle at least 3 : 1 in size. Badge is about 0.3 to 0.4 of the title.
- Title line height 1.05 to 1.2; gap title to subtitle 0.25 to 0.35 of the title size.
- Group by proximity: things that belong together sit close, groups sit apart.
- Three text roles at most: badge, title, subtitle. Four font sizes at most.

## 3. Text and picture
- Text and subject sit on opposite sides with clear space between. They never overlap; the subject never covers a face.
- Text over a busy picture needs a scrim, a colour block or a stroke.
- Subject fills 50 % to 90 % of the height and sits near a third line. Decoration hangs off the title or the subject and never lies on text.

## 4. Recipes by shape
| Shape | Recipe |
|---|---|
| Wide (16:9, 2.35:1, 5:2) | Text left, picture right. Text block at most 55 % of the width, two lines, size at least 9 % of the height. Subject in the right 40 %, vertically centred, bleed allowed. |
| Tall (3:4, 9:16) | Top to bottom: badge, title, subtitle, picture. Text in the top 45 %, picture in the lower half. |
| Square (1:1) | Centred, or big left-aligned type. Large margins. With a subject, the subject takes the lower or right half. |

## 5. Colour and decoration
Background, text and one accent. Dark ground with light text or the reverse, never mid on mid. At most two decorations.

## 6. Self-check
No overlaps. Readable at 150 px. Contrast at least 4.5 : 1. Remove any one element: is it better? Then remove it.

Sources: Vistaprint and Made Good poster layout guides, the YouTube thumbnail guides from Renderforest and Podcastle, Canva's Xiaohongshu cover guides.
