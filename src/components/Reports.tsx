import React, { useState } from "react";
import { User, Report } from "../types";
import { printInvoice, printMatrix } from "../utils/print";
import { 
  exportExcel, 
  exportSingleReport, 
  exportReportsSummary, 
  exportAllReportsDetailed,
  exportAllReportsWorkbookXlsx
} from "../utils/export";
import { compareDatesDescending } from "../utils/date";
import PrintMatrixFilterModal from "./PrintMatrixFilterModal";

interface ReportsProps {
  currentUser: User;
  reports: Report[];
  onDeleteReport: (id: string) => void;
  onViewDetails: (
    title: string,
    items: any[],
    onDeleteItem?: (index: number) => void,
    onEditItem?: (index: number, updatedItem: any) => void
  ) => void;
  onDeleteItemFromReport?: (reportId: string, itemIndex: number) => void;
  onEditItemInReport?: (reportId: string, itemIndex: number, updatedFields: any) => void;
  onUpdateReport?: (updatedReport: Report) => void;
  onAddItemToReport?: (reportId: string, itemData: any) => void;
}

export default function Reports({
  currentUser,
  reports,
  onDeleteReport,
  onViewDetails,
  onDeleteItemFromReport,
  onEditItemInReport,
  onUpdateReport,
  onAddItemToReport
}: ReportsProps) {
  const isManager = currentUser.role === "مدير";
  const [editingReport, setEditingReport] = useState<Report | null>(null);
  const [addItemReportModal, setAddItemReportModal] = useState<Report | null>(null);
  const [matrixModalData, setMatrixModalData] = useState<{ items: any[]; title: string; defaultWarehouse?: string } | null>(null);
  const [modalWarehouse, setModalWarehouse] = useState("مخزن النحاس");
  const [modalCustomWarehouse, setModalCustomWarehouse] = useState("");
  const [modalQty, setModalQty] = useState("");
  const [modalFixed, setModalFixed] = useState("");
  const [modalDesc, setModalDesc] = useState("");
  const [modalNote, setModalNote] = useState("");

  const defaultWarehouses = ["مخزن النحاس", "مخزن النادي", "مخزن المدير"];
  const availableWarehouses = Array.from(new Set([
    ...defaultWarehouses,
    ...reports.flatMap(r => r.items.map(i => i.warehouse)).filter(Boolean)
  ])).filter(w => w !== "جميع المخازن" && w !== "غير محدد");

  const handleModalAddSubmit = () => {
    if (!addItemReportModal) return;
    const selectedWh = modalWarehouse === "CUSTOM_WAREHOUSE" ? modalCustomWarehouse.trim() : modalWarehouse.trim();
    if (!selectedWh) {
      alert("⚠️ يرجى اختيار أو إدخال اسم المخزن!");
      return;
    }
    if (!modalFixed.trim()) {
      alert("⚠️ يرجى إدخال اسم الصنف!");
      return;
    }

    onAddItemToReport?.(addItemReportModal.id, {
      warehouse: selectedWh,
      company: modalQty.trim() || "-",
      fixedName: modalFixed.trim(),
      description: modalDesc.trim() || "-",
      note: modalNote.trim(),
    });

    setAddItemReportModal(null);
    setModalQty("");
    setModalFixed("");
    setModalDesc("");
    setModalNote("");
    setModalCustomWarehouse("");
  };

  const handleExportAll = () => {
    const allItems: any[] = [];
    reports.forEach(report => {
      report.items.forEach(item => {
        allItems.push({
          ...item,
          reportDate: report.date
        });
      });
    });

    if (allItems.length === 0) {
      alert("⚠️ لا توجد تقارير للتصدير!");
      return;
    }
    exportExcel(allItems, "جميع_التقارير_اليومية");
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6 pb-4 border-b border-gray-100">
        <div>
          <h2 className="text-xl font-bold text-gray-800 border-r-4 border-[#8b6b4d] pr-3">📄 التقارير اليومية المؤرشفة</h2>
          <p className="text-xs text-gray-400 mt-1">التقارير المرحلة تلقائياً الساعة 10 مساءً أو يدوياً من المدير مع إمكانية تصديرها كـ CSV / Excel</p>
        </div>
        {reports.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => exportAllReportsWorkbookXlsx(reports)}
              className="bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-black p-2.5 px-3.5 rounded-xl cursor-pointer transition-all flex items-center gap-1.5 shadow-sm"
              title="تصدير مصنف إكسل كامل متعدد الأوراق (ملخص + كافة البنود)"
            >
              <span>📗</span>
              <span>مصنف Excel شامل (.xlsx)</span>
            </button>
            <button
              onClick={() => exportReportsSummary(reports, "excel")}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold p-2.5 px-3 rounded-xl cursor-pointer transition-all flex items-center gap-1.5 shadow-xs"
              title="تصدير جدول ملخص التقارير اليومية بصيغة Excel"
            >
              <span>📊</span>
              <span>ملخص التقارير (Excel)</span>
            </button>
            <button
              onClick={() => exportAllReportsDetailed(reports, "excel")}
              className="bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold p-2.5 px-3 rounded-xl cursor-pointer transition-all flex items-center gap-1.5 shadow-xs"
              title="تصدير كافة بنود وأصناف التقارير كجدول Excel"
            >
              <span>📑</span>
              <span>كافة البنود (Excel)</span>
            </button>
            <button
              onClick={() => exportAllReportsDetailed(reports, "csv")}
              className="bg-[#8b6b4d] hover:bg-[#6d4f34] text-white text-xs font-bold p-2.5 px-3 rounded-xl cursor-pointer transition-all flex items-center gap-1.5 shadow-xs"
              title="تصدير كافة بنود وأصناف التقارير كملف CSV يدعم العربي"
            >
              <span>📥</span>
              <span>كافة البنود (CSV)</span>
            </button>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {reports.length === 0 ? (
          <p className="text-gray-400 text-center py-10">لا توجد تقارير مؤرشفة حالياً بالمنظومة.</p>
        ) : (
          [...reports].sort(compareDatesDescending).map((report, idx) => (
            <div key={`${report.id}-${idx}`} className="bg-[#f5f2ed]/45 p-4 rounded-2xl border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <strong className="text-gray-800 text-sm">📄 تقرير النواقص اليومي - {report.date}</strong>
                <div className="text-xs text-gray-500 mt-1 flex gap-3">
                  <span>تاريخ النشر: {report.date} {report.time}</span>
                  <span>المخازن المشمولة: {report.warehouse}</span>
                  <span className="text-[#8b6b4d] font-bold">إجمالي: {report.total} بند</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 w-full md:w-auto">
                <button
                  onClick={() => onViewDetails(
                    `تقرير اليوم - ${report.date}`,
                    report.items,
                    onDeleteItemFromReport ? (index) => onDeleteItemFromReport(report.id, index) : undefined,
                    onEditItemInReport ? (index, fields) => onEditItemInReport(report.id, index, fields) : undefined
                  )}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold p-2 px-3 rounded-lg cursor-pointer transition-all"
                >
                  👁️ عرض البنود
                </button>
                <button
                  onClick={() => printInvoice(report.items, `تقرير اليوم - ${report.date}`, report.warehouse || "جميع المخازن", currentUser.displayName || currentUser.username)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold p-2 px-3 rounded-lg cursor-pointer transition-all"
                >
                  🖨️ طباعة
                </button>
                <button
                  onClick={() => setMatrixModalData({ items: report.items, title: `تقرير اليوم - ${report.date}`, defaultWarehouse: report.warehouse || "جميع المخازن" })}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold p-2 px-3 rounded-lg cursor-pointer transition-all"
                  title="طباعة مصفوفة النواقص مع خيارات الفلترة"
                >
                  ⊞ طباعة مصفوفة
                </button>
                <button
                  onClick={() => exportSingleReport(report, "csv")}
                  className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold p-2 px-3 rounded-lg cursor-pointer transition-all flex items-center gap-1"
                  title="تصدير بنود هذا التقرير كملف CSV"
                >
                  <span>📥</span>
                  <span>CSV</span>
                </button>
                <button
                  onClick={() => exportSingleReport(report, "excel")}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold p-2 px-3 rounded-lg cursor-pointer transition-all flex items-center gap-1"
                  title="تصدير بنود هذا التقرير كجدول Excel"
                >
                  <span>📊</span>
                  <span>Excel</span>
                </button>
                <button
                  onClick={() => setAddItemReportModal(report)}
                  className="bg-amber-500 hover:bg-amber-600 text-amber-950 text-xs font-bold p-2 px-3 rounded-lg cursor-pointer transition-all"
                >
                  ✏️ إضافة صنف
                </button>
                {isManager && (
                  <button
                    onClick={() => setEditingReport(report)}
                    className="bg-[#8b6b4d] hover:bg-[#6d4f34] text-white text-xs font-bold p-2 px-3 rounded-lg cursor-pointer transition-all"
                  >
                    ✏️ تعديل التقرير
                  </button>
                )}
                {isManager && (
                  <button
                    onClick={() => confirm("تأكيد حذف التقرير نهائياً؟") && onDeleteReport(report.id)}
                    className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold p-2 px-3 rounded-lg cursor-pointer transition-all"
                  >
                    🗑️ حذف
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Edit Report Modal */}
      {editingReport && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-[10000] p-4">
          <div className="bg-white p-6 rounded-2xl max-w-md w-full shadow-2xl space-y-4 text-right" dir="rtl">
            <h3 className="text-[#8b6b4d] font-bold text-lg border-b pb-2 flex items-center gap-2">
              <span>✏️ تعديل بيانات التقرير</span>
            </h3>
            
            <div className="space-y-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-600">التاريخ</label>
                <input
                  type="text"
                  value={editingReport.date}
                  onChange={(e) => setEditingReport({ ...editingReport, date: e.target.value })}
                  className="p-2 border rounded-lg focus:outline-[#8b6b4d] text-sm"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-600">الوقت</label>
                <input
                  type="text"
                  value={editingReport.time}
                  onChange={(e) => setEditingReport({ ...editingReport, time: e.target.value })}
                  className="p-2 border rounded-lg focus:outline-[#8b6b4d] text-sm"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-600">المخازن المشمولة</label>
                <input
                  type="text"
                  value={editingReport.warehouse}
                  onChange={(e) => setEditingReport({ ...editingReport, warehouse: e.target.value })}
                  className="p-2 border rounded-lg focus:outline-[#8b6b4d] text-sm"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={async () => {
                  if (onUpdateReport) {
                    await onUpdateReport(editingReport);
                    setEditingReport(null);
                    alert("✅ تم تعديل بيانات التقرير بنجاح!");
                  }
                }}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm cursor-pointer"
              >
                حفظ التعديلات
              </button>
              <button
                onClick={() => setEditingReport(null)}
                className="flex-1 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-xl text-sm cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Add Item Modal for Report */}
      {addItemReportModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-[10000] p-4">
          <div className="bg-white p-6 rounded-2xl max-w-md w-full shadow-2xl animate-fade-in-up border border-[#d4b48c]/30 space-y-4 text-right" dir="rtl">
            <h3 className="text-[#8b6b4d] font-bold text-lg border-b pb-2 flex items-center gap-2">
              <span>➕ إضافة صنف إلى تقرير يوم {addItemReportModal.date}</span>
            </h3>

            <div className="space-y-3">
              {/* Warehouse selector */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-700">🏢 اختيار المخزن المعني <span className="text-red-500">*</span></label>
                <select
                  value={modalWarehouse}
                  onChange={(e) => setModalWarehouse(e.target.value)}
                  className="p-2.5 border border-gray-300 rounded-xl focus:outline-[#8b6b4d] bg-white text-sm font-semibold"
                >
                  {availableWarehouses.map(wh => (
                    <option key={wh} value={wh}>{wh}</option>
                  ))}
                  <option value="CUSTOM_WAREHOUSE">🏢 مخزن آخر (إدخال يدوي...)</option>
                </select>
                {modalWarehouse === "CUSTOM_WAREHOUSE" && (
                  <input
                    type="text"
                    placeholder="اكتب اسم المخزن الجديد..."
                    value={modalCustomWarehouse}
                    onChange={(e) => setModalCustomWarehouse(e.target.value)}
                    className="p-2 border border-amber-300 bg-amber-50/50 rounded-lg text-sm mt-1 focus:outline-[#8b6b4d]"
                  />
                )}
              </div>

              {/* Quantity / العدد */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-700">🔢 العدد (الكمية المطلوب إدراجها) <span className="text-gray-400 font-normal">(اختياري)</span></label>
                <input
                  type="text"
                  placeholder="مثال: 10 أو 5 كرتونة... (أو اتركه فارغاً)"
                  value={modalQty}
                  onChange={(e) => setModalQty(e.target.value)}
                  className="p-2.5 border border-gray-300 rounded-xl focus:outline-[#8b6b4d] text-sm font-semibold"
                />
              </div>

              {/* Item Name / اسم الصنف */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-700">📦 اسم الصنف <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  placeholder="مثال: معجون دايتون GLC / كابل تايب سي..."
                  value={modalFixed}
                  onChange={(e) => setModalFixed(e.target.value)}
                  className="p-2.5 border border-gray-300 rounded-xl focus:outline-[#8b6b4d] text-sm font-semibold"
                />
              </div>

              {/* Description / الوصف والتفاصيل */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-600">📝 الوصف / التفاصيل (اختياري)</label>
                <input
                  type="text"
                  placeholder="تفاصيل إضافية..."
                  value={modalDesc}
                  onChange={(e) => setModalDesc(e.target.value)}
                  className="p-2 border border-gray-200 rounded-xl focus:outline-[#8b6b4d] text-sm"
                />
              </div>

              {/* Note / ملاحظة */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-600">📌 ملاحظات إضافية (اختياري)</label>
                <input
                  type="text"
                  placeholder="ملاحظة للبند..."
                  value={modalNote}
                  onChange={(e) => setModalNote(e.target.value)}
                  className="p-2 border border-gray-200 rounded-xl focus:outline-[#8b6b4d] text-sm"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-3 border-t">
              <button
                onClick={handleModalAddSubmit}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm cursor-pointer shadow-sm transition-all"
              >
                ➕ إضافة الصنف للتقرير
              </button>
              <button
                onClick={() => setAddItemReportModal(null)}
                className="flex-1 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-xl text-sm cursor-pointer transition-all"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Matrix Filter Modal */}
      {matrixModalData && (
        <PrintMatrixFilterModal
          isOpen={Boolean(matrixModalData)}
          onClose={() => setMatrixModalData(null)}
          items={matrixModalData.items}
          title={matrixModalData.title}
          currentUserDisplay={currentUser.displayName || currentUser.username}
          defaultWarehouse={matrixModalData.defaultWarehouse || "جميع المخازن"}
        />
      )}
    </div>
  );
}
