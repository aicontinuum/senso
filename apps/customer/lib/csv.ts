// CSV cells that survive a spreadsheet.
//
// A CSV cell from any text. Quotes inside are doubled, as the format
// requires, so a name with a quote cannot end the cell early. A leading
// character that a spreadsheet would read as a formula (= + - @, or a
// tab or return) gets an apostrophe in front, so a sensor named
// "=HYPERLINK(...)" opens as text, not as a formula.
const FORMULA_LEAD = /^[=+\-@\t\r]/;

export function csvCell(value: string | number): string {
  const text = String(value);
  const safe = FORMULA_LEAD.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** One CSV row from its cells. */
export function csvRow(...cells: (string | number)[]): string {
  return cells.map(csvCell).join(",");
}
