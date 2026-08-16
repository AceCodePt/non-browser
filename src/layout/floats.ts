/**
 * Float placement (CSS 2.1 §9.5.1) and the formatting-context interface that
 * block-inline.ts consumes.
 *
 * A FloatManager tracks every float placed in one block formatting context and
 * answers the two questions the in-flow layout needs:
 *   - `floatIntrusion(top, bottom)`: how much of the content width a line box
 *     spanning [top, bottom) must give up on the left/right (the float's
 *     *margin* box defines the intrusion, per §9.5.1).
 *   - `lowestFloatBottom(side)`: the lowest margin-box bottom among floats on a
 *     side, used to compute clearance (§9.5.2).
 *
 * Placement follows §9.5.1: a float is placed as far left/right as possible,
 * then as high as possible — never higher than the current line position, and
 * never overlapping an earlier float's margin box.
 */

import type { P5Element } from './types.js';

export interface FormattingContext {
  readonly x: number;
  readonly width: number;
  floatIntrusion(top: number, bottom: number): { left: number; right: number };
  lowestFloatBottom(clear: 'none' | 'left' | 'right' | 'both'): number;
}

export interface PlacedFloat {
  isLeft: boolean;
  left: number;
  right: number;
  top: number;
  bottom: number;
  borderX: number;
  borderY: number;
  borderWidth: number;
  borderHeight: number;
  element: P5Element;
}

export interface FloatDimensions {
  isLeft: boolean;
  marginLeft: number;
  marginRight: number;
  marginTop: number;
  marginBottom: number;
  borderWidth: number;
  borderHeight: number;
  element: P5Element;
}

const EPS = 0.001;

export class FloatManager implements FormattingContext {
  readonly x: number;
  readonly width: number;
  floats: PlacedFloat[] = [];

  constructor(x: number, width: number) {
    this.x = x;
    this.width = width;
  }

  floatIntrusion(top: number, bottom: number): { left: number; right: number } {
    let left = 0;
    let right = 0;
    for (const f of this.floats) {
      if (f.bottom > top + EPS && f.top < bottom - EPS) {
        if (f.isLeft) left = Math.max(left, f.right - this.x);
        else right = Math.max(right, this.x + this.width - f.left);
      }
    }
    return { left, right };
  }

  lowestFloatBottom(clear: 'none' | 'left' | 'right' | 'both'): number {
    let low = -Infinity;
    for (const f of this.floats) {
      const want =
        clear === 'both' ? true : clear === 'left' ? f.isLeft : clear === 'right' ? !f.isLeft : false;
      if (want) low = Math.max(low, f.bottom);
    }
    return low;
  }

  /**
   * Place a float. `y0` is the current line position (the float may not float
   * higher than it). Returns the PlacedFloat and records it.
   */
  placeFloat(dim: FloatDimensions, y0: number): PlacedFloat {
    const w = dim.borderWidth + dim.marginLeft + dim.marginRight;
    const h = dim.borderHeight + dim.marginTop + dim.marginBottom;
    const contentRight = this.x + this.width;

    let y = y0;
    let x: number;
    for (;;) {
      if (dim.isLeft) {
        x = this.x;
        for (;;) {
          const blockers = this.floats.filter(
            (f) => f.bottom > y && f.top < y + h && f.right > x + EPS && f.left < x + w - EPS,
          );
          if (blockers.length === 0) break;
          const nx = Math.max(...blockers.map((b) => b.right));
          if (nx <= x + EPS) break;
          x = nx;
        }
      } else {
        x = contentRight - w;
        for (;;) {
          const blockers = this.floats.filter(
            (f) => f.bottom > y && f.top < y + h && f.right > x + EPS && f.left < x + w - EPS,
          );
          if (blockers.length === 0) break;
          const nx = Math.min(...blockers.map((b) => b.left));
          if (nx >= x + w - EPS) break;
          x = nx - w;
        }
      }

      if (dim.isLeft ? x + w <= contentRight + EPS : x >= this.x - EPS) {
        break;
      }
      const down = this.floats.filter(
        (f) => f.bottom > y + EPS && f.left < contentRight - EPS && f.right > this.x + EPS,
      );
      if (down.length === 0) break;
      const ny = Math.max(...down.map((d) => d.bottom));
      if (ny <= y + EPS) break;
      y = ny;
    }

    const placed: PlacedFloat = {
      isLeft: dim.isLeft,
      left: x,
      right: x + w,
      top: y,
      bottom: y + h,
      borderX: x + dim.marginLeft,
      borderY: y + dim.marginTop,
      borderWidth: dim.borderWidth,
      borderHeight: dim.borderHeight,
      element: dim.element,
    };
    this.floats.push(placed);
    return placed;
  }
}
