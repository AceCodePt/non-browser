/**
 * parse5 type aliases — v7 exposes element/text nodes under the
 * DefaultTreeAdapterTypes namespace.
 */
import type { DefaultTreeAdapterTypes } from 'parse5';

export type P5Element = DefaultTreeAdapterTypes.Element;
export type P5Text = DefaultTreeAdapterTypes.TextNode;

function isNamedNode(n: unknown, name: string): boolean {
  return typeof n === 'object' && n !== null && (n as { nodeName: string }).nodeName === name;
}

export function isTextNode(n: unknown): n is P5Text {
  return isNamedNode(n, '#text');
}

export function isCommentNode(n: unknown): boolean {
  return isNamedNode(n, '#comment');
}

export function isElementNode(n: unknown): n is P5Element {
  return !isTextNode(n) && !isCommentNode(n);
}
