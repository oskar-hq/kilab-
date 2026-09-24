# Ylva Labs – design conventions

CSS-only design system (no JS components). Build with plain HTML/JSX + the classes and tokens below. Everything is in `styles.css`; read it before styling. Copy is German, Du/Ihr-tone ("Ihr bringt das Problem, wir bauen das Werkzeug").

## Setup
- Load `styles.css` (it imports `fonts/fonts.css` and `tokens/tokens.css`). Body is already styled: white `--paper`, `--ink` text, 15px/1.55 `--sans` (Inter Tight).
- Wrap page content in `.wrap` (max 1176px + 56px gutters; 35px ≤1024px, 16px ≤720px).
- Headings have no global styles – use the role classes below or set weight 500 + negative tracking yourself.

## Look
Swiss, high-contrast, lots of white space, 12-col grids, 14px spacing cell (14 · 21 · 28 · 35 · 56 · 70 · 98 · 126 · 168). Square corners everywhere **except** buttons/pills (fully rounded 999px). Accents are **flat, square "pixels"** in `--px` blue – no gradients, shadows, fades or rounded dots. Motion is binary (`steps()`), never eased fades. Small UI text is uppercase mono.

## Tokens (`var(--*)`)
| Token | Use |
|---|---|
| `--paper` #FFF | background |
| `--ink` #1d2126 | text, dark buttons, rules |
| `--body` #5b636c | paragraph text |
| `--muted` / `--grey-2` #8a929c | labels, meta |
| `--grey-1` #c9ced4 | inactive pixel/checkbox outline |
| `--line` | 1px hairlines (`border-top:1px solid var(--line)`) |
| `--tint` #f1f4f7 | section panels, ghost buttons, image slots |
| `--deep` #4a525c | dark surfaces |
| `--accent` #8fd0ff / `--accent-2` #d4ecff | hover fill, highlights, selection |
| `--px` / `--blue` #5aa9e6 | the pixel colour (dots, checks, progress) |
| `--sans`, `--mono` | font stacks |

## Classes
| Family | Classes |
|---|---|
| Layout | `wrap`, `split` > `split-grid` > `split-head` (cols 1–4) + `split-body` (cols 6–12); `hero-grid` > `hero-title` + `hero-side`; `cards` (3-col) / `cards cards-2` |
| Type | `label` (10px mono uppercase muted), `mono`, `muted`, `hero-title`, `statement`, `cta-title`, `flow-head` (label + h2 + p) |
| Actions | `btn` (dark pill) · `btn ghost` (tint) · `btn btn-lg`; optional leading `<span class="btn-dot"></span>` |
| Tags | `pills` > `pill` · `pill blue` · `pill dark` |
| Content | `card` > `card-art` + h3 + p; `offer` (2-col list, ink rule on top); `phases` (label/text rows); `steps` (li > `.dot` + `.label` + p); `arrows`; `hero-facts` (+ `pulse`) |
| Interactive | `tabs` > `button[aria-selected]`; `finder-box`; `pains` > `label > input + span` (pixel checkbox); `other` input; `faq` > `details > summary + p` |
| Sections | `hero-copy`, `intro`, `finder`, `flow`, `join`, `cta` (+ `cta-row`, `cta-note`), `foot`, `page`, `legal` |

## Example
```html
<section class="split"><div class="wrap split-grid">
  <header class="split-head"><span class="label">02 · Ablauf</span><h2>Vom Gespräch zum Pilot</h2></header>
  <div class="split-body">
    <ul class="phases">
      <li><span class="label">Woche 1</span><p>Erstgespräch vor Ort, <em>kostenlos</em></p></li>
      <li><span class="label">Woche 2–5</span><p>Prototyp im echten Betrieb</p></li>
    </ul>
    <div class="pills"><span class="pill blue">Handwerk</span><span class="pill">Pflege</span></div>
    <a class="btn" href="#kontakt"><span class="btn-dot"></span>Erstgespräch vereinbaren</a>
  </div>
</div></section>
```
