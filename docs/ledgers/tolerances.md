# Tolerances Ledger

Every recorded change to the parity tolerances lives here. The defaults **are** the
charter §2 values; a change is any edit that makes a layer more lenient (or
tighter) than the current version. Version numbers refer to `tolerances.json`.

## Version 2 — tiered text-region tolerance (text-mask-parity)

The layer-4 screenshot tolerance gains a documented **text-region tier**
(`layers.screenshot.text`). Text pixels are no longer blanket-masked: they are
compared under this tier, so the four-layer diff actually compares glyph
pixels. Per-pixel ΔE keeps the charter value (`<=2`); only the *exceed
allowance* within text regions is raised, because the probe
(`scripts/probe-text-mask.mjs`, `docs/ledgers/text-mask.md`) measured the two
Skia instances (Chrome's compositor vs `@napi-rs/canvas`) as **structurally
divergent** on text — different font hinting/AA — with up to 86.1% of glyph
pixels exceeding the §10 band even in glyph interiors.

| Tier | Value | Basis |
| --- | --- | --- |
| 4. Paint (non-text) | per-pixel ΔE `<=2`, `<=1%` of pixels exceeding | charter §2/§10 |
| 4. Text region | per-pixel ΔE `<=2`, `<=97%` of text pixels exceeding | probe worst combined (86.1%) + 10pp headroom |

The tier is fixed and documented, not derived per run: a regression that pushes
text divergence past 97% still fails, and every fixture's text-region mean/worst
ΔE is surfaced in the report.

## Version 1 — charter defaults (ratified)

| Layer | Tolerance | Source |
| --- | --- | --- |
| 1. Text measurement | mean `<0.01px` per string, no single string `>0.5px` | charter §2 |
| 2. Style resolution | exact string equality per property | charter §2 |
| 3. Geometry | `<=0.5px` per box dimension (x, y, width, height) | charter §2 |
| 4. Paint | per-pixel delta-E `<=2`, with `<=1%` of pixels exceeding | charter §2 |

No changes recorded.

## Implementation notes

- **Delta-E**: CIE76 (`ΔE*ab`) computed in Lab (D65), per pixel between the
  candidate buffer and the Chrome reference screenshot. A pixel *exceeds* when
  its delta-E is above the threshold; the layer passes when the fraction of
  exceeding pixels is at most the allowed percent. Masked pixels are excluded
  from the count and the denominator.
- **Masking**: a per-fixture `mask.png`; a pixel is excluded from the diff iff
  the mask pixel is opaque (alpha > 0). All other pixels stay strict.
- **Versioning**: `tolerances.json` carries `version`; bump it and add a row
  above whenever a tolerance diverges from the current default.
