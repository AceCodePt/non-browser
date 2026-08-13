# Tolerances Ledger

Every recorded change to the parity tolerances lives here. The defaults **are** the
charter §2 values; a change is any edit that makes a layer more lenient (or
tighter) than the current version. Version numbers refer to `tolerances.json`.

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
