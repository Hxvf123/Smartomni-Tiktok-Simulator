/**
 * Minimal dependency-free PDF writer: one built-in font (Helvetica), plain text lines, one or more A6-ish pages.
 * Only ASCII is drawn (non-ASCII is transliterated to '?') because the base-14 font has no Vietnamese glyph coverage without embedding.
 */
export interface PdfPage {
  title: string;
  lines: string[];
}

const PAGE_W = 298; // A6 portrait in points
const PAGE_H = 420;

const ascii = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^\x20-\x7e]/g, '?');
const esc = (s: string): string => ascii(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

function contentStream(page: PdfPage): string {
  const ops: string[] = ['BT', '/F1 11 Tf', '14 TL', `16 ${PAGE_H - 28} Td`, `/F2 12 Tf (${esc(page.title)}) Tj`, '/F1 9 Tf', 'T*'];
  for (const line of page.lines) {
    // naive wrap at ~52 characters
    const chunks = ascii(line).match(/.{1,52}(\s|$)|\S+/g) ?? [''];
    for (const c of chunks) ops.push(`(${esc(c.trimEnd())}) Tj`, 'T*');
  }
  ops.push('ET');
  return ops.join('\n');
}

export function buildPdf(pages: PdfPage[]): Buffer {
  if (pages.length === 0) throw new Error('a PDF needs at least one page');
  // object numbering: 1 catalog, 2 pages, 3 font F1, 4 font F2, then (page, content) pairs
  const objects: string[] = [];
  const pageObjIds: number[] = [];
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>';
  let next = 5;
  for (const page of pages) {
    const pageId = next++;
    const contentId = next++;
    pageObjIds.push(pageId);
    const stream = contentStream(page);
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`;
  }
  objects[2] = `<< /Type /Pages /Kids [${pageObjIds.map((i) => `${i} 0 R`).join(' ')}] /Count ${pages.length} >>`;

  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (let i = 1; i < objects.length; i++) {
    offsets[i] = Buffer.byteLength(out, 'latin1');
    out += `${i} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xrefAt = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < objects.length; i++) out += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}
