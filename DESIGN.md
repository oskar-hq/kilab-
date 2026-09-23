# Wild design system (reference)

Extracted by [Inspo](https://github.com/Nutlope/inspo) from https://craft.wild.as — reference material for intentional design decisions: adapt, don't copy.

- **Mode:** light · **Macrostructure:** Marquee Hero
- **Tone:** High-contrast Swiss-inspired layout, heavy sans-serif typography, generative pixel-art wave, extreme white space, rigid grid.

## Tokens used in this project

```css
:root {
  --paper: #FFFFFF;
  --ink: #0A0A0A;
  --muted: #8b8b8b;
  --line: rgba(10,10,10,.12);
  --line-2: rgba(10,10,10,.06);
  --neon: #d8ff00;
  --red: #e0492a;
  --radius: 26px;
  --maxw: 1176px;
  --gutter: 56px;
  --cell: 14px;
  --readw: 34ch;
  --mono: "SFMono-Regular", ui-monospace, Menlo, Consolas, monospace;
}
```

## Type ramp (ratio preserved, scaled fluidly)

| Role | Size | Line-height | Letter-spacing |
|---|---|---|---|
| h1 | 75px → clamp | 0.92 | -0.035em |
| h2 | 46px → clamp | 1.06 | -0.02em |
| body | 16px | 1.5 | 0 |
| label / button | 10–11px mono, uppercase | 1.5 | .08em |

Spacing scale: `14 · 35 · 98 · 126 · 168` (multiples of the 14px cell). Radius: `0` / `6px`.
