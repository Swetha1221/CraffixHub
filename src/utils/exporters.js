// Pure client-side exporters for PDF (.pdf), Excel (.xlsx), and Word (.docx)

const textEncoder = new TextEncoder();

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// CRC-32 table for standard ZIP archives (.xlsx & .docx)
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function buildZipBytes(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = textEncoder.encode(entry.name);
    const dataBytes = entry.data instanceof Uint8Array ? entry.data : textEncoder.encode(String(entry.data));
    const crc = crc32(dataBytes);
    const size = dataBytes.length;

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true);
    lv.setUint16(8, 0, true); // STORE
    lv.setUint16(10, 0, true);
    lv.setUint16(12, 0x5421, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);

    localParts.push(localHeader, dataBytes);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(centralHeader.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0x5421, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);

    centralParts.push(centralHeader);
    offset += localHeader.length + dataBytes.length;
  }

  const centralSize = centralParts.reduce((s, p) => s + p.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  const totalLen = offset + centralSize + eocd.length;
  const out = new Uint8Array(totalLen);
  let pos = 0;
  for (const part of localParts) {
    out.set(part, pos);
    pos += part.length;
  }
  for (const part of centralParts) {
    out.set(part, pos);
    pos += part.length;
  }
  out.set(eocd, pos);
  return out;
}

function normalizeRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { headers: ['Info'], data: [['No records available']] };
  }
  const headers = Object.keys(rows[0]);
  const data = rows.map((row) => headers.map((h) => String(row[h] ?? '')));
  return { headers, data };
}

function columnLetter(colIndex) {
  let n = colIndex + 1;
  let letters = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

/**
 * Generate a multi-page PDF (.pdf) blob and trigger download.
 */
export function buildPdfBlob(title, rows, subtitle = '') {
  const { headers, data } = normalizeRows(rows);
  const clean = (s) =>
    String(s ?? '')
      .replace(/[^\x20-\x7E]/g, ' ')
      .replace(/[()\\]/g, '')
      .trim();

  const lines = [
    { text: clean(title), size: 15 },
    { text: clean(subtitle || `Generated: ${new Date().toLocaleString('en-IN')}`), size: 9 },
    { text: '------------------------------------------------------------------------------------------------', size: 9 },
    { text: clean(headers.join('  |  ')).slice(0, 102), size: 9 },
    { text: '------------------------------------------------------------------------------------------------', size: 9 },
  ];

  for (const row of data) {
    const line = clean(row.join('  |  '));
    if (line.length <= 104) {
      lines.push({ text: line, size: 8.5 });
    } else {
      for (let i = 0; i < line.length; i += 104) {
        lines.push({ text: line.slice(i, i + 104), size: 8.5 });
      }
    }
  }

  const linesPerPage = 44;
  const pages = [];
  for (let i = 0; i < lines.length; i += linesPerPage) {
    pages.push(lines.slice(i, i + linesPerPage));
  }
  if (pages.length === 0) pages.push([{ text: clean(title), size: 14 }]);

  // Build PDF objects: 1=Catalog, 2=Pages, 3=Font, then per-page [PageObj, StreamObj]
  const objects = [];
  const pageObjIds = [];
  let nextId = 4;

  for (const pageLines of pages) {
    const pageObjId = nextId++;
    const contentObjId = nextId++;
    pageObjIds.push(pageObjId);

    const ops = pageLines
      .map((l, idx) => `BT /F1 ${l.size} Tf 40 ${750 - idx * 15} Td (${l.text}) Tj ET`)
      .join('\n');

    objects.push({
      id: pageObjId,
      body: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentObjId} 0 R /Resources << /Font << /F1 3 0 R >> >> >>`,
    });
    objects.push({
      id: contentObjId,
      body: `<< /Length ${ops.length} >>\nstream\n${ops}\nendstream`,
    });
  }

  const allObjects = [
    { id: 1, body: '<< /Type /Catalog /Pages 2 0 R >>' },
    { id: 2, body: `<< /Type /Pages /Kids [${pageObjIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageObjIds.length} >>` },
    { id: 3, body: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>' },
    ...objects,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const obj of allObjects) {
    offsets[obj.id] = pdf.length;
    pdf += `${obj.id} 0 obj\n${obj.body}\nendobj\n`;
  }
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${allObjects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= allObjects.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer << /Size ${allObjects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new Blob([pdf], { type: 'application/pdf' });
}

export function exportToPdf(filename, title, rows, subtitle = '') {
  const blob = buildPdfBlob(title, rows, subtitle);
  downloadBlob(blob, filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}

/**
 * Generate a real Office Open XML Excel (.xlsx) workbook blob and trigger download.
 */
export function buildXlsxBlob(sheetName, rows) {
  const { headers, data } = normalizeRows(rows);
  const safeSheet = escapeXml(String(sheetName || 'Report').slice(0, 31));

  const buildRowXml = (cells, rowNum, isHeader = false) => {
    const cellXml = cells
      .map((val, colIdx) => {
        const ref = `${columnLetter(colIdx)}${rowNum}`;
        const styleAttr = isHeader ? ' s="1"' : '';
        const num = Number(val);
        const isPureNumber = val !== '' && !Number.isNaN(num) && /^-?\d+(\.\d+)?$/.test(String(val).trim());
        if (!isHeader && isPureNumber) {
          return `<c r="${ref}"${styleAttr}><v>${num}</v></c>`;
        }
        return `<c r="${ref}" t="inlineStr"${styleAttr}><is><t>${escapeXml(val)}</t></is></c>`;
      })
      .join('');
    return `<row r="${rowNum}">${cellXml}</row>`;
  };

  const sheetRows = [
    buildRowXml(headers, 1, true),
    ...data.map((r, i) => buildRowXml(r, i + 2, false)),
  ].join('');

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="${safeSheet}" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;

  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><sz val="11"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF0A192F"/></patternFill></fill>
  </fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="2">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
  </cellXfs>
</styleSheet>`;

  const worksheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${sheetRows}</sheetData>
</worksheet>`;

  const zip = buildZipBytes([
    { name: '[Content_Types].xml', data: contentTypes },
    { name: '_rels/.rels', data: rels },
    { name: 'xl/workbook.xml', data: workbook },
    { name: 'xl/_rels/workbook.xml.rels', data: workbookRels },
    { name: 'xl/styles.xml', data: styles },
    { name: 'xl/worksheets/sheet1.xml', data: worksheet },
  ]);

  return new Blob([zip], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

export function exportToXlsx(filename, sheetName, rows) {
  const blob = buildXlsxBlob(sheetName, rows);
  downloadBlob(blob, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}

/**
 * Generate a real Office Open XML Word (.docx) document blob and trigger download.
 */
export function buildDocxBlob(title, rows, subtitle = '') {
  const { headers, data } = normalizeRows(rows);

  const headerCells = headers
    .map(
      (h) => `<w:tc>
        <w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="0A192F"/></w:tcPr>
        <w:p><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/><w:sz w:val="20"/></w:rPr><w:t>${escapeXml(h)}</w:t></w:r></w:p>
      </w:tc>`
    )
    .join('');

  const dataRows = data
    .map(
      (r) => `<w:tr>${r
        .map(
          (val) => `<w:tc>
            <w:p><w:r><w:rPr><w:sz w:val="19"/></w:rPr><w:t xml:space="preserve">${escapeXml(val)}</w:t></w:r></w:p>
          </w:tc>`
        )
        .join('')}</w:tr>`
    )
    .join('');

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:r><w:rPr><w:b/><w:color w:val="0A192F"/><w:sz w:val="32"/></w:rPr><w:t>${escapeXml(title)}</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:rPr><w:color w:val="64748B"/><w:sz w:val="20"/></w:rPr><w:t>${escapeXml(subtitle || `Generated on ${new Date().toLocaleString('en-IN')}`)}</w:t></w:r>
    </w:p>
    <w:tbl>
      <w:tblPr>
        <w:tblW w:w="0" w:type="auto"/>
        <w:tblBorders>
          <w:top w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
          <w:left w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
          <w:bottom w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
          <w:right w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
          <w:insideH w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>
          <w:insideV w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>
        </w:tblBorders>
      </w:tblPr>
      <w:tr>${headerCells}</w:tr>
      ${dataRows}
    </w:tbl>
    <w:sectPr/>
  </w:body>
</w:document>`;

  const zip = buildZipBytes([
    { name: '[Content_Types].xml', data: contentTypes },
    { name: '_rels/.rels', data: rels },
    { name: 'word/document.xml', data: documentXml },
  ]);

  return new Blob([zip], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}

export function exportToDocx(filename, title, rows, subtitle = '') {
  const blob = buildDocxBlob(title, rows, subtitle);
  downloadBlob(blob, filename.endsWith('.docx') ? filename : `${filename}.docx`);
}
