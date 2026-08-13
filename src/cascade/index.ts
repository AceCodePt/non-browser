/**
 * The cascade phase pipeline. Each phase owns a slice of the cascade:
 * media-queries evaluates @media/@container against the viewport input and
 * gates rule application; sibling tasks own selector matching (cascade-core),
 * custom properties, and layers/!important.
 */

export * from './media.js';
export * from './selector.js';
export * from './stylesheet.js';
export * from './phases/media-queries.js';
