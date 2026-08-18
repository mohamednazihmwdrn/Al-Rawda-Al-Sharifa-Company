import * as XLSX from "xlsx";

/**
 * Helper to auto-fit column widths in an XLSX worksheet
 */
function setAutoColWidths(ws: XLSX.WorkSheet, data: any[][]) {
  if (!data || data.length === 0) return;
  const colWidths = data[0].map((_, colIdx) => {
    let maxLen = 10;
    for (let rowIdx = 0; rowIdx < data.length; rowIdx++) {
      const cellVal = data[rowIdx][colIdx];
      if (cellVal !== null && cellVal !== undefined) {
        const strLen = String(cellVal).length;
        // Arabic characters look wider visually
        if (strLen > maxLen) maxLen = Math.min(strLen + 3, 50);
      }
    }
    return { wch: maxLen };
  });
  ws["!cols"] = colWidths;
}

/**
 * Exports data to CSV file with UTF-8 BOM encoding for complete Arabic character support
 */
export function exportToCsv(
  data: any[], 
  headers: string[], 
  rowMapper: (item: any, index: number) => any[], 
  filename = "تقرير"
): void {
  if (!data || data.length === 0) {
    alert("⚠️ لا توجد بيانات متاحة للتصدير.");
    return;
  }

  const rows = [headers, ...data.map((item, idx) => rowMapper(item, idx))];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const csvOutput = XLSX.utils.sheet_to_csv(ws);

  // Prepend UTF-8 BOM so Excel opens CSV without corrupted Arabic letters
  const blob = new Blob(["\uFEFF" + csvOutput], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, `${filename}.csv`);
}

/**
 * Exports a dataset to a real native Excel file (.xlsx) using SheetJS
 */
export function exportTableToXlsx(
  sheetName: string,
  headers: string[],
  rows: (string | number)[][],
  filename = "تقرير_اكسل"
): void {
  if (!rows || rows.length === 0) {
    alert("⚠️ لا توجد بيانات متاحة للتصدير.");
    return;
  }

  const aoa = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  setAutoColWidths(ws, aoa);

  // Set Right-to-Left viewing for Arabic
  if (!ws["!views"]) ws["!views"] = [];
  ws["!views"].push({ RTL: true });

  const wb = XLSX.utils.book_new();
  const safeSheetName = sheetName.replace(/[:\\/?*\[\]]/g, "_").slice(0, 30);
  XLSX.utils.book_append_sheet(wb, ws, safeSheetName);

  XLSX.writeFile(wb, `${filename}.xlsx`);
}

/**
 * Triggers file download in the browser for Blob objects
 */
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

/**
 * Standard Item Export to CSV (Backward compatible)
 */
export function exportExcel(items: any[], filename = "نواقص") {
  if (!items || items.length === 0) {
    alert("⚠️ لا توجد بيانات للتصدير");
    return;
  }

  const headers = ["م", "المخزن", "اسم الصنف", "الكمية / العدد", "المواصفات والبيان", "ملاحظات", "التاريخ", "الحالة"];
  
  exportToCsv(items, headers, (item, idx) => [
    idx + 1,
    item.warehouse || item.source || "-",
    item.fixedName || "-",
    item.company || "1",
    item.description || "-",
    item.note || "-",
    item.date || "-",
    item.status === "approved" ? "معتمد" : (item.status === "received" ? "مستلم" : "بانتظار الاعتماد")
  ], filename);
}

/**
 * Export specific single Daily Report to .xlsx or .csv
 */
export function exportSingleReport(report: any, format: "csv" | "excel" = "excel") {
  if (!report || !report.items || report.items.length === 0) {
    alert("⚠️ التقرير لا يحتوي على أي بنود للتصدير.");
    return;
  }

  const safeDate = (report.date || "اليوم").replace(/[\/\\]/g, "-");
  const filename = `تقرير_نواقص_${safeDate}`;
  const headers = ["م", "المخزن", "اسم الصنف", "الكمية / العدد", "المواصفات والبيان", "ملاحظات", "تاريخ البند", "وقت التسجيل"];

  const rows = report.items.map((item: any, idx: number) => [
    idx + 1,
    item.warehouse || report.warehouse || "-",
    item.fixedName || "-",
    item.company || "1",
    item.description || "-",
    item.note || "-",
    item.date || report.date || "-",
    item.time || report.time || "-"
  ]);

  if (format === "excel") {
    exportTableToXlsx(`تقرير ${report.date}`, headers, rows, filename);
  } else {
    exportToCsv(report.items, headers, (item, idx) => [
      idx + 1,
      item.warehouse || report.warehouse || "-",
      item.fixedName || "-",
      item.company || "1",
      item.description || "-",
      item.note || "-",
      item.date || report.date || "-",
      item.time || report.time || "-"
    ], filename);
  }
}

/**
 * Export Summary Table of all Daily Reports to .xlsx or .csv
 */
export function exportReportsSummary(reports: any[], format: "csv" | "excel" = "excel") {
  if (!reports || reports.length === 0) {
    alert("⚠️ لا توجد تقارير متاحة للتصدير.");
    return;
  }

  const filename = "جدول_ملخص_التقارير_اليومية";
  const headers = ["م", "تاريخ التقرير", "وقت الترحيل", "المخازن المشمولة", "إجمالي عدد البنود", "إجمالي الكميات"];

  const rows = reports.map((rep: any, idx: number) => {
    const totalQty = (rep.items || []).reduce((acc: number, curr: any) => {
      const num = parseFloat(curr.company);
      return acc + (isNaN(num) ? 1 : num);
    }, 0);

    return [
      idx + 1,
      rep.date || "-",
      rep.time || "-",
      rep.warehouse || "جميع المخازن",
      rep.total || (rep.items || []).length || 0,
      totalQty
    ];
  });

  if (format === "excel") {
    exportTableToXlsx("ملخص التقارير", headers, rows, filename);
  } else {
    exportToCsv(reports, headers, (rep, idx) => {
      const totalQty = (rep.items || []).reduce((acc: number, curr: any) => {
        const num = parseFloat(curr.company);
        return acc + (isNaN(num) ? 1 : num);
      }, 0);

      return [
        idx + 1,
        rep.date || "-",
        rep.time || "-",
        rep.warehouse || "جميع المخازن",
        rep.total || (rep.items || []).length || 0,
        totalQty
      ];
    }, filename);
  }
}

/**
 * Export Comprehensive Multi-Sheet Master Workbook (.xlsx) with all reports & items
 */
export function exportAllReportsWorkbookXlsx(reports: any[], filename = "المصنف_الكامل_للتقارير_اليومية") {
  if (!reports || reports.length === 0) {
    alert("⚠️ لا توجد تقارير متاحة للتصدير.");
    return;
  }

  const wb = XLSX.utils.book_new();

  // 1. Summary Sheet
  const summaryHeaders = ["م", "تاريخ التقرير", "وقت الترحيل", "المخازن المشمولة", "إجمالي عدد البنود", "إجمالي الكميات"];
  const summaryRows = reports.map((rep: any, idx: number) => {
    const totalQty = (rep.items || []).reduce((acc: number, curr: any) => {
      const num = parseFloat(curr.company);
      return acc + (isNaN(num) ? 1 : num);
    }, 0);

    return [
      idx + 1,
      rep.date || "-",
      rep.time || "-",
      rep.warehouse || "جميع المخازن",
      rep.total || (rep.items || []).length || 0,
      totalQty
    ];
  });

  const wsSummary = XLSX.utils.aoa_to_sheet([summaryHeaders, ...summaryRows]);
  setAutoColWidths(wsSummary, [summaryHeaders, ...summaryRows]);
  XLSX.utils.book_append_sheet(wb, wsSummary, "ملخص التقارير");

  // 2. All Items Sheet
  const allItems: any[] = [];
  reports.forEach(rep => {
    (rep.items || []).forEach((it: any) => {
      allItems.push({
        ...it,
        reportDate: rep.date,
        reportTime: rep.time,
        reportWarehouse: rep.warehouse
      });
    });
  });

  if (allItems.length > 0) {
    const itemsHeaders = ["م", "تاريخ التقرير", "المخزن", "اسم الصنف", "الكمية / العدد", "المواصفات والبيان", "ملاحظات", "وقت الترحيل"];
    const itemsRows = allItems.map((item, idx) => [
      idx + 1,
      item.reportDate || item.date || "-",
      item.warehouse || item.reportWarehouse || "-",
      item.fixedName || "-",
      item.company || "1",
      item.description || "-",
      item.note || "-",
      item.reportTime || item.time || "-"
    ]);

    const wsItems = XLSX.utils.aoa_to_sheet([itemsHeaders, ...itemsRows]);
    setAutoColWidths(wsItems, [itemsHeaders, ...itemsRows]);
    XLSX.utils.book_append_sheet(wb, wsItems, "كافة بنود النواقص");
  }

  XLSX.writeFile(wb, `${filename}.xlsx`);
}

/**
 * Export Detailed Table of all items in all Daily Reports
 */
export function exportAllReportsDetailed(reports: any[], format: "csv" | "excel" = "excel") {
  const allItems: any[] = [];
  reports.forEach(rep => {
    (rep.items || []).forEach((it: any) => {
      allItems.push({
        ...it,
        reportDate: rep.date,
        reportTime: rep.time,
        reportWarehouse: rep.warehouse
      });
    });
  });

  if (allItems.length === 0) {
    alert("⚠️ لا توجد بنود في التقارير للتصدير.");
    return;
  }

  const filename = "سجل_جميع_بنود_التقارير_اليومية";
  const headers = ["م", "تاريخ التقرير", "المخزن", "اسم الصنف", "الكمية / العدد", "المواصفات والبيان", "ملاحظات", "وقت الترحيل"];

  const rows = allItems.map((item, idx) => [
    idx + 1,
    item.reportDate || item.date || "-",
    item.warehouse || item.reportWarehouse || "-",
    item.fixedName || "-",
    item.company || "1",
    item.description || "-",
    item.note || "-",
    item.reportTime || item.time || "-"
  ]);

  if (format === "excel") {
    exportTableToXlsx("سجل بنود التقارير", headers, rows, filename);
  } else {
    exportToCsv(allItems, headers, (item, idx) => [
      idx + 1,
      item.reportDate || item.date || "-",
      item.warehouse || item.reportWarehouse || "-",
      item.fixedName || "-",
      item.company || "1",
      item.description || "-",
      item.note || "-",
      item.reportTime || item.time || "-"
    ], filename);
  }
}
