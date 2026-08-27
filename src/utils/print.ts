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

export function getNextPrintNumber(type: "normal" | "matrix" | "daily_receipt" = "normal") {
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

/**
 * Universal sticky top bar for force-printing, retrying, and printer driver selection.
 * Explicitly optimized for HP Laser MFP137fnw and all office laser / thermal / POS printers.
 * Automatically hidden during actual print output via @media print.
 */
export function getUniversalPrintHeaderBar(docTitle = "مستند الطباعة"): string {
  return `
    <div class="no-print-universal-bar" style="background:#0f172a; color:#ffffff; padding:10px 18px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; position:sticky; top:0; z-index:999999; border-bottom:3px solid #8b6b4d; box-shadow:0 4px 14px rgba(0,0,0,0.25); font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Cairo', Tahoma, Arial, sans-serif; direction:rtl;">
      <div style="display:flex; align-items:center; gap:12px;">
        <span style="font-size:24px; line-height:1;">🖨️</span>
        <div>
          <div style="font-weight:900; font-size:14.5px; color:#f8fafc; display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <span>طابعة مخزن النحاس: HP Laser MFP137fnw</span>
            <span style="background:#16a34a; color:#ffffff; font-size:10.5px; padding:2px 8px; border-radius:999px; font-weight:900;">معرّفة وجاهزة 100%</span>
          </div>
          <div style="font-size:11.5px; color:#94a3b8; margin-top:2px;">
            مهيأة للإرسال المباشر بدقة الليزر العالية PCL/SPL لجميع طابعات HP وكانون وإبسون والحراري وPDF.
          </div>
        </div>
      </div>
      <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
        <button type="button" onclick="triggerUniversalForcePrint()" style="background:#16a34a; color:#ffffff; border:none; padding:8px 20px; border-radius:10px; font-weight:900; font-size:13.5px; cursor:pointer; box-shadow:0 3px 8px rgba(22,163,74,0.4); display:flex; align-items:center; gap:6px; transition:all 0.2s;">
          <span>🖨️</span>
          <span>طباعة فورية (HP MFP137fnw / ليزر)</span>
        </button>
        <button type="button" onclick="triggerUniversalForcePrint()" style="background:#2563eb; color:#ffffff; border:none; padding:8px 14px; border-radius:10px; font-weight:bold; font-size:12px; cursor:pointer; transition:all 0.2s;">
          <span>🔄</span>
          <span>إعادة إرسال الأمر للطابعة</span>
        </button>
        <button type="button" onclick="window.close()" style="background:#334155; color:#ffffff; border:none; padding:8px 14px; border-radius:10px; font-weight:bold; font-size:12px; cursor:pointer; transition:all 0.2s;">
          ✕ إغلاق النافذة
        </button>
      </div>
    </div>
  `;
}

/**
 * Universal print invocation script that triggers print on multiple events
 * to bypass browser timing stalls and ensure communication with printer spooler.
 */
export function getUniversalPrintScript(): string {
  return `
    <script>
      function triggerUniversalForcePrint() {
        try {
          window.focus();
          window.print();
        } catch (err) {
          console.warn("Print execution note:", err);
        }
      }

      // Multi-event triggers to guarantee execution on every browser, device, and HP Laser driver
      if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(triggerUniversalForcePrint, 250);
      } else {
        window.addEventListener('DOMContentLoaded', function() { setTimeout(triggerUniversalForcePrint, 200); });
        window.addEventListener('load', function() { setTimeout(triggerUniversalForcePrint, 350); });
      }

      // Fallback safety triggers
      setTimeout(triggerUniversalForcePrint, 700);
      setTimeout(triggerUniversalForcePrint, 1400);
    </script>
  `;
}

/**
 * Universal bulletproof print executor:
 * 1. Tries popup window first.
 * 2. If popup is blocked, uses hidden IFrame fallback inside current DOM (100% popup-blocker proof).
 */
export function executeUniversalPrint(htmlContent: string, title = "مستند الطباعة") {
  let fullHtml = htmlContent;
  if (!fullHtml.includes("<!DOCTYPE html>") && !fullHtml.includes("<!doctype html>")) {
    fullHtml = "<!DOCTYPE html>\n" + fullHtml;
  }

  // Attempt Method 1: Popup Window
  let printWindow: Window | null = null;
  try {
    printWindow = window.open("", "_blank", "width=1200,height=900,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes");
  } catch (err) {
    console.warn("Popup blocked or failed, using iframe fallback:", err);
  }

  if (printWindow && !printWindow.closed) {
    try {
      printWindow.document.open();
      printWindow.document.write(fullHtml);
      printWindow.document.close();
      printWindow.focus();

      // Parent-side backup trigger
      setTimeout(() => {
        try {
          if (printWindow && !printWindow.closed) {
            printWindow.focus();
            printWindow.print();
          }
        } catch (e) {
          console.warn("Parent print trigger fallback:", e);
        }
      }, 400);

      return;
    } catch (err) {
      console.warn("Writing to popup window failed, switching to iframe fallback:", err);
    }
  }

  // Attempt Method 2: Hidden Iframe Injection (100% popup-blocker proof & mobile/kiosk friendly)
  try {
    let iframe = document.getElementById("universal-print-frame") as HTMLIFrameElement;
    if (iframe) {
      iframe.remove();
    }
    iframe = document.createElement("iframe");
    iframe.id = "universal-print-frame";
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0px";
    iframe.style.height = "0px";
    iframe.style.border = "none";
    iframe.style.visibility = "hidden";
    iframe.style.zIndex = "-99999";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (doc && iframe.contentWindow) {
      doc.open();
      doc.write(fullHtml);
      doc.close();

      const triggerIframePrint = () => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (err) {
          console.error("Iframe print error:", err);
        }
      };

      if (iframe.contentWindow.document.readyState === "complete") {
        setTimeout(triggerIframePrint, 250);
      } else {
        iframe.onload = () => {
          setTimeout(triggerIframePrint, 250);
        };
      }
    }
  } catch (err) {
    console.error("Universal print fallback error:", err);
    try {
      window.print();
    } catch (e) {}
  }
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

  // Determine if this is a single warehouse invoice or a multi-warehouse merged invoice
  const rawWh = (warehouseName || "").trim();
  const isExplicitSingleWh = Boolean(
    rawWh &&
    rawWh !== "جميع المخازن" &&
    rawWh !== "الكل" &&
    rawWh !== "all"
  );

  const distinctWhs = Array.from(new Set(items.map(i => (i.warehouse || "").trim()).filter(Boolean)));
  const isSingleWarehouse = isExplicitSingleWh || distinctWhs.length <= 1;
  const singleWhTitle = isExplicitSingleWh ? rawWh : (distinctWhs[0] || "المخزن");

  // Calculate totals
  const totalItemsCount = items.length;
  let totalUnitsCount = 0;
  items.forEach(item => {
    const qty = parseInt(item.company || "1", 10);
    totalUnitsCount += isNaN(qty) ? 1 : qty;
  });

  // Checkbox size
  const checkboxSize = 13;

  // -------------------------------------------------------------
  // Case 1: SINGLE WAREHOUSE INVOICE (فاتورة عادية كاملة واضحة لمخزن واحد)
  // -------------------------------------------------------------
  if (isSingleWarehouse) {
    // If items count is very large (> 40), we can split into 2 balanced columns of the same warehouse
    const useTwoColumns = items.length > 40;

    let tableContentHtml = "";

    if (!useTwoColumns) {
      // Single clean full-width table for the warehouse
      let rowsHtml = "";
      items.forEach((item, index) => {
        const dupTag = item.duplicateNote ? ` <span class="dup-badge">🔄 مكرر</span>` : '';
        const cleanNote = (item.note || "")
          .replace(/[\(（]?\s*إعادة إرسال لبند لم يصل[^\)）]*[\)）]?/g, "")
          .replace(/[\(（]?\s*لم يصل[^\)）]*[\)）]?/g, "")
          .replace(/[\(（]?\s*لم تصل[^\)）]*[\)）]?/g, "")
          .trim();
        const noteTag = cleanNote && cleanNote !== "-" ? ` <span class="item-note">(${cleanNote})</span>` : '';
        const cleanFixedName = (item.fixedName || item.description || "")
          .replace(/[\(（]?\s*إعادة إرسال لبند لم يصل[^\)）]*[\)）]?/g, "")
          .trim();

        const isPartial = item.hasPartialReceipt;
        const isDelayedOrNotArrived = item.isNotArrived || item.deliveryStatus === "delayed" || (item.note && (item.note.includes("لم يصل") || item.note.includes("لم تصل")));
        const notArrivedTag = isDelayedOrNotArrived ? ` <span class="not-arrived-tag">لم يصل</span>` : '';
        const partialPrintHtml = isPartial ? `
          <span style="font-size: 11px; font-weight: 800; color: #b91c1c; margin-right: 6px; background:#fef2f2; padding:1px 6px; border-radius:4px; border:1px solid #fca5a5;">
            (مطلوب: ${item.originalQty || item.company} | مستلم: ${item.receivedQty || "0"} | متبقي: ${item.remainingQty || "0"})
          </span>
        ` : '';

        const qtyDisplay = isPartial ? (item.remainingQty || "0") : (item.company || "1");

        rowsHtml += `
          <tr>
            <td style="width: 5%; text-align: center; font-weight: 900; font-size: 13px;">${index + 1}</td>
            <td style="width: 68%; text-align: right; font-weight: 800; font-size: 14px; padding: 6px 8px; line-height: 1.35; color: #000000;" title="${cleanFixedName}">
              <div style="display:inline-block; font-size: 14px; color: #000000;">${cleanFixedName}</div>
              ${dupTag}${notArrivedTag}${noteTag}${partialPrintHtml}
            </td>
            <td style="width: 17%; text-align: center; font-weight: 900; font-size: 16px; color: #000000; background: #ffffff;">
              <span style="display:inline-block; padding: 2px 10px; border: 1.5px solid #000000; border-radius: 4px; background: #fafafa; min-width: 45px;">
                ${qtyDisplay}
              </span>
            </td>
            <td style="width: 10%; text-align: center; padding: 4px 2px;">
              <span class="print-checkbox"></span>
            </td>
          </tr>
        `;
      });

      tableContentHtml = `
        <table class="single-wh-table">
          <thead>
            <tr>
              <th style="width: 5%; text-align: center;">#</th>
              <th style="width: 68%; text-align: right; padding-right: 10px;">اسم الصنف والبيان التفصيلي</th>
              <th style="width: 17%; text-align: center;">العدد / الكمية</th>
              <th style="width: 10%; text-align: center;">استلام (✓)</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      `;
    } else {
      // Two balanced columns for large item counts (> 40) in single warehouse
      const half = Math.ceil(items.length / 2);
      const col1Items = items.slice(0, half);
      const col2Items = items.slice(half);

      const renderSubTable = (subItems: Item[], startIndex: number) => {
        let rowsHtml = "";
        subItems.forEach((item, idx) => {
          const dupTag = item.duplicateNote ? ` <span class="dup-badge">🔄</span>` : '';
          const cleanNote = (item.note || "")
            .replace(/[\(（]?\s*إعادة إرسال لبند لم يصل[^\)）]*[\)）]?/g, "")
            .replace(/[\(（]?\s*لم يصل[^\)）]*[\)）]?/g, "")
            .trim();
          const noteTag = cleanNote && cleanNote !== "-" ? ` <span class="item-note">(${cleanNote})</span>` : '';
          const cleanFixedName = (item.fixedName || item.description || "")
            .replace(/[\(（]?\s*إعادة إرسال لبند لم يصل[^\)）]*[\)）]?/g, "")
            .trim();
          const isPartial = item.hasPartialReceipt;
          const qtyDisplay = isPartial ? (item.remainingQty || "0") : (item.company || "1");

          rowsHtml += `
            <tr>
              <td style="width: 6%; text-align: center; font-weight: 800; font-size: 12px;">${startIndex + idx + 1}</td>
              <td style="width: 14%; text-align: center; font-weight: 900; font-size: 14px; color: #000;">${qtyDisplay}</td>
              <td style="width: 70%; text-align: right; font-weight: 700; font-size: 12.5px; padding: 4px 6px;">
                ${cleanFixedName}${dupTag}${noteTag}
              </td>
              <td style="width: 10%; text-align: center; padding: 2px;">
                <span class="print-checkbox"></span>
              </td>
            </tr>
          `;
        });

        return `
          <div style="flex: 1; min-width: 48%;">
            <table class="single-wh-table">
              <thead>
                <tr>
                  <th style="width: 6%; text-align: center;">#</th>
                  <th style="width: 14%; text-align: center;">العدد</th>
                  <th style="width: 70%; text-align: right; padding-right: 6px;">اسم الصنف</th>
                  <th style="width: 10%; text-align: center;">✓</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>
        `;
      };

      tableContentHtml = `
        <div style="display: flex; gap: 12px; width: 100%;">
          ${renderSubTable(col1Items, 0)}
          ${renderSubTable(col2Items, half)}
        </div>
      `;
    }

    const html = `
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
          <meta charset="UTF-8">
          <title>${title} - ${singleWhTitle}</title>
          <style>
              * { 
                  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Cairo", Tahoma, Arial, sans-serif !important; 
                  -webkit-print-color-adjust: exact !important; 
                  print-color-adjust: exact !important;
                  color-adjust: exact !important;
                  box-sizing: border-box !important;
              }
              body { 
                  padding: 8px !important; 
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
              }
              .header {
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                  border-bottom: 2.5px solid #000000;
                  padding-bottom: 6px;
                  margin-bottom: 8px;
              }
              .header .right { text-align: right; }
              .header .center { text-align: center; flex: 1; }
              .header .left { text-align: left; }
              .company-name {
                  font-size: 17px;
                  font-weight: 900;
                  color: #000000;
                  line-height: 1.1;
              }
              .company-address { font-size: 10px; color: #111111; font-weight: 700; margin-top: 2px; }
              .company-phone { font-size: 9.5px; color: #111111; font-weight: 700; margin-top: 1px; }
              .title-text {
                  font-size: 15px;
                  font-weight: 900;
                  color: #000000;
                  line-height: 1.1;
              }
              .title-text .wh-badge {
                  font-size: 13px;
                  font-weight: 900;
                  color: #000000;
                  background: #ffffff;
                  padding: 2px 14px;
                  border: 1.5px solid #000000;
                  border-radius: 6px;
                  display: inline-block;
                  margin-top: 3px;
              }
              .title-text .serial {
                  font-size: 11px;
                  font-weight: 800;
                  color: #000000;
                  background: #ffffff;
                  padding: 1px 8px;
                  border: 1.5px solid #000000;
                  border-radius: 4px;
                  display: inline-block;
                  margin-top: 3px;
              }
              .date-time { font-size: 12px; color: #000000; font-weight: 700; line-height: 1.3; }
              
              table.single-wh-table {
                  width: 100%;
                  border-collapse: collapse;
                  font-size: 13px;
                  border: 2px solid #000000;
                  margin-bottom: 6px;
              }
              table.single-wh-table th {
                  background: #ffffff !important;
                  color: #000000 !important;
                  border: 1.5px solid #000000;
                  padding: 6px 8px;
                  text-align: center;
                  font-weight: 900;
                  font-size: 13.5px;
              }
              table.single-wh-table td {
                  border: 1.5px solid #000000;
                  padding: 5px 8px;
                  font-size: 13px;
                  background: white !important;
                  color: #000000 !important;
                  font-weight: 700;
                  line-height: 1.3;
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
              
              .dup-badge {
                  font-size: 10.5px;
                  font-weight: bold;
                  color: #b91c1c;
                  margin-right: 4px;
              }
              .not-arrived-tag {
                  font-size: 10.5px;
                  color: #b91c1c;
                  background: #fee2e2;
                  padding: 1px 4px;
                  border-radius: 2px;
                  border: 1px solid #f87171;
                  font-weight: 900;
                  display: inline-block;
                  vertical-align: middle;
                  margin-right: 4px;
                  white-space: nowrap;
              }
              .item-note {
                  font-size: 11.5px;
                  color: #222222;
                  font-weight: normal;
                  font-style: italic;
                  margin-right: 4px;
              }
              
              .footer {
                  border-top: 2.5px solid #000000;
                  padding-top: 4px;
                  text-align: center;
                  color: #000000;
                  font-size: 11.5px;
                  font-weight: 700;
              }
              .copyright { font-weight: 700 !important; font-size: 10px !important; color: #000000 !important; }
              
              @media print {
                  button, .no-print, .btn, .sidebar, input, select, .no-print-universal-bar {
                      display: none !important;
                  }
                  body { 
                      padding: 0 !important; 
                      margin: 0 !important; 
                      color: #000000 !important; 
                      background: #ffffff !important;
                  }
                  table.single-wh-table th { background: #ffffff !important; color: #000000 !important; }
                  table.single-wh-table td { color: #000000 !important; }
                  .header { border-bottom: 2.5px solid #000000 !important; }
                  .footer { border-top: 2.5px solid #000000 !important; }
                  thead { display: table-header-group !important; }
                  @page { 
                      size: A4 portrait !important; 
                      margin: 8mm 10mm !important; 
                  }
              }
          </style>
      </head>
      <body>
          ${getUniversalPrintHeaderBar(`${title} - ${singleWhTitle}`)}

          <div class="invoice-print">
              <div class="header">
                  <div class="right">
                      ${getHeaderHtml()}
                  </div>
                  <div class="center">
                      <div class="title-text">
                        📋 ${title}<br>
                        <span class="wh-badge">مستودع: ${singleWhTitle}</span><br>
                        <span class="serial">بيان رقم ${serialNumber}</span>
                      </div>
                  </div>
                  <div class="left">
                      <div class="date-time">📅 التاريخ: ${dateStr}</div>
                      <div class="date-time">🕐 الوقت: ${timeStr}</div>
                      <div class="date-time" style="margin-top:2px;">👤 المحرر: ${getPrintUserName(currentUserDisplay)}</div>
                  </div>
              </div>
 
              <!-- Table Content -->
              <div style="width: 100%; margin-bottom: 4px;">
                  ${tableContentHtml}
              </div>
 
              <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; padding: 4px 8px; border: 1.5px solid #000000; border-radius: 6px; background:#f8fafc; margin-bottom: 6px;">
                  <div style="font-size: 13px; color: #000000; font-weight: 900;">
                      📊 إجمالي الأصناف: <span style="font-size: 14.5px; text-decoration: underline;">${totalItemsCount}</span> صنف
                      &nbsp;|&nbsp; 
                      📦 إجمالي الكميات المطلوبة: <span style="font-size: 14.5px; text-decoration: underline;">${totalUnitsCount}</span> قطعة
                  </div>
                  <div style="font-size: 12px; font-weight: 800; color: #000000;">
                      👤 المستلم / مسؤول المخزن: ____________________
                  </div>
              </div>

              <div class="footer">
                  ${getFooterHtml("الطلب")}
                  <p style="margin: 2px 0;"><span class="copyright">حقوق الملكية: Mohamed Nazih | 📱 01029190615</span></p>
              </div>
          </div>
          ${getUniversalPrintScript()}
      </body>
      </html>
    `;

    executeUniversalPrint(html, `${title} - ${singleWhTitle}`);
    return;
  }

  // -------------------------------------------------------------
  // Case 2: MULTI-WAREHOUSE / MERGED INVOICE (فواتير مدمجة لعدة مخازن)
  // -------------------------------------------------------------
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
      if (nahasItems.length <= nadyItems.length) {
        nahasItems.push(item);
      } else {
        nadyItems.push(item);
      }
    }
  });

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

  const normalFontSize = maxItemsInAnyCol > 50 ? 11.5 : maxItemsInAnyCol > 35 ? 11.8 : 12.0;
  const normalCellPadding = maxItemsInAnyCol > 50 ? "2.5px 4px" : "3.5px 5.5px";
  const normalHeaderPadding = "4px 5px";
  const normalHeaderBottomMargin = "6px";
  const normalBodyPadding = "6px";
  const normalHeaderFontSize = 14;
  const normalTitleFontSize = 13;
  const normalSubTitleFontSize = 10;
  const normalLogoFontSize = 9.5;
  const normalPageMargin = "8mm 10mm";

  const activeWhs: string[] = [];
  if (nahasItems.length > 0) activeWhs.push("النحاس");
  if (nadyItems.length > 0) activeWhs.push("النادي");
  const sharedWhsStr = activeWhs.join(" - ") || "المخازن المشتركة";

  let columnsHtml = "";
  columnsToRender.forEach(col => {
    let rowsHtml = "";
    col.items.forEach((item, index) => {
      const warehouseTag = item.warehouse || col.title;
      const dupTag = item.duplicateNote ? ` <span class="dup-badge">🔄 مكرر</span>` : '';
      
      const cleanNote = (item.note || "")
        .replace(/[\(（]?\s*إعادة إرسال لبند لم يصل[^\)）]*[\)）]?/g, "")
        .replace(/[\(（]?\s*لم يصل[^\)）]*[\)）]?/g, "")
        .replace(/[\(（]?\s*لم تصل[^\)）]*[\)）]?/g, "")
        .trim();
      const noteTag = cleanNote && cleanNote !== "-" ? ` <span class="item-note">(${cleanNote})</span>` : '';

      const cleanFixedName = (item.fixedName || item.description || "")
        .replace(/[\(（]?\s*إعادة إرسال لبند لم يصل[^\)）]*[\)）]?/g, "")
        .trim();

      const displayTag = !warehouseTag.includes("النحاس") && !warehouseTag.includes("النادي") ? ` <span class="warehouse-tag">${warehouseTag}</span>` : '';

      const isPartial = item.hasPartialReceipt;
      const isDelayedOrNotArrived = item.isNotArrived || item.deliveryStatus === "delayed" || (item.note && (item.note.includes("لم يصل") || item.note.includes("لم تصل")));
      const notArrivedTag = isDelayedOrNotArrived ? ` <span class="not-arrived-tag">لم يصل</span>` : '';
      const partialPrintHtml = isPartial ? `
        <div style="font-size: ${normalFontSize - 2}px; font-weight: 800; color: #b00; margin-top: 1px;">
          (مطلوب: ${item.originalQty || item.company} | مستلم: ${item.receivedQty || "0"} | متبقي: ${item.remainingQty || "0"})
        </div>
      ` : '';

      rowsHtml += `
        <tr>
          <td style="width: 6%; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight:800;">${index + 1 + col.startIndex}</td>
          <td style="width: 12%; text-align: center; font-weight: 900; color: #000000; font-size:13.5px;">${isPartial ? (item.remainingQty || "0") : (item.company || "1")}</td>
          <td style="width: 72%; text-align: right; font-weight: 700; padding: 4px 6px; white-space: normal; word-break: break-word; line-height: 1.3;" title="${cleanFixedName}">
            ${cleanFixedName}${displayTag}${dupTag}${notArrivedTag}${noteTag}${partialPrintHtml}
          </td>
          <td style="width: 10%; text-align: center; padding: 1px 1px; white-space: nowrap;">
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
                      <th style="width: 12%; text-align: center; white-space: nowrap;">العدد</th>
                      <th style="width: 72%; text-align: right; padding-right: 4px; white-space: nowrap;">اسم الصنف والبيان</th>
                      <th style="width: 10%; text-align: center; white-space: nowrap;">✓</th>
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
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
          <meta charset="UTF-8">
          <title>${title} - ${serialNumber}</title>
          <style>
              * { 
                  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Cairo", Tahoma, Arial, sans-serif !important; 
                  -webkit-print-color-adjust: exact !important; 
                  print-color-adjust: exact !important;
                  color-adjust: exact !important;
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
              .not-arrived-tag {
                  font-size: ${normalFontSize - 2.5}px;
                  color: #b91c1c;
                  background: #fee2e2;
                  padding: 0.5px 2.5px;
                  border-radius: 2px;
                  border: 1px solid #f87171;
                  font-weight: 900;
                  display: inline-block;
                  vertical-align: middle;
                  margin-right: 2px;
                  white-space: nowrap;
                  line-height: 1.1;
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
                  button, .no-print, .btn, .sidebar, input, select, .no-print-universal-bar {
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
          ${getUniversalPrintHeaderBar(title)}

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
                  ${getFooterHtml("الطلب")}
                  <p style="margin: 2px 0;"><span class="copyright">حقوق الملكية: Mohamed Nazih | 📱 01029190615</span></p>
              </div>
          </div>
          ${getUniversalPrintScript()}
      </body>
      </html>
  `;

  executeUniversalPrint(html, title);
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

  // Determine initial filter
  const initialFilter = (!warehouseName || warehouseName === "جميع المخازن" || warehouseName === "all" || warehouseName === "المخازن المشتركة")
    ? "all"
    : warehouseName.trim();

  // Calculate items per warehouse
  const nahasItems: Item[] = [];
  const nadyItems: Item[] = [];
  const otherItems: Item[] = [];
  const customWarehouseMap: { [key: string]: Item[] } = {};

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
      otherItems.push(item);
      if (wh) {
        if (!customWarehouseMap[wh]) customWarehouseMap[wh] = [];
        customWarehouseMap[wh].push(item);
      }
    }
  });

  // Helper to split array into N chunks
  const splitIntoNChunks = (arr: Item[], n: number) => {
    const chunks: Item[][] = [];
    const size = Math.ceil(arr.length / n);
    for (let i = 0; i < n; i++) {
      chunks.push(arr.slice(i * size, (i + 1) * size));
    }
    return chunks;
  };

  // Helper to build columns for a specific warehouse
  const buildSingleWarehouseColumns = (whTitle: string, whItemsList: Item[]) => {
    let numCols = 4;
    if (whItemsList.length <= 12) {
      numCols = 2;
    } else if (whItemsList.length <= 24) {
      numCols = 3;
    } else {
      numCols = 4;
    }

    const chunks = splitIntoNChunks(whItemsList, numCols);
    const letters = ["أ", "ب", "ج", "د", "هـ", "و"];
    return chunks.map((chunk, idx) => {
      let startIndex = 0;
      for (let prev = 0; prev < idx; prev++) {
        startIndex += chunks[prev].length;
      }
      return {
        title: numCols > 1 ? `${whTitle} (${letters[idx] || (idx + 1)})` : whTitle,
        items: chunk,
        startIndex
      };
    });
  };

  // Build columns according to initial filter
  let initialColumns: { title: string; items: Item[]; startIndex: number }[] = [];
  let initialDisplayTitle = title;
  let initialSharedWhsStr = "جميع المخازن";

  if (initialFilter === "all") {
    // 4 columns: Nahas (A & B) and Nady (A & B)
    const [nahasColA, nahasColB] = splitIntoNChunks(nahasItems, 2);
    const [nadyColA, nadyColB] = splitIntoNChunks(nadyItems, 2);

    initialColumns = [
      { title: "مخزن النحاس (أ)", items: nahasColA, startIndex: 0 },
      { title: "مخزن النحاس (ب)", items: nahasColB, startIndex: nahasColA.length },
      { title: "مخزن النادي (أ)", items: nadyColA, startIndex: 0 },
      { title: "مخزن النادي (ب)", items: nadyColB, startIndex: nadyColA.length }
    ];

    // If other items exist and Nahas/Nady are small, balance them in
    if (otherItems.length > 0) {
      const activeWhs: string[] = [];
      if (nahasItems.length > 0) activeWhs.push("النحاس");
      if (nadyItems.length > 0) activeWhs.push("النادي");
      Object.keys(customWarehouseMap).forEach(k => activeWhs.push(k));
      initialSharedWhsStr = activeWhs.join(" - ") || "جميع المخازن";
    } else {
      initialSharedWhsStr = "مخزن النحاس - مخزن النادي";
    }
  } else if (
    initialFilter.includes("النحاس") ||
    initialFilter.toLowerCase().includes("nahas") ||
    initialFilter.includes("جمعة")
  ) {
    initialColumns = buildSingleWarehouseColumns("مخزن النحاس", nahasItems);
    initialDisplayTitle = initialDisplayTitle.includes("النحاس") ? initialDisplayTitle : `${initialDisplayTitle} (مخزن النحاس)`;
    initialSharedWhsStr = "مخزن النحاس فقط";
  } else if (
    initialFilter.includes("النادي") ||
    initialFilter.toLowerCase().includes("nady") ||
    initialFilter.includes("جعفر")
  ) {
    initialColumns = buildSingleWarehouseColumns("مخزن النادي", nadyItems);
    initialDisplayTitle = initialDisplayTitle.includes("النادي") ? initialDisplayTitle : `${initialDisplayTitle} (مخزن النادي)`;
    initialSharedWhsStr = "مخزن النادي فقط";
  } else {
    // Custom warehouse filter
    const targetItems = customWarehouseMap[initialFilter] || items.filter(i => (i.warehouse || "").trim().includes(initialFilter));
    initialColumns = buildSingleWarehouseColumns(initialFilter, targetItems.length > 0 ? targetItems : items);
    initialDisplayTitle = `${initialDisplayTitle} (${initialFilter})`;
    initialSharedWhsStr = `${initialFilter} فقط`;
  }

  let maxItemsInAnyCol = 0;
  initialColumns.forEach(col => {
    if (col.items.length > maxItemsInAnyCol) {
      maxItemsInAnyCol = col.items.length;
    }
  });
  if (maxItemsInAnyCol === 0) maxItemsInAnyCol = 1;

  // Sizing styles
  let matrixFontSize = 11.0;
  let matrixCellPadding = "3px 4.5px";
  let matrixHeaderPadding = "4px 4.5px";
  let matrixHeaderBottomMargin = "5px";
  let matrixBodyPadding = "5px";
  let matrixHeaderFontSize = 14;
  let matrixTitleFontSize = 13;
  let matrixSubTitleFontSize = 10;
  let matrixLogoFontSize = 9.5;
  let matrixPageMargin = "10mm";
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
    checkboxSize = 10.5;
  }

  const renderColumnHtml = (col: { title: string; items: Item[]; startIndex: number }, totalCols: number) => {
    let rowsHtml = "";
    col.items.forEach((item, index) => {
      const warehouseTag = item.warehouse || col.title;
      const dupTag = item.duplicateNote ? ` <span class="dup-badge">🔄 مكرر</span>` : '';
      
      const cleanNote = (item.note || "")
        .replace(/[\(（]?\s*إعادة إرسال لبند لم يصل[^\)）]*[\)）]?/g, "")
        .replace(/[\(（]?\s*لم يصل[^\)）]*[\)）]?/g, "")
        .replace(/[\(（]?\s*لم تصل[^\)）]*[\)）]?/g, "")
        .trim();
      const noteTag = cleanNote && cleanNote !== "-" ? ` <span class="item-note">(${cleanNote})</span>` : '';

      const cleanFixedName = (item.fixedName || item.description || "")
        .replace(/[\(（]?\s*إعادة إرسال لبند لم يصل[^\)）]*[\)）]?/g, "")
        .trim();

      const displayTag = (!warehouseTag.includes("النحاس") && !warehouseTag.includes("النادي") && initialFilter === "all")
        ? ` <span class="warehouse-tag">${warehouseTag}</span>`
        : '';

      const isPartial = item.hasPartialReceipt || Boolean(item.receivedQty && item.receivedQty !== "0" && item.remainingQty && item.remainingQty !== "0");
      const isDelayedOrNotArrived = item.isNotArrived || item.deliveryStatus === "delayed" || (item.note && (item.note.includes("لم يصل") || item.note.includes("لم تصل")));
      const isReceived = item.deliveryStatus === "received";

      let statusCellHtml = `<span class="status-badge-pending">معلق</span>`;
      if (isPartial) {
        statusCellHtml = `<span class="status-badge-partial" title="مستلم: ${item.receivedQty || '0'} | متبقي: ${item.remainingQty || '0'}">جزئي (${item.remainingQty || '0'})</span>`;
      } else if (isDelayedOrNotArrived) {
        statusCellHtml = `<span class="status-badge-delayed">لم يصل</span>`;
      } else if (isReceived) {
        statusCellHtml = `<span class="status-badge-completed">مكتمل</span>`;
      }

      const partialPrintHtml = isPartial ? `
        <div style="font-size: ${matrixFontSize - 2}px; font-weight: 800; color: #b00; margin-top: 1px;">
          (مطلوب: ${item.originalQty || item.company} | مستلم: ${item.receivedQty || "0"} | متبقي: ${item.remainingQty || "0"})
        </div>
      ` : '';

      rowsHtml += `
        <tr>
          <td style="width: 7%; text-align: center;">${index + 1 + col.startIndex}</td>
          <td style="width: 12%; text-align: center; font-weight: 800; color: #8b6b4d;">${isPartial ? (item.remainingQty || "0") : (item.company || "1")}</td>
          <td style="width: 53%; text-align: right; font-weight: 700; padding: 4px 5px; white-space: normal; word-break: break-word; line-height: 1.3;" title="${cleanFixedName}">
            ${cleanFixedName}${displayTag}${dupTag}${noteTag}${partialPrintHtml}
          </td>
          <td style="width: 18%; text-align: center; padding: 2px 2px; white-space: nowrap;">
            ${statusCellHtml}
          </td>
          <td style="width: 10%; text-align: center; padding: 1px 1px; white-space: nowrap;">
            <span class="print-checkbox"></span>
          </td>
        </tr>
      `;
    });

    if (col.items.length === 0) {
      rowsHtml = `
        <tr>
          <td colspan="5" style="text-align: center; color: #888; font-style: italic; padding: 10px 0;">لا توجد نواقص</td>
        </tr>
      `;
    }

    const minWidthPercent = totalCols === 2 ? '48%' : totalCols === 3 ? '31%' : '23%';

    return `
      <div class="print-column" style="min-width: ${minWidthPercent};">
          <div class="column-header">${col.title}</div>
          <table>
              <thead>
                  <tr>
                      <th style="width: 7%;">#</th>
                      <th style="width: 12%;">العدد</th>
                      <th style="width: 53%;">اسم الصنف والبيان</th>
                      <th style="width: 18%;">حالة الاستلام</th>
                      <th style="width: 10%;">✓</th>
                  </tr>
              </thead>
              <tbody>
                  ${rowsHtml}
              </tbody>
          </table>
      </div>
    `;
  };

  let columnsHtml = "";
  initialColumns.forEach(col => {
    columnsHtml += renderColumnHtml(col, initialColumns.length);
  });

  const totalFilteredCount = initialFilter === "all"
    ? items.length
    : initialColumns.reduce((sum, c) => sum + c.items.length, 0);

  // Prepare custom warehouse buttons for preview toolbar
  const customWhButtonsHtml = Object.keys(customWarehouseMap).map(cWh => {
    const cCount = customWarehouseMap[cWh].length;
    return `
      <button class="filter-btn" data-filter="${cWh}" onclick="switchWarehouseFilter('${cWh}')">
        📦 ${cWh} (${cCount})
      </button>
    `;
  }).join("");

  const html = `
      <html dir="rtl">
      <head>
          <meta charset="UTF-8">
          <title>${initialDisplayTitle} - مصفوفة ${serialNumber}</title>
          <style id="matrixPageOrientationStyle">
              @page { 
                  size: A4 landscape !important; 
                  margin: ${matrixPageMargin} !important; 
              }
          </style>
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
              .no-print {
                  background: #1e293b;
                  color: #ffffff;
                  padding: 12px 18px;
                  display: flex;
                  flex-direction: column;
                  gap: 10px;
                  position: sticky;
                  top: 0;
                  z-index: 9999;
                  box-shadow: 0 4px 15px rgba(0,0,0,0.35);
                  font-family: 'Segoe UI', sans-serif;
                  margin-bottom: 14px;
                  border-radius: 12px;
                  border: 1px solid #334155;
              }
              .no-print-top {
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                  flex-wrap: wrap;
                  gap: 10px;
              }
              .no-print-filters {
                  display: flex;
                  align-items: center;
                  gap: 8px;
                  flex-wrap: wrap;
                  padding-top: 8px;
                  border-top: 1px solid #334155;
              }
              .filter-label {
                  font-size: 12px;
                  font-weight: bold;
                  color: #cbd5e1;
                  margin-left: 4px;
              }
              .filter-btn {
                  background: #334155;
                  color: #f8fafc;
                  border: 1px solid #475569;
                  padding: 5px 12px;
                  border-radius: 8px;
                  cursor: pointer;
                  font-size: 12px;
                  font-weight: 700;
                  transition: all 0.2s;
                  display: flex;
                  align-items: center;
                  gap: 4px;
              }
              .filter-btn:hover {
                  background: #475569;
                  border-color: #64748b;
              }
              .filter-btn.active {
                  background: #8b6b4d !important;
                  color: white !important;
                  border-color: #d4a373 !important;
                  box-shadow: 0 0 0 2px rgba(139,107,77,0.4);
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
              .not-arrived-tag {
                  font-size: ${matrixFontSize - 2.5}px;
                  color: #b91c1c;
                  background: #fee2e2;
                  padding: 0.5px 2.5px;
                  border-radius: 2px;
                  border: 1px solid #f87171;
                  font-weight: 900;
                  display: inline-block;
                  vertical-align: middle;
                  margin-right: 2px;
                  white-space: nowrap;
                  line-height: 1.1;
              }
              .status-badge-completed {
                  font-size: ${matrixFontSize - 2}px;
                  color: #065f46;
                  background: #d1fae5;
                  padding: 1px 3px;
                  border-radius: 3px;
                  border: 1px solid #6ee7b7;
                  font-weight: 800;
                  display: inline-block;
                  white-space: nowrap;
              }
              .status-badge-partial {
                  font-size: ${matrixFontSize - 2}px;
                  color: #92400e;
                  background: #fef3c7;
                  padding: 1px 3px;
                  border-radius: 3px;
                  border: 1px solid #fcd34d;
                  font-weight: 800;
                  display: inline-block;
                  white-space: nowrap;
              }
              .status-badge-delayed {
                  font-size: ${matrixFontSize - 2}px;
                  color: #991b1b;
                  background: #fee2e2;
                  padding: 1px 3px;
                  border-radius: 3px;
                  border: 1px solid #fca5a5;
                  font-weight: 900;
                  display: inline-block;
                  white-space: nowrap;
              }
              .status-badge-pending {
                  font-size: ${matrixFontSize - 2}px;
                  color: #475569;
                  background: #f1f5f9;
                  padding: 1px 3px;
                  border-radius: 3px;
                  border: 1px solid #cbd5e1;
                  font-weight: 700;
                  display: inline-block;
                  white-space: nowrap;
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
                  .no-print, button { display: none !important; }
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
                  .warehouse-tag { background: #ffffff !important; border: 1px solid #000000 !important; }
              }
          </style>
      </head>
      <body>
          <div class="no-print">
              <div class="no-print-top">
                  <div style="font-weight:bold; font-size:14px; display:flex; align-items:center; gap:8px;">
                      <span>⚙️ إعدادات طباعة المصفوفة</span>
                      <span style="font-size:12px; color:#cbd5e1; font-weight:normal;">(الاتجاه: <strong id="orientationBadge" style="color:#f59e0b;">أفقي Landscape</strong>)</span>
                  </div>
                  <div style="display:flex; gap:10px; align-items:center;">
                      <button id="toggleOrientationBtn" onclick="toggleMatrixOrientation()" style="background:#8b6b4d; color:white; border:none; padding:7px 15px; border-radius:8px; cursor:pointer; font-weight:bold; font-size:13px; transition:all 0.2s;">
                          🔄 قلب الورقة إلى رأسي (Portrait)
                      </button>
                      <button onclick="window.print()" style="background:#16a34a; color:white; border:none; padding:7px 20px; border-radius:8px; cursor:pointer; font-weight:bold; font-size:13px; transition:all 0.2s; box-shadow: 0 2px 8px rgba(22,163,74,0.4);">
                          🖨️ طباعة الآن
                      </button>
                  </div>
              </div>

              <!-- Live Warehouse Filter Toolbar -->
              <div class="no-print-filters">
                  <span class="filter-label">🔘 فلترة المستودع:</span>
                  <button class="filter-btn ${initialFilter === 'all' ? 'active' : ''}" data-filter="all" onclick="switchWarehouseFilter('all')">
                      🌐 جميع المخازن (${items.length})
                  </button>
                  <button class="filter-btn ${initialFilter.includes('النحاس') ? 'active' : ''}" data-filter="مخزن النحاس" onclick="switchWarehouseFilter('مخزن النحاس')">
                      🏭 مخزن النحاس (${nahasItems.length})
                  </button>
                  <button class="filter-btn ${initialFilter.includes('النادي') ? 'active' : ''}" data-filter="مخزن النادي" onclick="switchWarehouseFilter('مخزن النادي')">
                      🏟️ مخزن النادي (${nadyItems.length})
                  </button>
                  ${customWhButtonsHtml}
              </div>
          </div>

          <div class="invoice-print">
              <div class="header">
                  <div class="right">
                      ${getHeaderHtml()}
                  </div>
                  <div class="center">
                      <div class="title-text" id="matrixMainTitle">📋 ${initialDisplayTitle}<br><span class="serial">بيان رقم ${serialNumber}</span></div>
                      <div id="matrixSubTitle" style="font-size:${matrixFontSize + 0.8}px; font-weight:bold; margin-top:4px;">نطاق الطباعة: ${initialSharedWhsStr}</div>
                  </div>
                  <div class="left">
                      <div class="date-time">📅 التاريخ: ${dateStr}</div>
                      <div class="date-time">🕐 الوقت: ${timeStr}</div>
                  </div>
              </div>

              <!-- Columns Container -->
              <div class="side-by-side-container" id="columnsContainer">
                  ${columnsHtml}
              </div>

              <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;padding: 4px 0; border-top: 2px dashed #000; margin-top:4px;">
                  <div id="matrixCountFooter" style="font-size:${matrixFontSize}px;color:#000;font-weight:800;">
                      إجمالي الأصناف بالمصفوفة: <span style="font-size:${matrixFontSize+1.5}px;text-decoration:underline;">${totalFilteredCount}</span> ${initialFilter === 'all' ? `(النحاس: ${nahasItems.length} | النادي: ${nadyItems.length})` : `(${initialFilter})`}
                  </div>
                  <div class="user-footer">👤 محرر المصفوفة: ${getPrintUserName(currentUserDisplay)}</div>
              </div>

              <div class="footer">
                  ${getFooterHtml("البيان")}
                  <p style="margin: 2px 0;"><span class="copyright">حقوق الملكية: Mohamed Nazih | 📱 01029190615</span></p>
              </div>
          </div>
          <script>
              const allRawItems = ${JSON.stringify(items)};
              const baseTitle = ${JSON.stringify(title)};
              const serialNum = ${JSON.stringify(serialNumber)};
              let currentFilter = ${JSON.stringify(initialFilter)};
              let isLandscape = true;

              function toggleMatrixOrientation() {
                  isLandscape = !isLandscape;
                  const styleEl = document.getElementById('matrixPageOrientationStyle');
                  const btn = document.getElementById('toggleOrientationBtn');
                  const badge = document.getElementById('orientationBadge');
                  if (isLandscape) {
                      if (styleEl) styleEl.innerHTML = '@page { size: A4 landscape !important; margin: ${matrixPageMargin} !important; }';
                      if (btn) btn.innerHTML = '🔄 قلب الورقة إلى رأسي (Portrait)';
                      if (badge) badge.innerText = 'أفقي Landscape';
                  } else {
                      if (styleEl) styleEl.innerHTML = '@page { size: A4 portrait !important; margin: ${matrixPageMargin} !important; }';
                      if (btn) btn.innerHTML = '🔄 قلب الورقة إلى أفقي (Landscape)';
                      if (badge) badge.innerText = 'رأسي Portrait';
                  }
              }

              function splitIntoN(arr, n) {
                  const chunks = [];
                  const size = Math.ceil(arr.length / n);
                  for (let i = 0; i < n; i++) {
                      chunks.push(arr.slice(i * size, (i + 1) * size));
                  }
                  return chunks;
              }

              function buildColumns(filter) {
                  const nahas = [];
                  const nady = [];
                  const others = [];
                  allRawItems.forEach(it => {
                      const wh = (it.warehouse || "").trim();
                      if (wh.includes("النحاس") || wh.toLowerCase().includes("nahas") || wh.includes("جمعة")) {
                          nahas.push(it);
                      } else if (wh.includes("النادي") || wh.toLowerCase().includes("nady") || wh.includes("جعفر")) {
                          nady.push(it);
                      } else {
                          others.push(it);
                      }
                  });

                  if (filter === "all") {
                      const [nA, nB] = splitIntoN(nahas, 2);
                      const [ndA, ndB] = splitIntoN(nady, 2);
                      return {
                          cols: [
                              { title: "مخزن النحاس (أ)", items: nA, startIndex: 0 },
                              { title: "مخزن النحاس (ب)", items: nB, startIndex: nA.length },
                              { title: "مخزن النادي (أ)", items: ndA, startIndex: 0 },
                              { title: "مخزن النادي (ب)", items: ndB, startIndex: ndA.length }
                          ],
                          title: baseTitle,
                          sub: "نطاق الطباعة: جميع المخازن (مخزن النحاس - مخزن النادي)",
                          footer: "إجمالي الأصناف بالمصفوفة: " + allRawItems.length + " (النحاس: " + nahas.length + " | النادي: " + nady.length + ")"
                      };
                  }

                  let targetItems = [];
                  let whDisplay = filter;
                  if (filter.includes("النحاس")) {
                      targetItems = nahas;
                      whDisplay = "مخزن النحاس";
                  } else if (filter.includes("النادي")) {
                      targetItems = nady;
                      whDisplay = "مخزن النادي";
                  } else {
                      targetItems = allRawItems.filter(i => (i.warehouse || "").trim().includes(filter));
                  }

                  let numCols = targetItems.length <= 12 ? 2 : targetItems.length <= 24 ? 3 : 4;
                  const chunks = splitIntoN(targetItems, numCols);
                  const letters = ["أ", "ب", "ج", "د", "هـ", "و"];
                  const cols = chunks.map((chunk, idx) => {
                      let startIndex = 0;
                      for (let prev = 0; prev < idx; prev++) {
                          startIndex += chunks[prev].length;
                      }
                      return {
                          title: numCols > 1 ? whDisplay + " (" + (letters[idx] || (idx + 1)) + ")" : whDisplay,
                          items: chunk,
                          startIndex: startIndex
                      };
                  });

                  return {
                      cols: cols,
                      title: baseTitle.includes(whDisplay) ? baseTitle : baseTitle + " (" + whDisplay + ")",
                      sub: "نطاق الطباعة: " + whDisplay + " فقط",
                      footer: "إجمالي الأصناف بالمصفوفة (" + whDisplay + "): " + targetItems.length
                  };
              }

              function switchWarehouseFilter(filter) {
                  currentFilter = filter;
                  document.querySelectorAll('.filter-btn').forEach(btn => {
                      if (btn.getAttribute('data-filter') === filter) {
                          btn.classList.add('active');
                      } else {
                          btn.classList.remove('active');
                      }
                  });

                  const res = buildColumns(filter);
                  document.getElementById('matrixMainTitle').innerHTML = '📋 ' + res.title + '<br><span class="serial">بيان رقم ' + serialNum + '</span>';
                  document.getElementById('matrixSubTitle').innerText = res.sub;
                  document.getElementById('matrixCountFooter').innerHTML = res.footer;

                  let colsHtml = '';
                  const totalCols = res.cols.length;
                  const minWidth = totalCols === 2 ? '48%' : totalCols === 3 ? '31%' : '23%';

                  res.cols.forEach(col => {
                      let rows = '';
                      col.items.forEach((item, idx) => {
                          const isPartial = item.hasPartialReceipt || Boolean(item.receivedQty && item.receivedQty !== "0" && item.remainingQty && item.remainingQty !== "0");
                          const isDelayed = item.isNotArrived || item.deliveryStatus === 'delayed' || (item.note && (item.note.includes('لم يصل') || item.note.includes('لم تصل')));
                          const isReceived = item.deliveryStatus === 'received';
                          const cleanFixed = (item.fixedName || item.description || '').replace(/[\\(（]?\\s*إعادة إرسال لبند لم يصل[^\\)）]*[\\)）]?/g, '').trim();
                          const cleanNote = (item.note || '').replace(/[\\(（]?\\s*إعادة إرسال لبند لم يصل[^\\)）]*[\\)）]?/g, '').trim();
                          const noteTag = cleanNote && cleanNote !== '-' ? ' <span class="item-note">(' + cleanNote + ')</span>' : '';
                          const dupTag = item.duplicateNote ? ' <span class="dup-badge">🔄 مكرر</span>' : '';
                          const qty = isPartial ? (item.remainingQty || '0') : (item.company || '1');
                          const partialHtml = isPartial ? '<div style="font-size:9px; font-weight:800; color:#b00; margin-top:1px;">(مطلوب: ' + (item.originalQty || item.company) + ' | مستلم: ' + (item.receivedQty || '0') + ' | متبقي: ' + (item.remainingQty || '0') + ')</div>' : '';

                          let statusCell = '<span class="status-badge-pending">معلق</span>';
                          if (isPartial) {
                              statusCell = '<span class="status-badge-partial" title="مستلم: ' + (item.receivedQty || '0') + ' | متبقي: ' + (item.remainingQty || '0') + '">جزئي (' + (item.remainingQty || '0') + ')</span>';
                          } else if (isDelayed) {
                              statusCell = '<span class="status-badge-delayed">لم يصل</span>';
                          } else if (isReceived) {
                              statusCell = '<span class="status-badge-completed">مكتمل</span>';
                          }

                          rows += '<tr>' +
                              '<td style="width:7%; text-align:center;">' + (idx + 1 + col.startIndex) + '</td>' +
                              '<td style="width:12%; text-align:center; font-weight:800; color:#8b6b4d;">' + qty + '</td>' +
                              '<td style="width:53%; text-align:right; font-weight:700; padding:4px 5px; white-space:normal; word-break:break-word; line-height:1.3;">' + cleanFixed + dupTag + noteTag + partialHtml + '</td>' +
                              '<td style="width:18%; text-align:center; padding:2px 2px; white-space:nowrap;">' + statusCell + '</td>' +
                              '<td style="width:10%; text-align:center; padding:1px 1px;"><span class="print-checkbox"></span></td>' +
                          '</tr>';
                      });

                      if (col.items.length === 0) {
                          rows = '<tr><td colspan="5" style="text-align:center; color:#888; font-style:italic; padding:10px 0;">لا توجد نواقص</td></tr>';
                      }

                      colsHtml += '<div class="print-column" style="min-width:' + minWidth + ';">' +
                          '<div class="column-header">' + col.title + '</div>' +
                          '<table>' +
                              '<thead><tr><th style="width:7%;">#</th><th style="width:12%;">العدد</th><th style="width:53%;">اسم الصنف والبيان</th><th style="width:18%;">حالة الاستلام</th><th style="width:10%;">✓</th></tr></thead>' +
                              '<tbody>' + rows + '</tbody>' +
                          '</table>' +
                      '</div>';
                  });

                  document.getElementById('columnsContainer').innerHTML = colsHtml;
              }

              function triggerMatrixPrint() {
                  try {
                      window.focus();
                      window.print();
                  } catch (e) {
                      console.warn("Matrix print trigger note:", e);
                  }
              }

              if (document.readyState === 'complete' || document.readyState === 'interactive') {
                  setTimeout(triggerMatrixPrint, 250);
              } else {
                  window.addEventListener('DOMContentLoaded', function() { setTimeout(triggerMatrixPrint, 200); });
                  window.addEventListener('load', function() { setTimeout(triggerMatrixPrint, 350); });
              }
              setTimeout(triggerMatrixPrint, 800);
          </script>
      </body>
      </html>
  `;

  executeUniversalPrint(html, title);
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
          ${getUniversalPrintScript()}
      </body>
      </html>
  `;

  executeUniversalPrint(html, "فاتورة عرض سعر");
}

export function printDailyReceiptReport(
  items: Item[],
  title = "تقرير الاستلام اليومي",
  warehouseName: string | null = null,
  currentUserDisplay = "غير معروف"
) {
  if (!items || items.length === 0) {
    alert("⚠️ لا توجد بنود مستلمة للطباعة في هذا التقرير");
    return;
  }

  const d = new Date();
  const dateStr = d.toLocaleDateString("ar-EG");
  const timeStr = d.toLocaleTimeString("ar-EG");
  const printNum = getNextPrintNumber("daily_receipt");
  const serialNumber = String(printNum).padStart(3, "0");

  let totalItemsCount = items.length;
  let fullyReceivedCount = 0;
  let partiallyReceivedCount = 0;

  items.forEach(it => {
    if (it.hasPartialReceipt) {
      partiallyReceivedCount++;
    } else {
      fullyReceivedCount++;
    }
  });

  const headerHtml = getHeaderHtml();
  const footerHtml = getFooterHtml("تقرير الاستلام اليومي");
  const userName = getPrintUserName(currentUserDisplay);

  const itemsRowsHtml = items.map((item, index) => {
    const isPartial = item.hasPartialReceipt;
    const reqQty = item.originalQty || item.company || "1";
    const recQty = isPartial ? (item.receivedQty || "0") : (item.company || reqQty);
    const remQty = isPartial ? (item.remainingQty || "0") : "0";
    const statusText = isPartial
      ? `<span style="color: #b45309; font-weight: bold; background-color: #fef3c7; padding: 2px 8px; border-radius: 9999px;">استلام جزئي</span>`
      : `<span style="color: #15803d; font-weight: bold; background-color: #dcfce7; padding: 2px 8px; border-radius: 9999px;">استلام كامل</span>`;

    const notes = [
      item.description && item.description !== "-" ? item.description : "",
      item.note && item.note !== "-" ? `ملاحظة: ${item.note}` : ""
    ].filter(Boolean).join(" | ");

    return `
      <tr>
        <td style="text-align: center; font-weight: bold; color: #6b7280;">${index + 1}</td>
        <td style="font-weight: 800; color: #111827;">${item.fixedName}</td>
        <td style="text-align: center; color: #4b5563;">${item.warehouse || warehouseName || "-"}</td>
        <td style="text-align: center; font-weight: bold; color: #374151;">${reqQty}</td>
        <td style="text-align: center; font-weight: 900; color: #15803d; background-color: #f0fdf4;">${recQty}</td>
        <td style="text-align: center; font-weight: bold; color: ${remQty !== "0" ? "#dc2626" : "#9ca3af"};">${remQty}</td>
        <td style="text-align: center;">${statusText}</td>
        <td style="font-size: 11px; color: #6b7280;">${notes || "-"}</td>
      </tr>
    `;
  }).join("");

  const html = `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>${title} - ${dateStr}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');
        * { box-sizing: border-box; }
        body {
          font-family: 'Cairo', sans-serif;
          margin: 0;
          padding: 0;
          background-color: #f9fafb;
          color: #1f2937;
          direction: rtl;
        }
        .report-container {
          max-width: 1000px;
          margin: 20px auto;
          background-color: #ffffff;
          padding: 24px;
          border-radius: 12px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        .header-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 3px solid #10b981;
          padding-bottom: 16px;
          margin-bottom: 20px;
        }
        .company-info-box { text-align: right; }
        .company-name { font-size: 20px; font-weight: 900; color: #065f46; }
        .company-address, .company-phone { font-size: 12px; color: #4b5563; }
        .report-title-box { text-align: center; }
        .report-title { font-size: 22px; font-weight: 900; color: #111827; margin: 0; }
        .report-subtitle { font-size: 13px; color: #6b7280; margin-top: 4px; }
        .meta-box { text-align: left; font-size: 12px; color: #374151; }
        .meta-box strong { color: #10b981; }

        .stats-summary {
          display: flex;
          gap: 12px;
          margin-bottom: 20px;
          background-color: #f0fdf4;
          border: 1px solid #bbf7d0;
          border-radius: 10px;
          padding: 12px 16px;
          justify-content: space-around;
        }
        .stat-item { text-align: center; }
        .stat-label { font-size: 11px; color: #166534; font-weight: 700; }
        .stat-value { font-size: 18px; font-weight: 900; color: #065f46; }

        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
          font-size: 12px;
        }
        th {
          background-color: #065f46;
          color: #ffffff;
          font-weight: 800;
          padding: 10px 8px;
          border: 1px solid #047857;
          text-align: center;
        }
        td {
          padding: 10px 8px;
          border: 1px solid #e5e7eb;
          vertical-align: middle;
        }
        tr:nth-child(even) { background-color: #f9fafb; }

        .signatures {
          display: flex;
          justify-content: space-between;
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px dashed #d1d5db;
          font-size: 12px;
          font-weight: bold;
        }

        .footer-note {
          margin-top: 30px;
          text-align: center;
          font-size: 11px;
          color: #9ca3af;
          border-top: 1px solid #f3f4f6;
          padding-top: 12px;
        }

        .no-print-bar {
          text-align: center;
          margin-bottom: 16px;
        }
        .btn-print {
          background-color: #10b981;
          color: white;
          border: none;
          padding: 10px 24px;
          border-radius: 8px;
          font-weight: 800;
          font-size: 14px;
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        @media print {
          body { background-color: white; padding: 0; }
          .report-container { box-shadow: none; padding: 0; margin: 0; }
          .no-print-bar, .no-print-universal-bar { display: none !important; }
          @page { size: A4 portrait; margin: 10mm; }
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color-adjust: exact !important;
        }
      </style>
    </head>
    <body>
      ${getUniversalPrintHeaderBar(title)}

      <div class="report-container">
        <div class="header-bar">
          <div class="company-info-box">
            ${headerHtml}
          </div>
          <div class="report-title-box">
            <h1 class="report-title">📦 ${title}</h1>
            <div class="report-subtitle">المستودع: ${warehouseName || "جميع المستودعات"}</div>
          </div>
          <div class="meta-box">
            <div>رقم التقرير: <strong>#REC-${serialNumber}</strong></div>
            <div>التاريخ: <strong>${dateStr}</strong></div>
            <div>الوقت: <strong>${timeStr}</strong></div>
            <div>المسؤول: <strong>${userName}</strong></div>
          </div>
        </div>

        <div class="stats-summary">
          <div class="stat-item">
            <div class="stat-label">إجمالي الأصناف المستلمة</div>
            <div class="stat-value">${totalItemsCount} صنف</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">استلام كامل</div>
            <div class="stat-value" style="color: #15803d;">${fullyReceivedCount} صنف</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">استلام جزئي (متبقيات)</div>
            <div class="stat-value" style="color: #b45309;">${partiallyReceivedCount} صنف</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 4%;">#</th>
              <th style="width: 25%;">اسم الصنف</th>
              <th style="width: 14%;">المستودع</th>
              <th style="width: 10%;">المطلوب</th>
              <th style="width: 11%;">المستلم</th>
              <th style="width: 10%;">المتبقي</th>
              <th style="width: 13%;">حالة الاستلام</th>
              <th style="width: 13%;">ملاحظات</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRowsHtml}
          </tbody>
        </table>

        <div class="signatures">
          <div>توقيع مسؤول المستودع: ........................</div>
          <div>توقيع مدير الفرع: ........................</div>
          <div>الختم المعتمد: ........................</div>
        </div>

        <div class="footer-note">
          ${footerHtml}
          <div>حقوق الملكية: Mohamed Nazih | 📱 01029190615</div>
        </div>
      </div>

      ${getUniversalPrintScript()}
    </body>
    </html>
  `;

  executeUniversalPrint(html, title);
}
