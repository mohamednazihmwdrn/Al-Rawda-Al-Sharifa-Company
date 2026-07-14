import React, { useState } from "react";
import { User, Report } from "../types";
import { printInvoice, printMatrix } from "../utils/print";
import { exportExcel } from "../utils/export";
import { compareDatesDescending } from "../utils/date";

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
}

export default function Reports({
  currentUser,
  reports,
  onDeleteReport,
  onViewDetails,
  onDeleteItemFromReport,
  onEditItemInReport,
  onUpdateReport
}: ReportsProps) {
  const isManager = currentUser.role === "مدير";
  const [editingReport, setEditingReport] = useState<Report | null>(null);

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
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-800 border-r-4 border-[#8b6b4d] pr-3">📄 التقارير اليومية المؤرشفة</h2>
          <p className="text-xs text-gray-400 mt-1">التقارير المرحلة تلقائياً الساعة 10 مساءً أو يدوياً من المدير</p>
        </div>
        {reports.length > 0 && (
          <button
            onClick={handleExportAll}
            className="bg-[#8b6b4d] hover:bg-[#6d4f34] text-white text-xs font-bold p-2.5 px-4 rounded-xl cursor-pointer transition-all flex items-center gap-1.5"
          >
            📥 تصدير جميع التقارير (CSV)
          </button>
        )}
      </div>

      <div className="space-y-4">
        {reports.length === 0 ? (
          <p className="text-gray-400 text-center py-10">لا توجد تقارير مؤرشفة حالياً بالمنظومة.</p>
        ) : (
          [...reports].sort(compareDatesDescending).map((report, idx) => (
            <div key={report.id} className="bg-[#f5f2ed]/45 p-4 rounded-2xl border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
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
                  onClick={() => printMatrix(report.items, `تقرير اليوم - ${report.date}`)}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold p-2 px-3 rounded-lg cursor-pointer transition-all"
                >
                  ⊞ طباعة مصفوفة
                </button>
                <button
                  onClick={() => exportExcel(report.items, `تقرير_${report.date}`)}
                  className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold p-2 px-3 rounded-lg cursor-pointer transition-all"
                >
                  📥 تصدير
                </button>
                {isManager && (
                  <button
                    onClick={() => setEditingReport(report)}
                    className="bg-amber-500 hover:bg-amber-600 text-amber-950 text-xs font-bold p-2 px-3 rounded-lg cursor-pointer transition-all"
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
    </div>
  );
}
