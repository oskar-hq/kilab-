# Wild design system (reference)

Extracted by [Inspo](https://github.com/Nutlope/inspo) from https://craft.wild.as — reference material for intentional design decisions: adapt, don't copy.

- **Mode:** light · **Macrostructure:** Marquee Hero
- **Tone:** High-contrast Swiss-inspired layout, heavy sans-serif typography, generative pixel-art wave, extreme white space, rigid grid.

## Projekt-Palette (angepasst: Hellblau · Grau · Weiß)

| Token | Hex | Rolle |
|---|---|---|
| `--paper` | `#FFFFFF` | Hintergrund |
| `--tint` | `#f1f4f7` | Abschnittsflächen |
| `--accent` | `#8fd0ff` | Hellblau, Akzent / Wellenkamm |
| `--accent-2` | `#d4ecff` | helles Blau |
| `--grey-1` | `#c9ced4` | helles Grau |
| `--grey-2` | `#8a929c` | mittleres Grau |
| `--deep` | `#4a525c` | dunkles Grau, dunkle Flächen |
| `--ink` | `#1d2126` | Text |

## Original tokens (reference)

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
