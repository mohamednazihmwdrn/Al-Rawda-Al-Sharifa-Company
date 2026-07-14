import React, { useState } from "react";
import { User, Archive, SavedItem } from "../types";
import { printInvoice, printMatrix } from "../utils/print";
import { exportExcel } from "../utils/export";
import { compareDatesDescending } from "../utils/date";

interface ArchiveProps {
  currentUser: User;
  archives: Archive[];
  savedItems: SavedItem[];
  onDeleteArchive: (id: string) => void;
  onDeleteItemFromArchive: (archiveId: string, itemIndex: number) => void;
  onEditItemInArchive?: (archiveId: string, itemIndex: number, updatedFields: any) => void;
  onAddItemToArchive: (archiveId: string, item: any) => void;
  onViewDetails: (
    title: string,
    items: any[],
    onDeleteItem?: (index: number) => void,
    onEditItem?: (index: number, updatedItem: any) => void
  ) => void;
  onUpdateArchive?: (updatedArchive: Archive) => void;
}

export default function ArchiveComponent({
  currentUser,
  archives,
  savedItems,
  onDeleteArchive,
  onDeleteItemFromArchive,
  onEditItemInArchive,
  onAddItemToArchive,
  onViewDetails,
  onUpdateArchive
}: ArchiveProps) {
  const [searchText, setSearchText] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [showEditModal, setShowEditModal] = useState<string | null>(null);
  const [editingArchive, setEditingArchive] = useState<Archive | null>(null);
  const [addCompany, setAddCompany] = useState("GLC");
  const [addFixed, setAddFixed] = useState("");
  const [addDesc, setAddDesc] = useState("");
  const [addNote, setAddNote] = useState("");

  const isManager = currentUser.role === "مدير";

  // Filter logic
  const filteredArchives = archives.filter(arch => {
    // Search filter
    const matchesSearch = searchText.trim() === "" || 
      arch.title?.toLowerCase().includes(searchText.toLowerCase()) ||
      arch.warehouse?.toLowerCase().includes(searchText.toLowerCase()) ||
      arch.user?.toLowerCase().includes(searchText.toLowerCase()) ||
      arch.items.some(item =>
        item.company?.toLowerCase().includes(searchText.toLowerCase()) ||
        item.fixedName?.toLowerCase().includes(searchText.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchText.toLowerCase())
      );

    // Warehouse filter
    const matchesWarehouse = warehouseFilter === "" ||
      arch.warehouse === warehouseFilter ||
      (arch.merged && arch.warehouses?.includes(warehouseFilter));

    return matchesSearch && matchesWarehouse;
  }).sort(compareDatesDescending);

  const handleExportAll = () => {
    const allItems: any[] = [];
    archives.forEach(arch => {
      arch.items.forEach(item => {
        allItems.push({
          ...item,
          archiveDate: arch.date,
          archiveTitle: arch.title
        });
      });
    });

    if (allItems.length === 0) {
      alert("⚠️ لا يوجد أرشيف للتصدير!");
      return;
    }
    exportExcel(allItems, "جميع_الأرشيف_العام");
  };

  const handleAddSubmit = (archiveId: string) => {
    if (!addFixed.trim() || !addDesc.trim()) {
      alert("⚠️ الرجاء ملء جميع الحقول المطلوبة!");
      return;
    }

    onAddItemToArchive(archiveId, {
      company: addCompany,
      fixedName: addFixed.trim(),
      description: addDesc.trim(),
      note: addNote.trim(),
    });

    setAddFixed("");
    setAddDesc("");
    setAddNote("");
    setShowEditModal(null);
    alert("✅ تم إضافة البند إلى الأرشيف بنجاح!");
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-800 border-r-4 border-[#8b6b4d] pr-3">📦 الأرشيف العام - الفواتير المعتمدة</h2>
          <p className="text-xs text-gray-400 mt-1">تصفح وعبر عن عروض ومستندات الفروع المعتمدة</p>
        </div>
        {archives.length > 0 && (
          <button
            onClick={handleExportAll}
            className="bg-[#8b6b4d] hover:bg-[#6d4f34] text-white text-xs font-bold p-2.5 px-4 rounded-xl cursor-pointer transition-all flex items-center gap-1.5"
          >
            📥 تصدير الأرشيف بالكامل (CSV)
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 bg-gray-50 p-4 rounded-2xl border border-gray-100">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-gray-600">🔍 ابحث في الأرشيف (الشركة، الصنف، الوصف...)</label>
          <input
            type="text"
            placeholder="اكتب كلمة البحث هنا..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="p-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-[#8b6b4d]"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-gray-600">📦 فلترة حسب المخازن</label>
          <select
            value={warehouseFilter}
            onChange={(e) => setWarehouseFilter(e.target.value)}
            className="p-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-[#8b6b4d]"
          >
            <option value="">جميع المخازن</option>
            <option value="مخزن النحاس">مخزن النحاس</option>
            <option value="مخزن النادي">مخزن النادي</option>
          </select>
        </div>
      </div>

      <div className="space-y-4">
        {filteredArchives.length === 0 ? (
          <p className="text-gray-400 text-center py-10">لا توجد سجلات مطابقة للبحث حالياً.</p>
        ) : (
          filteredArchives.map((arch) => {
            const isUnread = arch.unread;
            const mergedTag = arch.merged ? `📋 #${arch.invoiceNumber || ""}` : "";
            return (
              <div key={arch.id} className={`p-4 rounded-2xl border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all ${
                isUnread ? "bg-amber-50/15 border-r-4 border-r-amber-500" : "bg-[#f5f2ed]/30 border-r-4 border-r-[#8b6b4d]"
              }`}>
                <div>
                  <strong className="text-gray-800 text-sm">📦 {arch.title || "فاتورة معتمدة"}</strong>
                  <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-x-4 gap-y-1">
                    <span>تاريخ الحفظ: {arch.date} | {arch.time || "10:00 مساءً"}</span>
                    <span>المخزن: {arch.warehouse || "جميع المخازن"}</span>
                    <span>المسجل: {arch.user || "غير معروف"}</span>
                    <span className="font-bold text-[#8b6b4d]">عدد البنود: {arch.items.length} {mergedTag}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 w-full md:w-auto">
                  <button
                    onClick={() => onViewDetails(
                      arch.title,
                      arch.items,
                      (index) => onDeleteItemFromArchive(arch.id, index),
                      onEditItemInArchive ? (index, fields) => onEditItemInArchive(arch.id, index, fields) : undefined
                    )}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold p-2 px-3 rounded-lg cursor-pointer transition-all"
                  >
                    👁️ عرض البنود
                  </button>
                  <button
                    onClick={() => printInvoice(arch.items, `فاتورة - ${arch.date}`)}
                    className="bg-[#8b6b4d] hover:bg-[#6d4f34] text-white text-xs font-bold p-2 px-3 rounded-lg cursor-pointer transition-all"
                  >
                    🖨️ طباعة
                  </button>
                  <button
                    onClick={() => printMatrix(arch.items, `أرشيف مصفوفة - ${arch.date}`, arch.warehouse, savedItems)}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold p-2 px-3 rounded-lg cursor-pointer transition-all"
                  >
                    ⊞ طباعة مصفوفة
                  </button>
                  <button
                    onClick={() => exportExcel(arch.items, `أرشيف_${arch.date}`)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold p-2 px-3 rounded-lg cursor-pointer transition-all"
                  >
                    CSV
                  </button>
                  <button
                    onClick={() => setShowEditModal(arch.id)}
                    className="bg-amber-500 hover:bg-amber-600 text-amber-950 text-xs font-bold p-2 px-3 rounded-lg cursor-pointer transition-all"
                  >
                    ✏️ إضافة صنف
                  </button>
                  {isManager && (
                    <button
                      onClick={() => setEditingArchive(arch)}
                      className="bg-amber-500 hover:bg-amber-600 text-amber-950 text-xs font-bold p-2 px-3 rounded-lg cursor-pointer transition-all"
                    >
                      ✏️ تعديل الأرشيف
                    </button>
                  )}
                  {confirmDeleteId === arch.id ? (
                    <div className="flex items-center gap-1.5 bg-red-50/10 p-1 rounded-lg border border-red-500/30">
                      <button
                        onClick={() => {
                          onDeleteArchive(arch.id);
                          setConfirmDeleteId(null);
                        }}
                        className="bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold py-1.5 px-2.5 rounded-md cursor-pointer transition-all animate-pulse"
                      >
                        تأكيد الحذف ⚠️
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="bg-gray-500 hover:bg-gray-600 text-white text-[11px] font-bold py-1.5 px-2.5 rounded-md cursor-pointer transition-all"
                      >
                        تراجع
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(arch.id)}
                      className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold p-2 px-3 rounded-lg cursor-pointer transition-all"
                    >
                      🗑️ حذف
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Edit modal (Add item to confirmed archive) */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-[10000] p-4">
          <div className="bg-white p-6 rounded-2xl max-w-md w-full shadow-2xl animate-fade-in-up border border-[#d4b48c]/30 space-y-4 text-right">
            <h3 className="text-[#8b6b4d] font-bold text-lg border-b pb-2">📦 إدراج صنف جديد لأرشيف معتمد</h3>
            
            <div className="space-y-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-600">الشركة</label>
                <select
                  value={addCompany}
                  onChange={(e) => setAddCompany(e.target.value)}
                  className="p-2 border rounded-lg focus:outline-[#8b6b4d] bg-white text-sm"
                >
                  <option value="GLC">GLC</option>
                  <option value="JOTUN">JOTUN</option>
                  <option value="Skip">Skip</option>
                  <option value="Sipes">Sipes</option>
                  <option value="CMB">CMB</option>
                  <option value="Saveto">Saveto</option>
                  <option value="Sika">Sika</option>
                  <option value="منتجات متنوعه (اكسسوارات)">منتجات متنوعه (اكسسوارات)</option>
                  <option value="حدايد ومسامير">حدايد ومسامير</option>
                  <option value="منتجات متنوعه (عام)">منتجات متنوعه (عام)</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-600">الاسم الثابت</label>
                <input
                  type="text"
                  placeholder="مثال: جالون، كيلو، شيكارة..."
                  value={addFixed}
                  onChange={(e) => setAddFixed(e.target.value)}
                  className="p-2 border rounded-lg focus:outline-[#8b6b4d] text-sm"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-600">الصنف والوصف</label>
                <input
                  type="text"
                  placeholder="مثال: معجون دايتون GLC..."
                  value={addDesc}
                  onChange={(e) => setAddDesc(e.target.value)}
                  className="p-2 border rounded-lg focus:outline-[#8b6b4d] text-sm"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-600">ملاحظة</label>
                <input
                  type="text"
                  placeholder="ملاحظات البند..."
                  value={addNote}
                  onChange={(e) => setAddNote(e.target.value)}
                  className="p-2 border rounded-lg focus:outline-[#8b6b4d] text-sm"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => handleAddSubmit(showEditModal)}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm cursor-pointer"
              >
                تأكيد الإدراج
              </button>
              <button
                onClick={() => setShowEditModal(null)}
                className="flex-1 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-xl text-sm cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Archive Metadata Modal */}
      {editingArchive && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-[10000] p-4">
          <div className="bg-white p-6 rounded-2xl max-w-md w-full shadow-2xl space-y-4 text-right" dir="rtl">
            <h3 className="text-[#8b6b4d] font-bold text-lg border-b pb-2 flex items-center gap-2">
              <span>✏️ تعديل بيانات الأرشيف</span>
            </h3>
            
            <div className="space-y-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-600">العنوان</label>
                <input
                  type="text"
                  value={editingArchive.title || ""}
                  onChange={(e) => setEditingArchive({ ...editingArchive, title: e.target.value })}
                  className="p-2 border rounded-lg focus:outline-[#8b6b4d] text-sm"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-600">التاريخ</label>
                <input
                  type="text"
                  value={editingArchive.date || ""}
                  onChange={(e) => setEditingArchive({ ...editingArchive, date: e.target.value })}
                  className="p-2 border rounded-lg focus:outline-[#8b6b4d] text-sm"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-600">الوقت</label>
                <input
                  type="text"
                  value={editingArchive.time || ""}
                  onChange={(e) => setEditingArchive({ ...editingArchive, time: e.target.value })}
                  className="p-2 border rounded-lg focus:outline-[#8b6b4d] text-sm"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-600">المستودع / المخزن</label>
                <input
                  type="text"
                  value={editingArchive.warehouse || ""}
                  onChange={(e) => setEditingArchive({ ...editingArchive, warehouse: e.target.value })}
                  className="p-2 border rounded-lg focus:outline-[#8b6b4d] text-sm"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={async () => {
                  if (onUpdateArchive) {
                    await onUpdateArchive(editingArchive);
                    setEditingArchive(null);
                    alert("✅ تم تعديل بيانات الأرشيف بنجاح!");
                  }
                }}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm cursor-pointer"
              >
                حفظ التعديلات
              </button>
              <button
                onClick={() => setEditingArchive(null)}
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
