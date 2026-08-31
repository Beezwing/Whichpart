import ExcelJS from 'exceljs';

/**
 * Column order matches Section 10 of the master spec. Keep this in sync
 * with parseImportWorkbook below — the header text is what suppliers see
 * and what we match columns back by when parsing.
 */
export const IMPORT_COLUMNS = [
  { header: 'Supplier SKU', key: 'sku', example: 'ABC-ALT-001' },
  { header: 'Product Name', key: 'name', example: 'Alternator 90A' },
  {
    header: 'Description',
    key: 'description',
    example: 'OEM-spec alternator, tested working',
  },
  { header: 'Category', key: 'category', example: 'Electrical' },
  { header: 'Subcategory', key: 'subcategory', example: 'Alternators' },
  { header: 'Brand', key: 'brand', example: 'Denso' },
  { header: 'Make', key: 'make', example: 'Toyota' },
  { header: 'Model', key: 'model', example: 'Corolla' },
  { header: 'Year From', key: 'yearFrom', example: 2013 },
  { header: 'Year To', key: 'yearTo', example: 2019 },
  { header: 'Engine', key: 'engine', example: '1NZ-FE' },
  { header: 'Engine Code', key: 'engineCode', example: '1NZ' },
  { header: 'Transmission', key: 'transmission', example: 'Automatic' },
  { header: 'OEM Part Number', key: 'oemPartNumber', example: '27060-21150' },
  {
    header: 'Manufacturer Part Number',
    key: 'manufacturerPartNumber',
    example: 'DAN594',
  },
  { header: 'Condition', key: 'condition', example: 'USED' },
  { header: 'Price', key: 'price', example: 18500 },
  { header: 'Quantity', key: 'quantity', example: 3 },
  { header: 'Location', key: 'location', example: 'Kingston Branch' },
  {
    header: 'Compatibility Notes',
    key: 'compatibilityNotes',
    example: 'Fits 1NZ-FE engines only',
  },
  {
    header: 'Photo Filename(s)',
    key: 'photoFilenames',
    example: 'ABC-ALT-001-01.jpg, ABC-ALT-001-02.jpg',
  },
] as const;

export async function generateImportTemplate(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();

  const sheet = workbook.addWorksheet('Products');
  sheet.columns = IMPORT_COLUMNS.map((col) => ({
    header: col.header,
    key: col.key,
    width: 22,
  }));
  sheet.getRow(1).font = { bold: true };
  sheet.addRow(
    Object.fromEntries(IMPORT_COLUMNS.map((c) => [c.key, c.example])),
  );

  const instructions = workbook.addWorksheet('Instructions');
  instructions.columns = [{ width: 100 }];
  const lines = [
    'How to use this template',
    '',
    '1. Fill in one row per product on the "Products" sheet. Delete the example row first.',
    '2. Supplier SKU, Price, and Quantity are YOUR data — nothing in this system, including any',
    '   AI-assisted categorization, will ever change them. What you enter is what gets published.',
    '3. Condition must be one of: NEW, USED, REFURBISHED, RECONDITIONED, OEM, AFTERMARKET.',
    "4. Location must exactly match a location name you've already created in your dashboard.",
    "5. Category/Subcategory are matched to your marketplace's categories where possible — an AI",
    "   assistant may suggest a category if yours doesn't match exactly, but it never overrides",
    '   your Price, Quantity, or SKU, and you approve or reject every suggestion yourself.',
    "6. Photos are NOT embedded in this spreadsheet. Upload them separately from each product's",
    '   page after import — the Photo Filename(s) column here is just your own reference.',
    '7. Uploading a SKU that already exists in your account UPDATES that product (including its',
    '   price and quantity) instead of creating a duplicate.',
  ];
  lines.forEach((line, i) => {
    instructions.getCell(i + 1, 1).value = line;
  });
  instructions.getCell(1, 1).font = { bold: true, size: 14 };

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export interface RawImportRow {
  rowNumber: number;
  values: Record<string, unknown>;
}

export async function parseImportWorkbook(
  buffer: Buffer,
): Promise<RawImportRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const sheet = workbook.getWorksheet('Products') ?? workbook.worksheets[0];
  if (!sheet) return [];

  const headerRow = sheet.getRow(1);
  const columnKeyByIndex = new Map<number, string>();
  headerRow.eachCell((cell, colNumber) => {
    const match = IMPORT_COLUMNS.find(
      (c) => c.header.toLowerCase() === cell.text.trim().toLowerCase(),
    );
    if (match) columnKeyByIndex.set(colNumber, match.key);
  });

  const rows: RawImportRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const values: Record<string, unknown> = {};
    let hasAnyValue = false;
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const key = columnKeyByIndex.get(colNumber);
      if (!key) return;
      values[key] = cell.value;
      hasAnyValue = true;
    });
    if (hasAnyValue) rows.push({ rowNumber, values });
  });

  return rows;
}
