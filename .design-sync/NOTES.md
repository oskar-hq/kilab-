# design-sync notes

- This repo is a static site, not a component package: no package.json, no React, no Storybook. The standard converter (package/storybook shape) does not apply.
- User chose **tokens + CSS only** (2026-09-24): no React wrapper layer, no component cards. `ds-bundle/` = `styles.css` (+ `tokens/`, `fonts/`), `guidelines/`, `README.md` (conventions header). Rebuild with `.design-sync/build.sh`.
- No `_ds_sync.json` anchor: the envelope's recipe needs a JS bundle. Every re-sync re-uploads the whole bundle (13 files, cheap).
- Upload plan for this shape: writes `styles.css`, `README.md`, `tokens/**`, `fonts/**`, `guidelines/**`, `_ds_needs_recompile`; deletes the same dirs.
- `--sans` lists "Sneak" first. It isn't shipped (unlicensed, see README), so designs render in Inter Tight. That's intended.
- Not yet uploaded: DesignSync had no design-system authorization in the claude.ai/code session. `projectId` goes in config.json once a project is created.
