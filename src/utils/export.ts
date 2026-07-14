export function exportExcel(items: any[], filename = "نواقص") {
  if (!items || items.length === 0) {
    alert("⚠️ لا توجد بيانات للتصدير");
    return;
  }

  const columns = ["الشركة", "الاسم الثابت", "الصنف", "ملاحظة", "المخزن", "التاريخ"];
  let csv = columns.join(",") + "\n";

  items.forEach(item => {
    const row = [
      item.company || "",
      item.fixedName || "",
      item.description || "",
      item.note || "",
      item.warehouse || item.source || "",
      item.date || ""
    ];
    const escapedRow = row.map(val => `"${val.replace(/"/g, '""')}"`);
    csv += escapedRow.join(",") + "\n";
  });

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
