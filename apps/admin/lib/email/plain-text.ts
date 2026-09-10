// Plain-text operational emails rendered as HTML.
//
// Ops mail is written as text: a few lines a person reads at 3 a.m. on a phone.
// The HTML part exists so mail clients do not mangle the line breaks, and it
// must escape, because parts of the body come from the database.

export function plainTextEmailHtml(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return `<pre style="font:14px/1.5 ui-monospace,monospace;white-space:pre-wrap">${escaped}</pre>`;
}
