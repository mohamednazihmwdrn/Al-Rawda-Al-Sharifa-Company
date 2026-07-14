import React, { useState, useEffect, useRef } from "react";
import { User, Item, SavedItem } from "../types";
import { CustomCompany } from "../services/dbService";

interface CartProps {
  currentUser: User;
  savedItems: SavedItem[];
  items: Item[]; // all items in DB for duplicate checking
  onSaveCart: (cartItems: LocalCartItem[]) => void;
  onSaveItemToDatabase: (item: Partial<SavedItem>) => void;
  customCompanies?: CustomCompany[];
}

export interface LocalCartItem {
  id: string;
  company: string; // Used to store item count/quantity
  fixedName: string; // Used to store item name
  description: string; // Unused but kept for backwards compatibility
  note: string; // Unused but kept for backwards compatibility
  date: string;
  time: string;
  duplicateNote?: boolean;
  duplicateFrom?: string;
}

export default function Cart({ currentUser, savedItems, items, onSaveCart, onSaveItemToDatabase }: CartProps) {
  const [cart, setCart] = useState<LocalCartItem[]>([]);
  const [quantity, setQuantity] = useState("");
  const [itemName, setItemName] = useState("");

  // Refs for Enter key navigation
  const quantityInputRef = useRef<HTMLInputElement>(null);
  const itemNameInputRef = useRef<HTMLInputElement>(null);

  // Autocomplete state
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteResults, setAutocompleteResults] = useState<SavedItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Modal for duplicate items
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateModalConfig, setDuplicateModalConfig] = useState<{
    quantity: string;
    itemName: string;
    source: string;
    onConfirm: (newNote: string) => void;
  } | null>(null);
  const [duplicateNoteInput, setDuplicateNoteInput] = useState("");

  // Load saved item template lookup whenever itemName changes
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

      const isMatch = item.name.toLowerCase().includes(query) ||
                      (item.fixedName && item.fixedName.toLowerCase().includes(query));
      
      if (isMatch) {
        matches.push(item);
        seen.add(nameKey);
        if (matches.length >= 10) break;
      }
    }

    setAutocompleteResults(matches);
    setShowAutocomplete(matches.length > 0);
    setActiveIndex(-1);
  }, [itemName, savedItems]);

  // Detect clicks outside of autocomplete container to close it
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowAutocomplete(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleAddToCart = () => {
    if (!itemName.trim()) {
      alert("⚠️ الرجاء كتابة اسم الصنف أولاً!");
      return;
    }
    if (!quantity.trim()) {
      alert("⚠️ الرجاء كتابة العدد / الكمية للأصناف أولاً!");
      return;
    }

    // Check duplicate in local cart
    const isDupInCart = cart.some(
      item => item.fixedName.trim().toLowerCase() === itemName.trim().toLowerCase()
    );

    // Check duplicate in active database
    const currentWarehouseName = currentUser.role === "مدير" ? "مخزن المدير" : (currentUser.warehouse || "المدير");
    const todayStr = new Date().toLocaleDateString("ar-EG");
    const isDupInDB = items.some(
      item => item.warehouse === currentWarehouseName &&
              item.status === "active" &&
              item.fixedName.trim().toLowerCase() === itemName.trim().toLowerCase() &&
              item.date === todayStr
    );

    if (isDupInCart || isDupInDB) {
      const sourceName = isDupInCart ? "نفس الفاتورة الحالية بالسلة" : "قاعدة البيانات النشطة اليوم";
      
      setDuplicateModalConfig({
        quantity,
        itemName,
        source: sourceName,
        onConfirm: (newNote: string) => {
          const newItem: LocalCartItem = {
            id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
            company: quantity.trim(),
            fixedName: itemName.trim(),
            description: "-",
            note: newNote,
            date: todayStr,
            time: new Date().toLocaleTimeString("ar-EG"),
            duplicateNote: true,
            duplicateFrom: sourceName
          };
          setCart(prev => [...prev, newItem]);
          setItemName("");
          setQuantity("");
        }
      });
      setDuplicateNoteInput("");
      setShowDuplicateModal(true);
      return;
    }

    // Check duplicate in another warehouse's active/pending items
    const otherWarehouseItem = items.find(
      item => item.warehouse !== currentWarehouseName &&
              (item.status === "waiting" || item.status === "active") &&
              item.fixedName.trim().toLowerCase() === itemName.trim().toLowerCase()
    );

    if (otherWarehouseItem) {
      const sourceName = `مستودع آخر: ${otherWarehouseItem.warehouse}`;
      setDuplicateModalConfig({
        quantity,
        itemName,
        source: sourceName,
        onConfirm: (newNote: string) => {
          const newItem: LocalCartItem = {
            id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
            company: quantity.trim(),
            fixedName: itemName.trim(),
            description: "-",
            note: newNote,
            date: todayStr,
            time: new Date().toLocaleTimeString("ar-EG"),
            duplicateNote: true,
            duplicateFrom: otherWarehouseItem.warehouse
          };
          setCart(prev => [...prev, newItem]);
          setItemName("");
          setQuantity("");
        }
      });
      setDuplicateNoteInput("");
      setShowDuplicateModal(true);
      return;
    }

    // Regular add
    const newItem: LocalCartItem = {
      id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
      company: quantity.trim(),
      fixedName: itemName.trim(),
      description: "-",
      note: "-",
      date: todayStr,
      time: new Date().toLocaleTimeString("ar-EG")
    };

    setCart(prev => [...prev, newItem]);

    // Track/auto-save template in the background
    onSaveItemToDatabase({
      name: itemName.trim(),
      company: "",
      fixedName: itemName.trim(),
      note: "-",
      lastUsed: `${todayStr} - ${new Date().toLocaleTimeString("ar-EG")}`
    });

    setItemName("");
    setQuantity("");
    setTimeout(() => {
      quantityInputRef.current?.focus();
    }, 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (showAutocomplete && activeIndex >= 0 && autocompleteResults[activeIndex]) {
        const item = autocompleteResults[activeIndex];
        setItemName(item.name);
        setShowAutocomplete(false);
      } else {
        handleAddToCart();
      }
    } else if (e.key === "ArrowDown" && showAutocomplete) {
      e.preventDefault();
      setActiveIndex(prev => Math.min(prev + 1, autocompleteResults.length - 1));
    } else if (e.key === "ArrowUp" && showAutocomplete) {
      e.preventDefault();
      setActiveIndex(prev => Math.max(prev - 1, -1));
    }
  };

  // Keyboard shortcut F2
  useEffect(() => {
    const handleF2 = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        handleSaveInvoice();
      }
    };
    window.addEventListener("keydown", handleF2);
    return () => window.removeEventListener("keydown", handleF2);
  }, [cart]);

  const handleSaveInvoice = () => {
    if (cart.length === 0) {
      alert("⚠️ السلة فارغة، يرجى إضافة بنود أولاً!");
      return;
    }
    onSaveCart(cart);
    setCart([]);
    alert("✅ تم حفظ وإرسال الفاتورة بنجاح!");
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  return (
    <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-gray-100" dir="rtl">
      <div className="card-title text-xl font-bold border-r-4 border-[#8b6b4d] pr-3 mb-6 flex justify-between items-center">
        <span className="flex items-center gap-2">🛒 سلة إضافة النواقص</span>
        <span className="text-xs text-gray-500 font-normal">
          (F2 للحفظ السريع | Enter للإضافة)
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Form fields column */}
        <div className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="font-extrabold text-sm text-gray-700">🔢 خانة أعداد للأصناف</label>
            <input
              ref={quantityInputRef}
              type="text"
              placeholder="اكتب العدد أو الكمية (مثال: 5، 2 بستلة، 20 علبة...)"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  itemNameInputRef.current?.focus();
                }
              }}
              className="w-full p-3 border-2 border-gray-100 rounded-xl focus:border-[#8b6b4d] focus:outline-none transition-all text-sm font-bold text-gray-800"
            />
          </div>

          <div className="flex flex-col gap-1.5 relative" ref={containerRef}>
            <label className="font-extrabold text-sm text-gray-700">📝 خانة كتابة الأصناف</label>
            <input
              ref={itemNameInputRef}
              type="text"
              placeholder="اكتب اسم الصنف هنا..."
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full p-3 border-2 border-gray-100 rounded-xl focus:border-[#8b6b4d] focus:outline-none transition-all text-sm font-bold text-gray-800"
              autoComplete="off"
            />
            {/* Autocomplete list */}
            {showAutocomplete && (
              <div className="absolute top-[100%] left-0 right-0 bg-white border border-gray-100 rounded-b-xl shadow-lg z-50 max-h-48 overflow-y-auto mt-1">
                {autocompleteResults.map((item, index) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      setItemName(item.name);
                      setShowAutocomplete(false);
                      setTimeout(() => {
                        itemNameInputRef.current?.focus();
                      }, 50);
                    }}
                    className={`p-2.5 px-4 cursor-pointer text-sm transition-all border-b border-gray-50 flex justify-between items-center ${
                      index === activeIndex ? "bg-[#f5f2ed] font-bold text-[#8b6b4d]" : "hover:bg-gray-50"
                    }`}
                  >
                    <div>
                      <span className="font-bold text-gray-800">{item.name}</span>
                      <span className="block text-[10px] text-gray-400">آخر استخدام: {item.lastUsed || "غير مسجل"}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={handleAddToCart}
            className="w-full py-3.5 bg-[#8b6b4d] hover:bg-[#6d4f34] text-white rounded-xl font-black transition-all shadow-md shadow-[#8b6b4d]/15 text-sm cursor-pointer"
          >
            ➕ أضف إلى السلة الحالية
          </button>
        </div>

        {/* Local Cart list column */}
        <div className="bg-[#f5f2ed]/40 p-5 rounded-2xl border border-gray-100 flex flex-col justify-between min-h-[300px]">
          <div>
            <div className="flex justify-between items-center mb-4">
              <span className="font-bold text-gray-700">🛒 الأصناف المضافة بالسلة ({cart.length})</span>
              {cart.length > 0 && (
                <button
                  onClick={() => confirm("تأكيد تفريغ السلة؟") && setCart([])}
                  className="text-xs text-red-600 hover:text-red-800 font-bold transition-all cursor-pointer"
                >
                  🧹 تفريغ السلة
                </button>
              )}
            </div>

            <div className="space-y-2.5 max-h-[320px] overflow-y-auto">
              {cart.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-10 leading-relaxed font-medium">السلة فارغة حالياً.<br/>ابدأ بإدخال الأعداد وأسماء الأصناف أعلاه.</p>
              ) : (
                cart.map((item, idx) => (
                  <div key={item.id} className="bg-white p-3 rounded-xl border-2 border-gray-100 flex justify-between items-center gap-4 transition-all hover:border-[#8b6b4d]/30">
                    <div className="flex items-center gap-3">
                      <div className="bg-[#8b6b4d]/15 text-[#8b6b4d] font-black text-xs px-2.5 py-1 rounded-lg">
                        العدد: {item.company}
                      </div>
                      <div>
                        <div className="font-extrabold text-gray-800 text-sm">{item.fixedName}</div>
                        {item.duplicateNote && (
                          <span className="text-[10px] text-red-600 font-bold bg-red-50 p-0.5 px-2 rounded-full inline-block mt-1">
                            🔄 مكرر من: {item.duplicateFrom}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded-lg text-xs cursor-pointer transition-all shrink-0"
                    >
                      🗑️
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {cart.length > 0 && (
            <button
              onClick={handleSaveInvoice}
              className="w-full mt-4 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-all shadow-md text-sm cursor-pointer flex justify-center items-center gap-2"
            >
              💾 حفظ وإرسال الفاتورة للمدير (F2)
            </button>
          )}
        </div>
      </div>

      {/* Duplicate warning popup modal */}
      {showDuplicateModal && duplicateModalConfig && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-[10000] p-4">
          <div className="bg-white p-6 rounded-2xl max-w-md w-full shadow-2xl animate-fade-in-up border border-[#d4b48c]/30 space-y-4 text-right" dir="rtl">
            <div className="text-center">
              <div className="text-red-600 text-3xl mb-1">⚠️ تنبيه بالبند المكرر</div>
              <p className="text-gray-700 text-sm font-semibold">
                تم العثور على الصنف <span className="text-[#8b6b4d] font-extrabold">"{duplicateModalConfig.itemName}"</span> مسبقاً في:
              </p>
              <span className="inline-block bg-amber-100 text-amber-900 text-xs font-bold px-3 py-1 rounded-full mt-1.5">
                {duplicateModalConfig.source}
              </span>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-600 block">يرجى كتابة ملاحظة للتمييز لكي يسمح بإضافته:</label>
              <input
                type="text"
                placeholder="مثال: دفعة عاجلة، أو مقاس خاص..."
                value={duplicateNoteInput}
                onChange={(e) => setDuplicateNoteInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (!duplicateNoteInput.trim()) {
                      alert("⚠️ الرجاء كتابة الملاحظة للتمييز أولاً!");
                      return;
                    }
                    duplicateModalConfig.onConfirm(duplicateNoteInput.trim());
                    setShowDuplicateModal(false);
                  }
                }}
                className="w-full p-2 border-2 border-gray-100 rounded-xl focus:border-[#8b6b4d] focus:outline-none text-sm"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  if (!duplicateNoteInput.trim()) {
                    alert("⚠️ الرجاء كتابة الملاحظة للتمييز أولاً!");
                    return;
                  }
                  duplicateModalConfig.onConfirm(duplicateNoteInput.trim());
                  setShowDuplicateModal(false);
                }}
                className="flex-1 py-2 bg-[#8b6b4d] hover:bg-[#6d4f34] text-white font-bold rounded-xl text-sm cursor-pointer"
              >
                أضف بملاحظة مختلفة
              </button>
              <button
                onClick={() => setShowDuplicateModal(false)}
                className="flex-1 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-xl text-sm cursor-pointer"
              >
                إلغاء الإضافة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
