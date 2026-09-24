#!/usr/bin/env bash
# Builds ds-bundle/ (Claude Design upload layout) from the site's own CSS + fonts.
# CSS-only design system: no components, so no _ds_bundle.js / components/ / _ds_sync.json.
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf ds-bundle && mkdir -p ds-bundle/fonts ds-bundle/tokens ds-bundle/guidelines
cp assets/fonts/*.woff2 assets/fonts/OFL.txt assets/fonts/fonts.css ds-bundle/fonts/
# tokens: the :root block, verbatim
awk '/^:root\{/{p=1} p{print} p&&/^\}/{exit}' assets/style.css > ds-bundle/tokens/tokens.css
# styles.css: fonts + tokens + every rule after :root (designs receive only this @import closure)
{
  echo '/* Ylva Labs design system. Generated from assets/style.css by .design-sync/build.sh */'
  echo '@import "fonts/fonts.css";'
  echo '@import "tokens/tokens.css";'
  awk 'f{print} /^\}/&&!f{f=1}' assets/style.css
} > ds-bundle/styles.css
cp DESIGN.md ds-bundle/guidelines/design-reference.md
cp assets/icons/mark.svg ds-bundle/guidelines/mark.svg
{ cat .design-sync/conventions.md; echo; echo '---'; echo; echo 'Source of truth: `styles.css` (+ `tokens/tokens.css`, `fonts/fonts.css`). Background/rationale: `guidelines/design-reference.md`. Brand mark: `guidelines/mark.svg`.'; } > ds-bundle/README.md
echo "built ds-bundle: $(find ds-bundle -type f | wc -l) files"
