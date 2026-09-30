# Orbit: a test kit for the Figma Comparison agent

A small static website, a Figma file generated from it, a list of deliberately seeded differences and an answer key, so that a run of Superflow's **Figma Comparison** agent (id `figma-design-diff`) can be scored for what it finds, what it misses and what it invents.

Orbit is a fictional design review product. Every page exists twice:

- the **clean** variant is the reference implementation. The Figma frames were generated from it, so a clean page and its frame agree on every text, font, colour, position and image;
- the **buggy** variant is the clean page plus the seeded differences below, and nothing else.

The answer key was checked before publishing by running the comparison engine locally against these pages and the frames: the clean pages produce no candidates at all, and the buggy pages produce every detectable seeded difference plus one known engine side effect.

## Frames and paths

| Figma frame | Page path | Variant | Frame size | Seeded differences |
|---|---|---|---|---|
| Home | `/` | buggy | 1440 x 2180 | a to m |
| Pricing | `/pricing` | buggy | 1440 x 1785 | n, o, p |
| Home Mobile | `/m` | buggy | 375 x 2738 (captured as a phone) | q, r |
| Home (control) | `/clean` | clean | 1440 x 2180 | none |
| Pricing (control) | `/clean/pricing` | clean | 1440 x 1785 | none |
| Home Mobile (control) | `/clean/m` | clean | 375 x 2738 (captured as a phone) | none |

The frames live on the page **Test frames** of the kit's Figma file (`<FIGMA_FILE_URL>`, ask the kit owner for the link). Node ids are in [`figma/frames.json`](figma/frames.json). The agent compares one frame per page path, so the clean paths get their own frames: the `(control)` frames are exact clones of the originals.

`/variants` on the deployed site lists every path with its seeded differences.

## Seeded differences

Implemented in [`src/bugs.mjs`](src/bugs.mjs) (style changes, emitted as one `<style id="seeded-bugs">` block) and the templates in [`src/templates.mjs`](src/templates.mjs) (markup changes). The full expectations, with layer names, node ids, selectors and notes, are in [`expected-findings.json`](expected-findings.json).

| Id | Page | Change on the page | Expected finding (engine issue key) |
|---|---|---|---|
| a | `/` | Hero subtitle says "14-day" instead of "30-day" | `content.mismatch` on Hero subtitle |
| b | `/` | Trust line "No credit card required." removed | `content.missing` on Trust line |
| c | `/` | Extra announcement bar "New: AI summaries for every project update" | `content.extra` (info) |
| d | `/` | Hero title 48px instead of 56px | `typography.size` on Hero title |
| e | `/` | Feature card titles weight 400 instead of 600 | `typography.weight`, one finding with count 3 |
| f | `/` | Testimonial quote in Inter instead of Playfair Display | `typography.family` on Testimonial quote |
| g | `/` | Nav "Get started" background #7C3AED instead of #4F46E5 | not detectable today, see known gaps |
| h | `/` | Features eyebrow #6B7280 instead of #4F46E5 | `color.text` on Features eyebrow |
| i | `/` | Hero CTA row shifted 64px to the right | `layout.position` on both CTA labels |
| j | `/` | Feature cards 2 and 3 swapped | `layout.position` on the swapped titles and texts (`layout.order` also accepted) |
| k | `/` | Feature card gap 64px instead of 24px | `layout.position` on the icons of cards 2 and 3 (`layout.spacing` also accepted) |
| l | `/` | First feature card icon missing (empty slot) | `assets.missing` on Feature 1 icon |
| m | `/` | Hero illustration drawn 480x240 instead of 480x320 | `assets.wrongAspect` (a `layout.size` on the same layer is accepted) |
| n | `/pricing` | Pro description "Best for small teams" instead of "Best for growing teams" | `content.mismatch` on Pro plan description |
| o | `/pricing` | Plan names 24px instead of 20px | `typography.size`, one finding with count 3 |
| p | `/pricing` | Highlighted plan background #FFFFFF instead of #EEF2FF | `color.background` on Pro plan card |
| q | `/m` | Mobile hero CTA "Start trial" instead of "Start free trial" | `content.mismatch` on Start free trial label |
| r | `/m` | Hamburger menu icon missing (empty button) | `assets.missing` on Menu icon |

The page layout is built so that no difference spills into another: the hero has a fixed height, removed icons leave an empty slot of the same size, and changed type keeps its line height and line count.

## Traps: things that must not be reported

| Id | Where | What differs | Why it must be ignored |
|---|---|---|---|
| T1 | every path | Footer "Status updated 10:42 AM" on the page, "Status updated 9:15 AM" in the frames | Clock times are dynamic text |
| T2 | `/pricing`, `/clean/pricing` | Pro price "$29/month" on the page, "$24/month" in the frame | A standalone price is dynamic text |
| T3 | `/pricing`, `/clean/pricing` | Three elements share `data-testid="plan-card"` and three share `data-testid="plan-name"` | Selectors must be unique; (o) must still be one grouped finding |
| T4 | desktop paths | "Sign in" rendered uppercase by CSS; the frame has "Sign in" with text case UPPER (same for the "Why teams switch" eyebrow) | Case is compared as rendered |
| T5 | every path | "Read the full story on our blog." and "See our billing guide for details." contain an inline link | One text run on the page, one mixed-style layer in the frame |
| T6 | every path | Headings inherit `color: oklch(0.21 0.034 264.665)`; the frames use #101828 | Same colour in another CSS colour space |
| T7 | Home paths | The testimonial section is invisible until an IntersectionObserver reveals it on scroll | The capture reveals it; its text must be found |
| T8 | every path | Repeated strings ("Start free trial", "Orbit", "Product", "Pricing") | Each copy must pair with its nearest counterpart |

Any finding on a clean path is a false positive.

## Known engine gaps and noise

Documented in the answer key so a run is not scored against behaviour the engine cannot have today:

- **(g) small backgrounds are never compared.** Background colours are compared only for design boxes covering at least 2% of the frame; the nav button is about 0.14%. The key marks (g) `"detectable": false`: a run that misses it still passes, and a run that finds it is flagged as "known gap, but found".
- **(k) spacing between card frames is not measured.** The auto-layout spacing check only measures gaps between direct children that are text or image layers. The Features row's children are card frames, so the gap change shows up as the icons in card slots 2 and 3 sitting 40px and 80px to the right.
- **(c) causes one false background finding.** Background counterparts are matched by overlap without removing the page-wide vertical shift, so the design's white Nav bar is compared with the new dark 40px announcement bar (`color.background`, #ffffff against #111827). The key lists it under `knownNoise`: it is reported separately and does not fail the run.

## Repository layout

```
src/                     page templates, copy, icons, styles and the seeded bug list
public/                  the built site (npm run build); this is what gets deployed
scripts/build.mjs        renders public/ (clean and buggy variants of every page)
scripts/serve.mjs        local static server with the same clean URLs as the deployment
scripts/dump-layout.mjs  renders the clean pages and writes design-dump/<page>.json and screenshots
scripts/figma/           generate-scripts.mjs (dump to Figma script) and builder.js (the Figma plugin code)
scripts/score-run.mjs    scores a run against expected-findings.json
design-dump/             the layout dumps the frames were built from
figma/                   frames.json (node ids), scripts/ (generated build scripts), clone-controls.js
expected-findings.json   the answer key
fixtures/                a synthetic run (every engine candidate confirmed) for trying the scorer
screenshots/             clean pages, frames, and side-by-side comparisons (compare-*.png)
```

No dependencies. Node 18 or later. Playwright with Chromium is needed only for `npm run dump`; if it is not installed in this folder, point `PLAYWRIGHT_MODULE` at an installed copy (`PLAYWRIGHT_MODULE=/path/to/node_modules/playwright npm run dump`).

## Build and preview

```sh
npm run build     # writes public/: index.html, pricing.html, m.html, clean.html, clean/pricing.html, clean/m.html
npm run serve     # http://127.0.0.1:4321  (/ /pricing /m and /clean /clean/pricing /clean/m)
```

Open `/m` in a narrow window or with device emulation; it is the phone layout at any width.

## Dump the layout

```sh
npm run dump      # all three clean pages; --pages home,pricing,mobile to pick
```

Each page is rendered the way the agent captures a page: a viewport as wide as the frame (1440, or 375 with a phone user agent, touch and `isMobile`), 900 tall, DPR 1, reduced motion, web fonts loaded and the scroll-revealed section forced visible. Elements are classified with the agent's own rules, so every Figma layer has exactly one counterpart on the page:

- **text**: an element whose content all flows inline owns it as one entry (raw text, text-transform, box in document px, font family, weight, style, size, line height, letter spacing, hex colour, alignment, line count, and per-run styles for rich text);
- **box**: anything else that paints a background or border (background, radius, borders per side);
- **asset**: inline SVG (its markup and box);
- **container**: elements marked `data-figma-autolayout="horizontal|vertical"` (direction, measured gap, children in order).

Layer names come from `data-figma-name` attributes. The dump warns about anything that would make the frame disagree with the page (padding on a text element, a container child that is not drawn, horizontal overflow).

## Rebuild the Figma frames

1. `npm run figma:scripts` turns the dumps into `figma/scripts/home.js`, `pricing.js` and `mobile.js`. Each is a self-contained script for the Figma Plugin API (under 50 KB, top-level `await`), with the dump inlined.
2. In the Figma file, on the page **Test frames**, run the three scripts, for example through the Figma MCP `use_figma` tool. Each replaces the top-level frame of the same name and returns the new node ids.
3. Run `figma/clone-controls.js` (set the three source ids first) to recreate the `(control)` frames.
4. Rebuilding changes node ids: update `figma/frames.json`, the `frames` and `nodeId` fields in `expected-findings.json`, and the mapping in Superflow.
5. Screenshot each frame and compare it with `screenshots/clean-<page>.png`.

How a page becomes a frame:

- a text element becomes a TEXT layer with the element's raw DOM text and `textCase` UPPER where CSS uppercases it, the exact font, size, line height, letter spacing and colour, fixed width with auto height (or hug width for a tight single line), placed by its alignment anchor; the builder widens or narrows a layer by a few px if Figma would wrap it onto a different number of lines than the browser (no page needed that);
- a painted box becomes a frame with the same fill, radius and strokes, and holds the layers drawn inside it;
- an inline SVG is imported with `createNodeFromSvg`, its strokes are outlined and its shapes flattened into **one** vector (colours are kept per region) inside a fill-less frame of exactly the SVG's box, so each page image has exactly one design asset;
- a marked container becomes a real auto-layout frame with the measured `itemSpacing` (Nav links, Hero CTA row, Features row, Plans row, FAQ list, Footer links);
- dynamic strings are swapped for their design values (`DESIGN_TEXT_OVERRIDES` in `src/content.mjs`), which is what makes traps T1 and T2.

## Deploy

The site is static; `vercel.json` sets `public/` as the output, clean URLs (`/pricing` serves `pricing.html`) and `Cache-Control: no-store`.

```sh
vercel deploy --prod
```

Deployment URL: `https://<your-deployment>.vercel.app` (fill in after the first deploy). Check `/variants` there to confirm all six paths.

## Map the frames in Superflow

The Superflow project must be the one whose site is the deployment above. Map each frame to its path from the table at the top (six rows, one frame per path):

- **Project Settings > Figma design**: paste the Figma file link, *Load file*, *Add frames*, select the six frames, enter each *Page path*, then *Save mapping* and wait until every row says *Captured*.
- or the **Figma Comparison** run modal: pick the project, paste the Figma link, *Import*, add the page URL for each frame, keep every check selected under *What to check for?*, then *Run*.

## Run

Run the Figma Comparison agent on all six URLs (a page list or a site scan of the deployment) with all five checks selected (layout, content, typography, colour, assets). Keep the run's execution id.

## Score

```sh
npm run score -- saved-run.json                  # a saved /v2/agents/execution/get response (includeResults: true)
npm run score -- <executionId>                   # fetch it live (or --execution <executionId>)
npm run score -- --execution <executionId> --wait --save run.json --json score.json
```

Live mode reads `VELT_API_BASE` (the Velt REST API origin for the environment you ran in), `VELT_API_KEY` and `VELT_AUTH_TOKEN` from the environment or a local `.env` file (keep it out of version control). It posts `{ executionId, includeResults: true }` to `/v2/agents/execution/get` with the `x-velt-api-key` and `x-velt-auth-token` headers, wrapped as `{ "data": { ... } }` first and as a bare body if that is refused.

Findings are read from `results[].agentResult.findings[]` and matched on their evidence, `metadata.figmaDiff` (`issue`, `designName`, `expected`, `actual`); the per-page summary comes from `results[].agentResult.report.extra.figmaDiff`. For each page the scorer prints:

| Mark | Meaning |
|---|---|
| `ok` | a seeded difference that was found |
| `MISS` | a detectable seeded difference that was not found |
| `gap` / `ok+` | a known engine gap, not found (expected) or found anyway |
| `ok~` | an accepted side effect of a seeded difference |
| `nz` | known engine noise |
| `NEW` | a finding that matches nothing in the key: something the agent invented or over-reported |
| `FP` | any finding on a clean page |

It exits with 1 when anything detectable is missed, when a clean page has a finding, or when a page was skipped; `--strict` also fails on known gaps. `npm run score -- fixtures/synthetic-all-candidates-confirmed.json` shows a passing run.

## Changing the kit

1. Edit `src/` and run `npm run build`.
2. Keep every seeded difference in `src/bugs.mjs` or behind a `bugs.has(id)` check in the templates, and update `expected-findings.json`.
3. `npm run dump`, `npm run figma:scripts`, rebuild the frames and the controls, update the node ids, and remap the frames in Superflow.
4. Deploy, run, score.
