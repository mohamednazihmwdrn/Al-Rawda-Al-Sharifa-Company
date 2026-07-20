import { Item, Quotation, SavedItem } from "../types";

export function getPrintUserName(displayNameOrUsername: string): string {
  const clean = displayNameOrUsername.trim();
  if (clean === "مخزن النحاس" || clean === "Nahas" || clean === "nahas" || clean.includes("النحاس") || clean.includes("جمعة") || clean.includes("السي")) {
    return "جمعة السيد";
  }
  if (clean === "مخزن النادي" || clean === "Nady" || clean === "nady" || clean.includes("النادي") || clean.includes("جعفر") || clean.includes("ضياء")) {
    return "جعفر ضياء";
  }
  if (clean === "مدير" || clean === "المدير" || clean === "Admin" || clean === "admin" || clean.includes("احمد حمدي") || clean.includes("أحمد حمدي")) {
    return "أحمد حمدي";
  }
  return clean;
}

export function getNextPrintNumber(type: "normal" | "matrix" = "normal") {
  const key = `print_counter_${type}`;
  const currentCount = localStorage.getItem(key) || "0";
  const nextCount = parseInt(currentCount) + 1;
  localStorage.setItem(key, nextCount.toString());
  return nextCount;
}

export function getCompanyInfo(): { name: string; address: string; phones: string[] } | null {
  try {
    const raw = localStorage.getItem("system_company_info");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && (parsed.name || parsed.address || parsed.phones)) {
        return {
          name: parsed.name || "",
          address: parsed.address || "",
          phones: parsed.phones ? parsed.phones.split("\n").map((p: string) => p.trim()).filter(Boolean) : []
        };
      }
    }
  } catch (e) {
    console.error(e);
  }
  return null;
}

export function getHeaderHtml(): string {
  const comp = getCompanyInfo();
  const nameHtml = comp?.name ? `🌹 ${comp.name}` : "&nbsp;";
  const addressHtml = comp?.address ? `📍 ${comp.address}` : "&nbsp;";
  const phonesHtml = comp?.phones && comp.phones.length > 0
    ? comp.phones.map(p => `<div>📞 ${p}</div>`).join("")
    : "&nbsp;";

  return `
    <div class="company-name">${nameHtml}</div>
    <div class="company-address">${addressHtml}</div>
    <div class="company-phone">${phonesHtml}</div>
  `;
}

export function getFooterHtml(type = "البيان"): string {
  const comp = getCompanyInfo();
  const companyName = comp?.name || "الروضة الشريفة";
  return `
    <p>تم تحرير هذا ${type} من ${companyName} © 2026</p>
  `;
}

export function printInvoice(items: Item[], title = "فاتورة النواقص", warehouseName: string | null = null, currentUserDisplay = "غير معروف") {
  if (!items || items.length === 0) {
    alert("⚠️ لا توجد بنود للطباعة");
    return;
  }

  const d = new Date();
  const dateStr = d.toLocaleDateString("ar-EG");
  const timeStr = d.toLocaleTimeString("ar-EG");
  const printNum = getNextPrintNumber("normal");
  const serialNumber = String(printNum).padStart(3, "0");

  // Split items into Nahas (Copper) and Nady (Club) Warehouses
  const nahasItems: Item[] = [];
  const nadyItems: Item[] = [];

  items.forEach(item => {
    const wh = (item.warehouse || "").trim();
    if (
      wh.includes("النحاس") ||
      wh.toLowerCase().includes("nahas") ||
      wh.includes("جمعة") ||
      wh.includes("Nahas")
    ) {
      nahasItems.push(item);
    } else if (
      wh.includes("النادي") ||
      wh.toLowerCase().includes("nady") ||
      wh.includes("جعفر") ||
      wh.includes("Nady")
    ) {
      nadyItems.push(item);
    } else {
      // Distribute custom warehouses or manager warehouse items evenly to keep columns balanced
      if (nahasItems.length <= nadyItems.length) {
        nahasItems.push(item);
      } else {
        nadyItems.push(item);
      }
    }
  });

  // Split logic: if a warehouse has more than 50 items, split into 2 columns (or "أ" and "ب")
  const splitIntoColumns = (itemsList: Item[], threshold = 50) => {
    if (itemsList.length > threshold) {
      const half = Math.ceil(itemsList.length / 2);
      return [itemsList.slice(0, half), itemsList.slice(half)];
    }
    return [itemsList];
  };

  const nahasCols = splitIntoColumns(nahasItems, 50);
  const nadyCols = splitIntoColumns(nadyItems, 50);

  const columnsToRender: { title: string; items: Item[]; startIndex: number }[] = [];

  nahasCols.forEach((colItems, i) => {
    if (colItems.length > 0) {
      const title = nahasCols.length > 1 ? `مخزن النحاس (${i === 0 ? "أ" : "ب"})` : "مخزن النحاس";
      const startIndex = i === 1 ? nahasCols[0].length : 0;
      columnsToRender.push({ title, items: colItems, startIndex });
    }
  });

  nadyCols.forEach((colItems, i) => {
    if (colItems.length > 0) {
      const title = nadyCols.length > 1 ? `مخزن النادي (${i === 0 ? "أ" : "ب"})` : "مخزن النادي";
      const startIndex = i === 1 ? nadyCols[0].length : 0;
      columnsToRender.push({ title, items: colItems, startIndex });
    }
  });

  let maxItemsInAnyCol = 0;
  columnsToRender.forEach(col => {
    if (col.items.length > maxItemsInAnyCol) {
      maxItemsInAnyCol = col.items.length;
    }
  });
  if (maxItemsInAnyCol === 0) maxItemsInAnyCol = 1;

  // Professional, highly readable sizing for A4 printing (portrait)
  let normalFontSize = 12.0;
  let normalCellPadding = "4px 6px";
  let normalHeaderPadding = "5px 6px";
  let normalHeaderBottomMargin = "6px";
  let normalBodyPadding = "6px";
  let normalHeaderFontSize = 14;
  let normalTitleFontSize = 13;
  let normalSubTitleFontSize = 10;
  let normalLogoFontSize = 9.5;
  let normalPageMargin = "10mm"; // 10mm as requested
  let checkboxSize = 12;

  if (maxItemsInAnyCol > 50) {
    // Elegant Multi-page flow style, font is not too small!
    normalFontSize = 11.5;
    normalCellPadding = "2.5px 4px";
    normalHeaderPadding = "3px 4px";
    normalHeaderBottomMargin = "4px";
    normalBodyPadding = "4px";
    normalHeaderFontSize = 13;
    normalTitleFontSize = 12;
    normalSubTitleFontSize = 9.5;
    normalLogoFontSize = 9.0;
    normalPageMargin = "10mm";
    checkboxSize = 11;
  } else if (maxItemsInAnyCol > 35) {
    normalFontSize = 11.8;
    normalCellPadding = "3px 5px";
    normalHeaderPadding = "4px 5px";
    normalHeaderBottomMargin = "5px";
    normalBodyPadding = "5px";
    normalHeaderFontSize = 13.5;
    normalTitleFontSize = 12.5;
    normalSubTitleFontSize = 9.8;
    normalLogoFontSize = 9.2;
    normalPageMargin = "10mm";
    checkboxSize = 11.5;
  } else if (maxItemsInAnyCol > 15) {
    normalFontSize = 12.0;
    normalCellPadding = "3.5px 5.5px";
    normalHeaderPadding = "4.5px 5.5px";
    normalHeaderBottomMargin = "6px";
    normalBodyPadding = "5.5px";
    normalHeaderFontSize = 14;
    normalTitleFontSize = 13;
    normalSubTitleFontSize = 10;
    normalLogoFontSize = 9.5;
    normalPageMargin = "10mm";
    checkboxSize = 12;
  }

  const activeWhs: string[] = [];
  if (nahasItems.length > 0) activeWhs.push("النحاس");
  if (nadyItems.length > 0) activeWhs.push("النادي");
  const sharedWhsStr = activeWhs.join(" - ") || "لا يوجد";

  let columnsHtml = "";
  columnsToRender.forEach(col => {
    let rowsHtml = "";
    col.items.forEach((item, index) => {
      const warehouseTag = item.warehouse || col.title;
      const dupTag = item.duplicateNote ? ` <span class="dup-badge">🔄 مكرر</span>` : '';
      const noteTag = item.note && item.note !== "-" ? ` <span class="item-note">(${item.note})</span>` : '';
      const displayTag = !warehouseTag.includes("النحاس") && !warehouseTag.includes("النادي") ? ` <span class="warehouse-tag">${warehouseTag}</span>` : '';

      const isPartial = item.hasPartialReceipt;
      const partialPrintHtml = isPartial ? `
        <div style="font-size: ${normalFontSize - 2}px; font-weight: 800; color: #b00; margin-top: 1px;">
          (مطلوب: ${item.originalQty || item.company} | مستلم: ${item.receivedQty || "0"} | متبقي: ${item.remainingQty || "0"})
        </div>
      ` : '';

      rowsHtml += `
        <tr>
          <td style="width: 6%; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${index + 1 + col.startIndex}</td>
          <td style="width: 11%; text-align: center; font-weight: 900; color: #000000; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${isPartial ? (item.remainingQty || "0") : (item.company || "1")}</td>
          <td style="width: 77%; text-align: right; font-weight: 700; padding: 4px 6px; white-space: normal; word-break: break-word; line-height: 1.3;" title="${item.fixedName}">
            ${item.fixedName}${displayTag}${dupTag}${noteTag}${partialPrintHtml}
          </td>
          <td style="width: 6%; text-align: center; padding: 1px 0; white-space: nowrap;">
            <span class="print-checkbox"></span>
          </td>
        </tr>
      `;
    });

    if (col.items.length === 0) {
      rowsHtml = `
        <tr>
          <td colspan="4" style="text-align: center; color: #888; font-style: italic; padding: 10px 0;">لا توجد نواقص</td>
        </tr>
      `;
    }

    columnsHtml += `
      <div class="print-column">
          <div class="column-header">${col.title}</div>
          <table>
              <thead>
                  <tr>
                      <th style="width: 6%; text-align: center; white-space: nowrap;">#</th>
                      <th style="width: 11%; text-align: center; white-space: nowrap;">العدد</th>
                      <th style="width: 77%; text-align: right; padding-right: 4px; white-space: nowrap;">اسم الصنف والبيان</th>
                      <th style="width: 6%; text-align: center; white-space: nowrap;">✓</th>
                  </tr>
              </thead>
              <tbody>
                  ${rowsHtml}
              </tbody>
          </table>
      </div>
    `;
  });

  const html = `
      <html dir="rtl">
      <head>
          <meta charset="UTF-8">
          <title>${title} - ${serialNumber}</title>
          <style>
              * { 
                  font-family: 'Arial', 'Segoe UI', sans-serif !important; 
                  -webkit-print-color-adjust: exact !important; 
                  print-color-adjust: exact !important;
                  box-sizing: border-box !important;
              }
              body { 
                  padding: ${normalBodyPadding} !important; 
                  background: white; 
                  margin: 0; 
                  direction: rtl; 
                  color: #000000; 
              }
              .invoice-print { 
                  max-width: 100%; 
                  margin: 0 auto; 
                  display: flex;
                  flex-direction: column;
                  height: auto;
              }
              .header {
                  display: flex;
                  justify-content: space-between;
                  align-items: flex-start;
                  border-bottom: 2.5px solid #000000;
                  padding-bottom: 2px;
                  margin-bottom: ${normalHeaderBottomMargin};
              }
              .header .right { text-align: right; }
              .header .center { text-align: center; flex: 1; }
              .header .left { text-align: left; }
              .company-name {
                  font-size: ${normalHeaderFontSize + 3}px;
                  font-weight: 900;
                  color: #000000;
                  letter-spacing: 0.5px;
                  line-height: 1.1;
              }
              .company-address { font-size: ${normalLogoFontSize}px; color: #111111; font-weight: 700; margin-top: 2px; }
              .company-phone { font-size: ${normalLogoFontSize - 1}px; color: #111111; font-weight: 700; margin-top: 1px; }
              .title-text {
                  font-size: ${normalTitleFontSize + 1}px;
                  font-weight: 900;
                  color: #000000;
                  line-height: 1.1;
              }
              .title-text .serial {
                  font-size: ${normalSubTitleFontSize}px;
                  font-weight: 800;
                  color: #000000;
                  background: #ffffff;
                  padding: 1px 10px;
                  border: 1.5px solid #000000;
                  border-radius: 4px;
                  display: inline-block;
                  margin-top: 2px;
              }
              .date-time { font-size: ${normalFontSize}px; color: #000000; font-weight: 700; line-height: 1.2; }
              
              .side-by-side-container {
                  display: flex;
                  gap: 12px;
                  width: 100%;
                  margin-bottom: 4px;
              }
              .print-column {
                  flex: 1;
                  display: flex;
                  flex-direction: column;
                  min-width: 48%;
                  margin-right: 0;
              }
              .column-header {
                  text-align: center;
                  font-size: ${normalFontSize + 1}px;
                  font-weight: 900;
                  background: #ffffff;
                  color: #000000;
                  padding: 3px;
                  border-radius: 4px;
                  border: 1.5px solid #000000;
                  margin-bottom: 4px;
                  white-space: nowrap;
                  text-overflow: ellipsis;
                  overflow: hidden;
              }
              
              table {
                  width: 100%;
                  border-collapse: collapse;
                  font-size: ${normalFontSize}px;
                  border: 1.5px solid #000000;
                  table-layout: fixed;
              }
              table th {
                  background: #ffffff !important;
                  color: #000000 !important;
                  border: 1.5px solid #000000;
                  padding: ${normalHeaderPadding};
                  text-align: center;
                  font-weight: 800;
                  font-size: ${normalFontSize + 0.5}px;
              }
              table td {
                  border: 1.5px solid #000000;
                  padding: ${normalCellPadding};
                  font-size: ${normalFontSize}px;
                  background: white !important;
                  color: #000000 !important;
                  font-weight: 700;
                  line-height: 1.25;
              }
              tr {
                  page-break-inside: avoid !important;
                  break-inside: avoid !important;
              }
              
              .print-checkbox {
                  display: inline-block;
                  width: ${checkboxSize}px;
                  height: ${checkboxSize}px;
                  border: 1.5px solid #000000;
                  border-radius: 2px;
                  vertical-align: middle;
                  background: #ffffff;
              }
              
              .warehouse-tag {
                  font-size: ${normalFontSize - 1.8}px;
                  color: #000000;
                  background: #ffffff;
                  padding: 0.1px 1.5px;
                  border-radius: 2px;
                  border: 1px solid #000000;
                  font-weight: 800;
                  display: inline-block;
                  margin-right: 2px;
              }
              .dup-badge {
                  font-size: ${normalFontSize - 1.8}px;
                  font-weight: bold;
                  color: #b00;
                  margin-right: 2px;
              }
              .item-note {
                  font-size: ${normalFontSize - 1.5}px;
                  color: #000000;
                  font-weight: normal;
                  font-style: italic;
                  margin-right: 2px;
              }
              
              .footer {
                  border-top: 2.5px solid #000000;
                  padding-top: 2px;
                  text-align: center;
                  color: #000000;
                  font-size: ${normalFontSize - 0.5}px;
                  font-weight: 700;
              }
              .footer strong { color: #000000; font-weight: 800; }
              .user-footer {
                  font-size: ${normalFontSize}px;
                  font-weight: 800;
                  color: #000000;
              }
              .copyright { font-weight: 700 !important; font-size: 10px !important; color: #000000 !important; }
              
              @media print {
                  button, .no-print, .btn, .sidebar, input, select {
                      display: none !important;
                  }
                  body { 
                      padding: 0 !important; 
                      margin: 0 !important; 
                      color: #000000 !important; 
                      background: #ffffff !important;
                      height: auto !important;
                      overflow: visible !important;
                  }
                  .side-by-side-container {
                      display: flex !important;
                      flex-direction: row !important;
                      gap: 12px !important;
                      overflow: visible !important;
                      page-break-inside: auto !important;
                      break-inside: auto !important;
                  }
                  .print-column {
                      flex: 1 !important;
                      page-break-inside: auto !important;
                      break-inside: auto !important;
                  }
                  table {
                      page-break-inside: auto !important;
                      break-inside: auto !important;
                  }
                  tr {
                      page-break-inside: avoid !important;
                      break-inside: avoid !important;
                  }
                  table th { background: #ffffff !important; color: #000000 !important; }
                  table td { color: #000000 !important; font-weight: 700; }
                  .header { border-bottom: 2.5px solid #000000 !important; }
                  .footer { border-top: 2.5px solid #000000 !important; }
                  thead { display: table-header-group !important; }
                  @page { 
                      size: A4 portrait !important; 
                      margin: ${normalPageMargin} !important; 
                  }
                  .warehouse-tag { background: #ffffff !important; border: 1px solid #000000 !important; }
              }
          </style>
      </head>
      <body>
          <div class="invoice-print">
              <div class="header">
                  <div class="right">
                      ${getHeaderHtml()}
                  </div>
                  <div class="center">
                      <div class="title-text">📋 ${title}<br><span class="serial">بيان رقم ${serialNumber}</span></div>
                      <div style="font-size:${normalFontSize + 0.8}px; font-weight:bold; margin-top:4px;">المخازن المشتركة: ${sharedWhsStr}</div>
                  </div>
                  <div class="left">
                      <div class="date-time">📅 التاريخ: ${dateStr}</div>
                      <div class="date-time">🕐 الوقت: ${timeStr}</div>
                  </div>
              </div>
 
              <!-- Columns Container -->
              <div class="side-by-side-container">
                  ${columnsHtml}
              </div>
 
              <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;padding: 2px 0; border-top: 2px dashed #000; margin-top:2px;">
                  <div style="font-size:${normalFontSize}px;color:#000;font-weight:800;">
                      إجمالي البنود المشترك: <span style="font-size:${normalFontSize+1.5}px;text-decoration:underline;">${items.length}</span> (نحاس: ${nahasItems.length} | نادي: ${nadyItems.length})
                  </div>
                  <div class="user-footer">👤 محرر الطلب: ${getPrintUserName(currentUserDisplay)}</div>
              </div>

              <div class="footer">
                  ${getFooterHtml("البيان")}
                  <p style="margin: 2px 0;"><span class="copyright">حقوق الملكية: Mohamed Nazih | 📱 01029190615</span></p>
              </div>
          </div>
          <script>
              window.onload = function() { window.print(); }
          </script>
      </body>
      </html>
  `;

  const win = window.open("", "_blank", "width=1200,height=900");
  if (win) {
    win.document.write(html);
    win.document.close();
    win.focus();
  }
}

export function printMatrix(
  items: Item[],
  title = "بيان النواقص المركزية",
  warehouseName: string | null = null,
  savedItems?: SavedItem[],
  currentUserDisplay = "المدير"
) {
  if (!items || items.length === 0) {
    alert("⚠️ لا توجد بنود للطباعة");
    return;
  }

  const d = new Date();
  const dateStr = d.toLocaleDateString("ar-EG");
  const timeStr = d.toLocaleTimeString("ar-EG");
  const printNum = getNextPrintNumber("matrix");
  const serialNumber = String(printNum).padStart(3, "0");

  // Split items into Nahas (Copper) and Nady (Club) Warehouses
  const nahasItems: Item[] = [];
  const nadyItems: Item[] = [];

  items.forEach(item => {
    const wh = (item.warehouse || "").trim();
    if (
      wh.includes("النحاس") ||
      wh.toLowerCase().includes("nahas") ||
      wh.includes("جمعة") ||
      wh.includes("Nahas")
    ) {
      nahasItems.push(item);
    } else if (
      wh.includes("النادي") ||
      wh.toLowerCase().includes("nady") ||
      wh.includes("جعفر") ||
      wh.includes("Nady")
    ) {
      nadyItems.push(item);
    } else {
      // Distribute custom warehouses or manager warehouse items evenly to keep columns balanced
      if (nahasItems.length <= nadyItems.length) {
        nahasItems.push(item);
      } else {
        nadyItems.push(item);
      }
    }
  });

  // Matrix splits EACH warehouse into exactly 2 columns, giving 4 columns total!
  const splitIntoTwoColumns = (itemsList: Item[]) => {
    const half = Math.ceil(itemsList.length / 2);
    return [itemsList.slice(0, half), itemsList.slice(half)];
  };

  const [nahasColA, nahasColB] = splitIntoTwoColumns(nahasItems);
  const [nadyColA, nadyColB] = splitIntoTwoColumns(nadyItems);

  const columnsToRender = [
    { title: "مخزن النحاس (أ)", items: nahasColA, startIndex: 0 },
    { title: "مخزن النحاس (ب)", items: nahasColB, startIndex: nahasColA.length },
    { title: "مخزن النادي (أ)", items: nadyColA, startIndex: 0 },
    { title: "مخزن النادي (ب)", items: nadyColB, startIndex: nadyColA.length }
  ];

  let maxItemsInAnyCol = 0;
  columnsToRender.forEach(col => {
    if (col.items.length > maxItemsInAnyCol) {
      maxItemsInAnyCol = col.items.length;
    }
  });
  if (maxItemsInAnyCol === 0) maxItemsInAnyCol = 1;

  // Professional, highly readable sizing for A4 matrix printing (landscape)
  let matrixFontSize = 11.0;
  let matrixCellPadding = "3px 4.5px";
  let matrixHeaderPadding = "4px 4.5px";
  let matrixHeaderBottomMargin = "5px";
  let matrixBodyPadding = "5px";
  let matrixHeaderFontSize = 14;
  let matrixTitleFontSize = 13;
  let matrixSubTitleFontSize = 10;
  let matrixLogoFontSize = 9.5;
  let matrixPageMargin = "10mm"; // 10mm as requested
  let checkboxSize = 11;

  if (maxItemsInAnyCol > 38) {
    matrixFontSize = 10.0;
    matrixCellPadding = "2px 3px";
    matrixHeaderPadding = "2.5px 3px";
    matrixHeaderBottomMargin = "3px";
    matrixBodyPadding = "3px";
    matrixHeaderFontSize = 12;
    matrixTitleFontSize = 11.0;
    matrixSubTitleFontSize = 8.5;
    matrixLogoFontSize = 8.0;
    matrixPageMargin = "10mm";
    checkboxSize = 10;
  } else if (maxItemsInAnyCol > 25) {
    matrixFontSize = 10.5;
    matrixCellPadding = "2.5px 3.5px";
    matrixHeaderPadding = "3px 3.5px";
    matrixHeaderBottomMargin = "4px";
    matrixBodyPadding = "4px";
    matrixHeaderFontSize = 13;
    matrixTitleFontSize = 12.0;
    matrixSubTitleFontSize = 9.0;
    matrixLogoFontSize = 8.8;
    matrixPageMargin = "10mm";
    checkboxSize = 10.5;
  } else if (maxItemsInAnyCol > 15) {
    matrixFontSize = 11.0;
    matrixCellPadding = "3px 4px";
    matrixHeaderPadding = "3.5px 4px";
    matrixHeaderBottomMargin = "4px";
    matrixBodyPadding = "4.5px";
    matrixHeaderFontSize = 14;
    matrixTitleFontSize = 12.5;
    matrixSubTitleFontSize = 9.5;
    matrixLogoFontSize = 9.2;
    matrixPageMargin = "10mm";
    checkboxSize = 11;
  }

  const activeWhs: string[] = [];
  if (nahasItems.length > 0) activeWhs.push("النحاس");
  if (nadyItems.length > 0) activeWhs.push("النادي");
  const sharedWhsStr = activeWhs.join(" - ") || "لا يوجد";

  let columnsHtml = "";
  columnsToRender.forEach(col => {
    let rowsHtml = "";
    col.items.forEach((item, index) => {
      const warehouseTag = item.warehouse || col.title;
      const dupTag = item.duplicateNote ? ` <span class="dup-badge">🔄 مكرر</span>` : '';
      const noteTag = item.note && item.note !== "-" ? ` <span class="item-note">(${item.note})</span>` : '';
      const displayTag = !warehouseTag.includes("النحاس") && !warehouseTag.includes("النادي") ? ` <span class="warehouse-tag">${warehouseTag}</span>` : '';

      const isPartial = item.hasPartialReceipt;
      const partialPrintHtml = isPartial ? `
        <div style="font-size: ${matrixFontSize - 2}px; font-weight: 800; color: #b00; margin-top: 1px;">
          (مطلوب: ${item.originalQty || item.company} | مستلم: ${item.receivedQty || "0"} | متبقي: ${item.remainingQty || "0"})
        </div>
      ` : '';

      rowsHtml += `
        <tr>
          <td style="width: 10%; text-align: center;">${index + 1 + col.startIndex}</td>
          <td style="width: 15%; text-align: center; font-weight: 800; color: #8b6b4d;">${isPartial ? (item.remainingQty || "0") : (item.company || "1")}</td>
          <td style="width: 65%; text-align: right; font-weight: 700; padding: 4px 6px; white-space: normal; word-break: break-word; line-height: 1.3;" title="${item.fixedName}">
            ${item.fixedName}${displayTag}${dupTag}${noteTag}${partialPrintHtml}
          </td>
          <td style="width: 10%; text-align: center; padding: 1px 0;">
            <span class="print-checkbox"></span>
          </td>
        </tr>
      `;
    });

    if (col.items.length === 0) {
      rowsHtml = `
        <tr>
          <td colspan="4" style="text-align: center; color: #888; font-style: italic; padding: 10px 0;">لا توجد نواقص</td>
        </tr>
      `;
    }

    columnsHtml += `
      <div class="print-column">
          <div class="column-header">${col.title}</div>
          <table>
              <thead>
                  <tr>
                      <th style="width: 10%;">#</th>
                      <th style="width: 15%;">العدد</th>
                      <th style="width: 65%;">اسم الصنف والبيان</th>
                      <th style="width: 10%;">✓</th>
                  </tr>
              </thead>
              <tbody>
                  ${rowsHtml}
              </tbody>
          </table>
      </div>
    `;
  });

  const html = `
      <html dir="rtl">
      <head>
          <meta charset="UTF-8">
          <title>${title} - مصفوفة ${serialNumber}</title>
          <style>
              * { 
                  font-family: 'Arial', 'Segoe UI', sans-serif !important; 
                  -webkit-print-color-adjust: exact !important; 
                  print-color-adjust: exact !important;
                  box-sizing: border-box !important;
              }
              body { 
                  padding: ${matrixBodyPadding} !important; 
                  background: white; 
                  margin: 0; 
                  direction: rtl; 
                  color: #000000; 
              }
              .invoice-print { 
                  max-width: 100%; 
                  margin: 0 auto; 
                  display: flex;
                  flex-direction: column;
                  height: auto;
              }
              .header {
                  display: flex;
                  justify-content: space-between;
                  align-items: flex-start;
                  border-bottom: 3px solid #000000;
                  padding-bottom: 4px;
                  margin-bottom: ${matrixHeaderBottomMargin};
              }
              .header .right { text-align: right; }
              .header .center { text-align: center; flex: 1; }
              .header .left { text-align: left; }
              .company-name {
                  font-size: ${matrixHeaderFontSize + 4}px;
                  font-weight: 900;
                  color: #000000;
                  letter-spacing: 0.5px;
                  line-height: 1.2;
              }
              .company-address { font-size: ${matrixLogoFontSize}px; color: #111111; font-weight: 700; margin-top: 3px; }
              .company-phone { font-size: ${matrixLogoFontSize - 1}px; color: #111111; font-weight: 700; margin-top: 2px; }
              .title-text {
                  font-size: ${matrixTitleFontSize + 1}px;
                  font-weight: 900;
                  color: #000000;
                  line-height: 1.2;
              }
              .title-text .serial {
                  font-size: ${matrixSubTitleFontSize}px;
                  font-weight: 800;
                  color: #000000;
                  background: #ffffff;
                  padding: 1px 12px;
                  border: 2px solid #000000;
                  border-radius: 4px;
                  display: inline-block;
                  margin-top: 3px;
              }
              .date-time { font-size: ${matrixFontSize + 0.5}px; color: #000000; font-weight: 700; }
              
              .side-by-side-container {
                  display: flex;
                  gap: 8px;
                  width: 100%;
                  margin-bottom: 4px;
              }
              .print-column {
                  flex: 1;
                  display: flex;
                  flex-direction: column;
                  min-width: 23%;
                  margin-right: 8px;
              }
              .print-column:last-child {
                  margin-right: 0px !important;
              }
              .column-header {
                  text-align: center;
                  font-size: ${matrixFontSize + 1}px;
                  font-weight: 900;
                  background: #ffffff;
                  color: #000000;
                  padding: 3px;
                  border-radius: 4px;
                  border: 1.5px solid #000000;
                  margin-bottom: 4px;
                  white-space: nowrap;
                  text-overflow: ellipsis;
                  overflow: hidden;
              }
              
              table {
                  width: 100%;
                  border-collapse: collapse;
                  font-size: ${matrixFontSize}px;
                  border: 1.5px solid #000000;
                  table-layout: fixed;
              }
              table th {
                  background: #ffffff !important;
                  color: #000000 !important;
                  border: 1.5px solid #000000;
                  padding: ${matrixHeaderPadding};
                  text-align: center;
                  font-weight: 800;
                  font-size: ${matrixFontSize + 0.5}px;
              }
              table td {
                  border: 1.5px solid #000000;
                  padding: ${matrixCellPadding};
                  font-size: ${matrixFontSize}px;
                  background: white !important;
                  color: #000000 !important;
                  font-weight: 700;
                  line-height: 1.25;
              }
              tr {
                  page-break-inside: avoid !important;
                  break-inside: avoid !important;
              }
              
              .print-checkbox {
                  display: inline-block;
                  width: ${checkboxSize}px;
                  height: ${checkboxSize}px;
                  border: 1.5px solid #000000;
                  border-radius: 2px;
                  vertical-align: middle;
                  background: #ffffff;
              }
              
              .warehouse-tag {
                  font-size: ${matrixFontSize - 1.8}px;
                  color: #000000;
                  background: #ffffff;
                  padding: 0.2px 2px;
                  border-radius: 2px;
                  border: 1px solid #000000;
                  font-weight: 800;
                  display: inline-block;
                  margin-right: 2px;
              }
              .dup-badge {
                  font-size: ${matrixFontSize - 1.8}px;
                  font-weight: bold;
                  color: #b00;
                  margin-right: 2px;
              }
              .item-note {
                  font-size: ${matrixFontSize - 1.5}px;
                  color: #000000;
                  font-weight: normal;
                  font-style: italic;
                  margin-right: 2px;
              }
              
              .footer {
                  border-top: 3px solid #000000;
                  padding-top: 4px;
                  text-align: center;
                  color: #000000;
                  font-size: ${matrixFontSize}px;
                  font-weight: 700;
              }
              .footer strong { color: #000000; font-weight: 800; }
              .user-footer {
                  font-size: ${matrixFontSize}px;
                  font-weight: 800;
                  color: #000000;
              }
              .copyright { font-weight: 700 !important; font-size: 10px !important; color: #000000 !important; }
              
              @media print {
                  body { 
                      padding: 0 !important; 
                      margin: 0 !important; 
                      color: #000000 !important; 
                      background: #ffffff !important;
                      height: auto !important;
                      overflow: visible !important;
                  }
                  .side-by-side-container {
                      display: flex !important;
                      flex-direction: row !important;
                      gap: 8px !important;
                      overflow: visible !important;
                      page-break-inside: auto !important;
                      break-inside: auto !important;
                  }
                  .print-column {
                      flex: 1 !important;
                      page-break-inside: auto !important;
                      break-inside: auto !important;
                  }
                  table {
                      page-break-inside: auto !important;
                      break-inside: auto !important;
                  }
                  tr {
                      page-break-inside: avoid !important;
                      break-inside: avoid !important;
                  }
                  table th { background: #ffffff !important; color: #000000 !important; }
                  table td { color: #000000 !important; font-weight: 700; }
                  .header { border-bottom: 3px solid #000000 !important; }
                  .footer { border-top: 3px solid #000000 !important; }
                  thead { display: table-header-group !important; }
                  @page { 
                      size: A4 landscape !important; 
                      margin: ${matrixPageMargin} !important; 
                  }
                  .warehouse-tag { background: #ffffff !important; border: 1px solid #000000 !important; }
              }
          </style>
      </head>
      <body>
          <div class="invoice-print">
              <div class="header">
                  <div class="right">
                      ${getHeaderHtml()}
                  </div>
                  <div class="center">
                      <div class="title-text">📋 ${title}<br><span class="serial">بيان رقم ${serialNumber}</span></div>
                      <div style="font-size:${matrixFontSize + 0.8}px; font-weight:bold; margin-top:4px;">المخازن المشتركة: ${sharedWhsStr}</div>
                  </div>
                  <div class="left">
                      <div class="date-time">📅 التاريخ: ${dateStr}</div>
                      <div class="date-time">🕐 الوقت: ${timeStr}</div>
                  </div>
              </div>

              <!-- Columns Container -->
              <div class="side-by-side-container">
                  ${columnsHtml}
              </div>

              <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;padding: 4px 0; border-top: 2px dashed #000; margin-top:4px;">
                  <div style="font-size:${matrixFontSize}px;color:#000;font-weight:800;">
                      إجمالي الأصناف بالمصفوفة: <span style="font-size:${matrixFontSize+1.5}px;text-decoration:underline;">${items.length}</span> (النحاس: ${nahasItems.length} | النادي: ${nadyItems.length})
                  </div>
                  <div class="user-footer">👤 محرر المصفوفة: ${getPrintUserName(currentUserDisplay)}</div>
              </div>

              <div class="footer">
                  ${getFooterHtml("البيان")}
                  <p style="margin: 2px 0;"><span class="copyright">حقوق الملكية: Mohamed Nazih | 📱 01029190615</span></p>
              </div>
          </div>
          <script>
              window.onload = function() { window.print(); }
          </script>
      </body>
      </html>
  `;

  const win = window.open("", "_blank", "width=1200,height=900");
  if (win) {
    win.document.write(html);
    win.document.close();
    win.focus();
  }
}


export function printQuotationReceipt(quotation: Quotation, currentUserDisplay = "غير تحديد") {
  const isLargeInvoice = quotation.items.length >= 25;
  const cellPadding = isLargeInvoice ? "4px 6px" : "10px 14px";
  const headerPadding = isLargeInvoice ? "6px 8px" : "12px 14px";
  const cellFontSize = isLargeInvoice ? "11px" : "14px";
  const headerFontSize = isLargeInvoice ? "12px" : "15px";
  const tableMargin = isLargeInvoice ? "8px 0" : "20px 0";
  const headerBottomMargin = isLargeInvoice ? "8px" : "20px";
  const bodyPadding = isLargeInvoice ? "15px" : "30px";

  let itemsHtml = "";
  quotation.items.forEach((item, i) => {
    itemsHtml += `
        <tr>
            <td style="padding: ${cellPadding}; font-size: ${cellFontSize};">${i + 1}</td>
            <td style="text-align:right;font-weight:600; padding: ${cellPadding}; font-size: ${cellFontSize};">${item.name}</td>
            <td style="padding: ${cellPadding}; font-size: ${cellFontSize};">${item.note || "-"}</td>
            <td style="padding: ${cellPadding}; font-size: ${cellFontSize};">${item.quantity}</td>
            <td style="padding: ${cellPadding}; font-size: ${cellFontSize};">${item.price.toFixed(2)}</td>
            <td style="padding: ${cellPadding}; font-size: ${cellFontSize};">${item.discount}%</td>
            <td style="padding: ${cellPadding}; font-size: ${cellFontSize};">${item.tax}%</td>
            <td style="font-weight:700;color:#000000; padding: ${cellPadding}; font-size: ${cellFontSize};">${item.total.toFixed(2)}</td>
        </tr>
    `;
  });

  const dateStr = quotation.date;
  const timeStr = quotation.time;

  const html = `
      <html dir="rtl">
      <head>
          <meta charset="UTF-8">
          <title>فاتورة عرض سعر</title>
          <style>
              * { 
                  font-family: 'Arial', 'Segoe UI', sans-serif !important; 
                  -webkit-print-color-adjust: exact !important; 
                  print-color-adjust: exact !important;
              }
              body { padding: ${bodyPadding}; background: white; margin: 0; color: #000000; }
              .invoice-print { max-width: 1000px; margin: 0 auto; }
              .header {
                  display: flex;
                  justify-content: space-between;
                  align-items: flex-start;
                  border-bottom: 3.5px solid #000000;
                  padding-bottom: 15px;
                  margin-bottom: ${headerBottomMargin};
              }
              .header .right { text-align: right; }
              .header .center { text-align: center; flex: 1; }
              .header .left { text-align: left; }
              .company-name {
                  font-size: 24px;
                  font-weight: 800;
                  color: #000000;
                  letter-spacing: 0.5px;
              }
              .company-address { font-size: 15px; color: #111111; font-weight: 700; margin-top: 5px; }
              .company-phone { font-size: 14px; color: #111111; font-weight: 700; margin-top: 3px; }
              .title { font-size: 22px; font-weight: 800; color: #000000; }
              .title .serial { 
                  font-size: 18px; 
                  font-weight: 800; 
                  color: #000000; 
                  background: #ffffff;
                  padding: 2px 8px;
                  border: 1.5px solid #000000;
                  border-radius: 4px;
                  display: inline-block;
                  margin-top: 5px;
              }
              .date-time { font-size: 14px; color: #000000; font-weight: 700; }
              .client-info { font-size: 15px; color: #000000; font-weight: 700; margin-top: 10px; }
              .client-info strong { color: #000000; font-weight: 800; }
              table {
                  width: 100%;
                  border-collapse: collapse;
                  margin: ${tableMargin};
                  font-size: ${cellFontSize};
                  border: 2px solid #000000;
              }
              table th {
                  background: #ffffff !important;
                  color: #000000 !important;
                  border: 2px solid #000000;
                  padding: ${headerPadding};
                  text-align: center;
                  font-weight: 800;
                  font-size: ${headerFontSize};
              }
              table td {
                  border: 1.5px solid #000000;
                  text-align: center;
                  background: white;
                  color: #000000 !important;
                  font-weight: 700;
              }
              .total-row td {
                  border-top: 3.5px solid #000000 !important;
                  font-weight: 800;
                  font-size: 16px;
                  background: #ffffff !important;
              }
              .footer {
                  margin-top: 30px;
                  border-top: 3.5px solid #000000;
                  padding-top: 15px;
                  text-align: center;
                  color: #000000;
                  font-size: 14px;
                  font-weight: 700;
              }
              .footer strong { color: #000000; font-weight: 800; }
              .user-footer {
                  text-align: right;
                  font-size: 15px;
                  font-weight: 800;
                  margin-top: 15px;
                  padding-top: 8px;
                  border-top: 2px dashed #000000;
                  color: #000000;
              }
              .copyright { font-weight: 700 !important; font-size: 10.5px !important; color: #000000 !important; }
              @media print {
                  body { padding: ${isLargeInvoice ? '5px' : '15px'}; margin: 0; color: #000000 !important; }
                  table th { background: #ffffff !important; color: #000000 !important; }
                  table td { color: #000000 !important; font-weight: 700; }
                  .header { border-bottom: 3.5px solid #000000 !important; }
                  .footer { border-top: 3.5px solid #000000 !important; }
                  @page { margin: ${isLargeInvoice ? '5mm' : '10mm'}; }
              }
          </style>
      </head>
      <body>
          <div class="invoice-print">
              <div class="header">
                  <div class="right">
                      ${getHeaderHtml()}
                  </div>
                  <div class="center">
                      <div class="title">📋 عرض سعر<br><span class="serial">عرض رقم: ${quotation.quotationNumber || 1}</span></div>
                      <div class="date-time">📅 ${dateStr}</div>
                      <div class="date-time">🕐 ${timeStr}</div>
                      <div class="client-info"><strong>👤 العميل:</strong> ${quotation.clientName}</div>
                      <div class="client-info"><strong>📞 الهاتف:</strong> ${quotation.clientPhone}</div>
                  </div>
                  <div class="left">
                      <div class="company-phone" style="margin-top:20px;">المستخدم: ${quotation.user || currentUserDisplay}</div>
                  </div>
              </div>

              <table>
                  <thead>
                      <tr>
                          <th style="padding: ${headerPadding};">#</th>
                          <th style="padding: ${headerPadding};">اسم الصنف</th>
                          <th style="padding: ${headerPadding};">ملاحظة</th>
                          <th style="padding: ${headerPadding};">الكمية</th>
                          <th style="padding: ${headerPadding};">سعر الوحدة</th>
                          <th style="padding: ${headerPadding};">الخصم%</th>
                          <th style="padding: ${headerPadding};">الضريبة%</th>
                          <th style="padding: ${headerPadding};">الإجمالي</th>
                      </tr>
                  </thead>
                  <tbody>
                      ${itemsHtml}
                  </tbody>
                  <tfoot>
                      <tr class="total-row">
                          <td colspan="7" style="text-align:left;padding:10px 12px;">الإجمالي الكلي:</td>
                          <td style="text-align:center;padding:10px 12px;color:#8b6b4d;font-size:16px;font-weight:700;">${quotation.total.toFixed(2)} ج.م</td>
                      </tr>
                  </tfoot>
              </table>

              <div class="user-footer">👤 المستخدم: ${getPrintUserName(quotation.user || currentUserDisplay)}</div>

              <div class="footer">
                  ${getFooterHtml("العرض")}
                  <p><span class="copyright">حقوق الملكية: Mohamed Nazih | 📱 01029190615</span></p>
              </div>
          </div>
          <script>
              window.onload = function() { setTimeout(function() { window.print(); }, 500); }
          <\/script>
      </body>
      </html>
  `;

  const win = window.open("", "_blank", "width=900,height=700");
  if (win) {
    win.document.write(html);
    win.document.close();
    win.focus();
  }
}
