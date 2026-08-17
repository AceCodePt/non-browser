/**
 * Property-coverage audit (visibility only — never changes what makeStyle
 * computes). makeStyle registers every declared-property name it looks up, and
 * the audit partitions a declaration block's declared properties into
 * recognized (the engine consumed them) vs ignored (never looked up, so an
 * unsupported, misspelled, or out-of-scope property is silently dropped with
 * no parity signal). The engine's own property table is the source of truth:
 * this registry is derived from makeStyle's lookups, never a hand-maintained
 * list. See docs/ledgers/property-coverage.md.
 */

const recognized = new Set<string>();

/** Clear the registry — call before a render pass the audit will snapshot. */
export function resetRecognizedProperties(): void {
  recognized.clear();
}

/** Record that makeStyle looked up declared property `name`. */
export function registerRecognizedProperty(name: string): void {
  recognized.add(name);
}

/** Snapshot of every declared-property name makeStyle has looked up. */
export function recognizedProperties(): ReadonlySet<string> {
  return new Set(recognized);
}

export interface PropertyAudit {
  /** declared property names makeStyle consumes (in makeStyle's table). */
  recognized: string[];
  /** declared property names makeStyle never looks up (silently dropped). */
  ignored: string[];
}

/**
 * Partition a declaration block's declared property names into recognized vs
 * ignored against the registry. `decls` may be any iterable of objects carrying
 * a `property` name (Declaration or a plain { property }).
 */
export function auditDeclarationBlock(decls: readonly { property: string }[]): PropertyAudit {
  const rec = new Set<string>();
  const ign = new Set<string>();
  for (const d of decls) {
    (recognized.has(d.property) ? rec : ign).add(d.property);
  }
  return { recognized: [...rec].sort(), ignored: [...ign].sort() };
}
