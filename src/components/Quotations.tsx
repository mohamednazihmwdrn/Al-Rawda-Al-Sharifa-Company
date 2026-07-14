import React, { useState, useEffect, useRef } from "react";
import { User, Quotation, QuotationItem, SavedItem } from "../types";
import { printQuotationReceipt } from "../utils/print";
import { compareDatesDescending } from "../utils/date";

interface QuotationsProps {
  currentUser: User;
  quotations: Quotation[];
  savedItems: SavedItem[];
  onSaveQuotation: (q: Quotation) => void;
  onDeleteQuotation: (id: string) => void;
  onApproveQuotation: (id: string) => void;
}

export default function Quotations({
  currentUser,
  quotations,
  savedItems,
  onSaveQuotation,
  onDeleteQuotation,
  onApproveQuotation
}: QuotationsProps) {
  const [showCreator, setShowCreator] = useState(false);
  const [editMode, setEditMode] = useState<string | null>(null);

  // Draft quotation state
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [draftItems, setDraftItems] = useState<QuotationItem[]>([]);

  // Current item builder card states
  const [showItemCard, setShowItemCard] = useState(false);
  const [itemName, setItemName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(14);
  const [itemNote, setItemNote] = useState("");

  // Autocomplete state
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteResults, setAutocompleteResults] = useState<SavedItem[]>([]);
  const autocompleteRef = useRef<HTMLDivElement>(null);

  // Refs for Enter key navigation
  const clientNameRef = useRef<HTMLInputElement>(null);
  const clientPhoneRef = useRef<HTMLInputElement>(null);
  const itemNameRef = useRef<HTMLInputElement>(null);
  const quantityRef = useRef<HTMLInputElement>(null);
  const priceRef = useRef<HTMLInputElement>(null);
  const discountRef = useRef<HTMLInputElement>(null);
  const taxRef = useRef<HTMLInputElement>(null);
  const itemNoteRef = useRef<HTMLInputElement>(null);

  const isManager = currentUser.role === "مدير";

  // Autocomplete search
  useEffect(() => {
    if (!itemName.trim()) {
      setAutocompleteResults([]);
      setShowAutocomplete(false);
      return;
    }
    const query = itemName.trim().toLowerCase();
    const seen = new Set<string>();
    const matches: SavedItem[] = [];

    for (const item of savedItems) {
      const nameKey = item.name.trim().toLowerCase();
      if (seen.has(nameKey)) continue;

      if (item.name.toLowerCase().includes(query)) {
        matches.push(item);
        seen.add(nameKey);
        if (matches.length >= 10) break;
      }
    }

    setAutocompleteResults(matches);
    setShowAutocomplete(matches.length > 0);
  }, [itemName, savedItems]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (autocompleteRef.current && !autocompleteRef.current.contains(e.target as Node)) {
        setShowAutocomplete(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleAddItemToDraft = () => {
    if (!itemName.trim()) {
      alert("⚠️ الرجاء كتابة اسم الصنف أولاً!");
      return;
    }

    if (quantity <= 0 || price < 0) {
      alert("⚠️ الكمية والسعر يجب أن يكونا قيماً صحيحة!");
      return;
    }

    const subtotal = quantity * price;
    const discountAmount = subtotal * (discount / 100);
    const afterDiscount = subtotal - discountAmount;
    const taxAmount = afterDiscount * (tax / 100);
    const total = afterDiscount + taxAmount;

    const matched = savedItems.find(s => s.name.trim().toLowerCase() === itemName.trim().toLowerCase());

    const newItem: QuotationItem = {
      id: Date.now().toString() + Math.random().toString(36).slice(2, 5),
      name: itemName.trim(),
      quantity,
      price,
      discount,
      tax,
      note: itemNote.trim(),
      subtotal,
      total,
      company: matched?.company || "عروض أسعار",
      fixedName: matched?.fixedName || "عرض سعر",
      warehouse: currentUser.warehouse || "جميع المخازن"
    };

    setDraftItems(prev => [...prev, newItem]);
    
    // Clear item inputs and keep builder card open for fast multi-entry
    setItemName("");
    setQuantity(1);
    setPrice(0);
    setDiscount(0);
    setItemNote("");
    
    setTimeout(() => {
      itemNameRef.current?.focus();
    }, 50);
  };

  const handleSaveQuotationDraft = () => {
    if (!clientName.trim()) {
      alert("⚠️ الرجاء كتابة اسم العميل!");
      return;
    }
    if (draftItems.length === 0) {
      alert("⚠️ الرجاء إضافة صنف واحد على الأقل لعرض السعر!");
      return;
    }

    const grandTotal = draftItems.reduce((sum, item) => sum + item.total, 0);

    // Calculate sequential quotation number starting from 1
    let qNum = 1;
    if (editMode) {
      const existing = quotations.find(q => q.id === editMode);
      if (existing && existing.quotationNumber) {
        qNum = existing.quotationNumber;
      } else {
        const otherNums = quotations.filter(q => q.id !== editMode && q.quotationNumber).map(q => q.quotationNumber || 0);
        qNum = otherNums.length > 0 ? Math.max(...otherNums) + 1 : quotations.length + 1;
      }
    } else {
      const allNums = quotations.map(q => q.quotationNumber || 0);
      qNum = allNums.length > 0 ? Math.max(...allNums) + 1 : quotations.length + 1;
    }

    const quotation: Quotation = {
      id: editMode || Date.now().toString(),
      quotationNumber: qNum,
      date: new Date().toLocaleDateString("ar-EG"),
      time: new Date().toLocaleTimeString("ar-EG"),
      clientName: clientName.trim(),
      clientPhone: clientPhone.trim() || "غير محدد",
      items: draftItems,
      total: grandTotal,
      user: currentUser.displayName || currentUser.username,
      status: "pending",
      createdAt: new Date().toLocaleDateString("ar-EG")
    };

    onSaveQuotation(quotation);
    
    // Reset state
    setClientName("");
    setClientPhone("");
    setDraftItems([]);
    setShowCreator(false);
    setEditMode(null);
    alert("✅ تم حفظ فاتورة عرض السعر بنجاح!");
  };

  const handleEditTrigger = (q: Quotation) => {
    setClientName(q.clientName);
    setClientPhone(q.clientPhone);
    setDraftItems(q.items);
    setEditMode(q.id);
    setShowCreator(true);
  };

  const handlePrint = (q: Quotation) => {
    printQuotationReceipt(q, currentUser.displayName || currentUser.username);
  };

  const grandTotalDraft = draftItems.reduce((sum, item) => sum + item.total, 0);

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-800 border-r-4 border-[#8b6b4d] pr-3">📋 فواتير عروض الأسعار</h2>
          {isManager && !showCreator && (
            <button
              onClick={() => {
                setEditMode(null);
                setClientName("");
                setClientPhone("");
                setDraftItems([]);
                setShowCreator(true);
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold p-2.5 px-4 cursor-pointer transition-all flex items-center gap-1.5"
            >
              ➕ فاتورة عرض سعر جديدة
            </button>
          )}
        </div>

        {/* Creator panel */}
        {showCreator && (
          <div className="bg-[#f5f2ed]/30 p-6 rounded-2xl border border-[#d4b48c]/30 space-y-6 animate-fade-in mb-6">
            <div className="text-center bg-[#f5f2ed] p-4 rounded-xl">
              <h3 className="text-[#8b6b4d] text-lg font-bold">🌹 شركة الروضة الشريفة</h3>
              <p className="text-xs text-gray-500 mt-1">19 مكرم عبيد - أمام راديو طلعت | 📞 01110055809</p>
            </div>

            {/* Client fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-gray-700">اسم العميل</label>
                <input
                  ref={clientNameRef}
                  type="text"
                  placeholder="أدخل اسم العميل..."
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      clientPhoneRef.current?.focus();
                    }
                  }}
                  className="w-full p-2.5 border border-gray-200 rounded-xl focus:border-[#8b6b4d] bg-white focus:outline-none text-sm"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-gray-700">رقم الهاتف</label>
                <input
                  ref={clientPhoneRef}
                  type="text"
                  placeholder="أدخل رقم الهاتف..."
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (!showItemCard) {
                        setShowItemCard(true);
                      }
                      setTimeout(() => {
                        itemNameRef.current?.focus();
                      }, 50);
                    }
                  }}
                  className="w-full p-2.5 border border-gray-200 rounded-xl focus:border-[#8b6b4d] bg-white focus:outline-none text-sm text-left"
                  dir="ltr"
                />
              </div>
            </div>

            {/* Add item trigger */}
            <div className="text-center">
              <button
                type="button"
                onClick={() => setShowItemCard(!showItemCard)}
                className="w-full py-3 bg-[#8b6b4d] hover:bg-[#6d4f34] text-white rounded-xl font-bold transition-all text-sm cursor-pointer"
              >
                {showItemCard ? "✕ إغلاق نافذة الصنف" : "➕ أضف صنفاً جديداً لعرض السعر"}
              </button>
            </div>

            {/* Item builder card */}
            {showItemCard && (
              <div className="bg-white p-4 rounded-xl border-2 border-[#d4b48c]/50 space-y-4 animate-fade-in">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="flex flex-col gap-1.5 relative" ref={autocompleteRef}>
                    <label className="text-xs font-bold text-gray-600">اسم الصنف</label>
                    <input
                      ref={itemNameRef}
                      type="text"
                      placeholder="ابحث أو اكتب الصنف..."
                      value={itemName}
                      onChange={(e) => setItemName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          quantityRef.current?.focus();
                        }
                      }}
                      className="p-2 border rounded-lg focus:outline-[#8b6b4d] text-sm"
                      autoComplete="off"
                    />
                    {showAutocomplete && (
                      <div className="absolute top-[100%] left-0 right-0 bg-white border rounded-b-lg shadow-lg z-50 max-h-36 overflow-y-auto">
                        {autocompleteResults.map(res => (
                          <div
                            key={res.id}
                            onClick={() => {
                              setItemName(res.name);
                              setPrice(res.lastPrice || res.price || 0);
                              setShowAutocomplete(false);
                              setTimeout(() => {
                                quantityRef.current?.focus();
                              }, 50);
                            }}
                            className="p-2 hover:bg-gray-50 text-xs cursor-pointer flex justify-between"
                          >
                            <span>{res.name}</span>
                            <span>{res.lastPrice || res.price} ج.م</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-gray-600">الكمية</label>
                    <input
                      ref={quantityRef}
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          priceRef.current?.focus();
                        }
                      }}
                      className="p-2 border rounded-lg focus:outline-[#8b6b4d] text-sm text-center"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-gray-600">سعر الوحدة</label>
                    <input
                      ref={priceRef}
                      type="number"
                      min="0"
                      step="0.01"
                      value={price}
                      onChange={(e) => setPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          discountRef.current?.focus();
                        }
                      }}
                      className="p-2 border rounded-lg focus:outline-[#8b6b4d] text-sm text-center"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-gray-600">الخصم (%)</label>
                    <input
                      ref={discountRef}
                      type="number"
                      min="0"
                      max="100"
                      value={discount}
                      onChange={(e) => setDiscount(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          taxRef.current?.focus();
                        }
                      }}
                      className="p-2 border rounded-lg focus:outline-[#8b6b4d] text-sm text-center"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-gray-600">الضريبة (%)</label>
                    <input
                      ref={taxRef}
                      type="number"
                      min="0"
                      max="100"
                      value={tax}
                      onChange={(e) => setTax(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          itemNoteRef.current?.focus();
                        }
                      }}
                      className="p-2 border rounded-lg focus:outline-[#8b6b4d] text-sm text-center"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-gray-600">ملاحظة</label>
                    <input
                      ref={itemNoteRef}
                      type="text"
                      placeholder="ملاحظات البند..."
                      value={itemNote}
                      onChange={(e) => setItemNote(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddItemToDraft();
                        }
                      }}
                      className="p-2 border rounded-lg focus:outline-[#8b6b4d] text-sm"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAddItemToDraft}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs cursor-pointer"
                >
                  ✓ تثبيت وإدراج الصنف للفاتورة
                </button>
              </div>
            )}

            {/* Current items inside draft */}
            <div className="overflow-x-auto bg-white p-4 rounded-xl border border-gray-100">
              <table className="w-full text-sm text-right">
                <thead className="bg-[#f5f2ed]">
                  <tr>
                    <th className="p-2 text-center text-xs">#</th>
                    <th className="p-2 text-xs">اسم الصنف</th>
                    <th className="p-2 text-center text-xs">الكمية</th>
                    <th className="p-2 text-center text-xs">سعر الوحدة</th>
                    <th className="p-2 text-center text-xs">الخصم</th>
                    <th className="p-2 text-center text-xs">الضريبة</th>
                    <th className="p-2 text-center text-xs">الإجمالي</th>
                    <th className="p-2 text-xs">ملاحظة</th>
                    <th className="p-2 text-center text-xs">إجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {draftItems.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center text-gray-400 p-4 text-xs">
                        لم يتم إدراج أي أصناف حتى الآن.
                      </td>
                    </tr>
                  ) : (
                    draftItems.map((item, index) => (
                      <tr key={item.id} className="border-b border-gray-50 last:border-0">
                        <td className="p-2 text-center">{index + 1}</td>
                        <td className="p-2 font-semibold text-gray-800">{item.name}</td>
                        <td className="p-2 text-center font-bold">{item.quantity}</td>
                        <td className="p-2 text-center">{item.price.toFixed(2)} ج.م</td>
                        <td className="p-2 text-center text-red-600">{item.discount}%</td>
                        <td className="p-2 text-center text-emerald-600">{item.tax}%</td>
                        <td className="p-2 text-center font-bold text-[#8b6b4d]">{item.total.toFixed(2)} ج.م</td>
                        <td className="p-2 text-gray-500 text-xs">{item.note || "-"}</td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => setDraftItems(prev => prev.filter(i => i.id !== item.id))}
                            className="text-red-500 hover:text-red-700 font-bold p-1 px-2 hover:bg-red-50 rounded-lg text-xs cursor-pointer"
                          >
                            حذف
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr className="font-bold bg-[#f5f2ed]/50 text-gray-800">
                    <td colSpan={6} className="p-3 text-left">الإجمالي النهائي الكلي:</td>
                    <td className="p-3 text-center text-lg text-[#8b6b4d]" colSpan={3}>
                      {grandTotalDraft.toFixed(2)} ج.م
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Actions */}
            <div className="flex gap-4">
              <button
                type="button"
                onClick={handleSaveQuotationDraft}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-all text-sm cursor-pointer shadow-md"
              >
                💾 {editMode ? "تحديث وتعديل الفاتورة" : "حفظ عرض السعر بقاعدة البيانات"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreator(false);
                  setEditMode(null);
                }}
                className="flex-1 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-bold transition-all text-sm cursor-pointer"
              >
                إلغاء وتراجع
              </button>
            </div>
          </div>
        )}

        {/* Existing pending and approved lists */}
        <div className="space-y-4">
          {quotations.length === 0 ? (
            <p className="text-gray-400 text-center py-10">لا توجد عروض أسعار محفوظة بالمنظومة حالياً.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[...quotations].sort(compareDatesDescending).map((q) => {
                const borderClass = q.status === "approved" ? "border-emerald-200 bg-emerald-50/20" : "border-amber-200 bg-amber-50/20";
                const statusBadge = q.status === "approved" ? "bg-emerald-600 text-white" : "bg-amber-500 text-amber-950";
                return (
                  <div key={q.id} className={`p-4 border rounded-2xl shadow-xs transition-all space-y-3 ${borderClass}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold text-gray-800 text-sm">📋 عرض سعر رقم: {q.quotationNumber || 1}</div>
                        <div className="text-xs text-gray-700 font-semibold mt-1">👤 العميل: {q.clientName}</div>
                        <div className="text-[11px] text-gray-400 mt-0.5">📞 هاتف: {q.clientPhone}</div>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusBadge}`}>
                        {q.status === "approved" ? "✓ معتمدة" : "⏳ مسودة انتظار"}
                      </span>
                    </div>

                    <div className="text-xs text-gray-600 flex justify-between">
                      <span>تاريخ: {q.date} - {q.time}</span>
                      <span>بواسطة: {q.user}</span>
                    </div>

                    <div className="text-sm font-semibold flex justify-between bg-white p-2 rounded-xl border border-gray-100 items-center">
                      <span className="text-gray-500 text-xs">عدد البنود: {q.items.length} صنف</span>
                      <span className="text-[#8b6b4d] font-bold text-base">{q.total.toFixed(2)} ج.م</span>
                    </div>

                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <button
                        onClick={() => handlePrint(q)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold p-1.5 px-3 rounded-lg cursor-pointer transition-all flex items-center gap-1"
                      >
                        🖨️ طباعة
                      </button>
                      {q.status === "pending" && (
                        <button
                          onClick={() => onApproveQuotation(q.id)}
                          className="bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold p-1.5 px-3 rounded-lg cursor-pointer transition-all"
                        >
                          ✓ اعتماد الفاتورة
                        </button>
                      )}
                      <button
                        onClick={() => handleEditTrigger(q)}
                        className="bg-[#8b6b4d] hover:bg-[#6d4f34] text-white text-[11px] font-bold p-1.5 px-3 rounded-lg cursor-pointer transition-all"
                      >
                        ✏️ تعديل
                      </button>
                      <button
                        onClick={() => confirm("تأكيد حذف عرض السعر؟") && onDeleteQuotation(q.id)}
                        className="bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold p-1.5 px-2 rounded-lg cursor-pointer transition-all"
                      >
                        🗑️ حذف
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
