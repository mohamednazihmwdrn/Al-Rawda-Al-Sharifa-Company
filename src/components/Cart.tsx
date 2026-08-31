import React, { useState, useEffect, useRef } from "react";
import { User, Item, SavedItem } from "../types";
import { CustomCompany } from "../services/dbService";
import { 
  Star, 
  Plus, 
  Trash2, 
  Search, 
  Sparkles, 
  Check, 
  Layers, 
  Info,
  ChevronDown,
  ChevronUp,
  Package,
  ShoppingCart
} from "lucide-react";

interface CartProps {
  currentUser: User;
  savedItems: SavedItem[];
  items: Item[]; // all items in DB for duplicate checking
  onSaveCart: (cartItems: LocalCartItem[]) => void;
  onSaveItemToDatabase: (item: Partial<SavedItem>) => void;
  onToggleFavoriteItem?: (itemName: string, isFav: boolean, itemData?: Partial<SavedItem>) => Promise<void> | void;
  onDeleteSavedItem?: (itemId: string) => Promise<void> | void;
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

export default function Cart({ 
  currentUser, 
  savedItems, 
  items, 
  onSaveCart, 
  onSaveItemToDatabase,
  onToggleFavoriteItem,
  onDeleteSavedItem,
  customCompanies 
}: CartProps) {
  const [cart, setCart] = useState<LocalCartItem[]>([]);
  const [quantity, setQuantity] = useState("");
  const [itemName, setItemName] = useState("");

  // Refs for Enter key navigation
  const quantityInputRef = useRef<HTMLInputElement>(null);
  const itemNameInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus the quantity field when the cart opens
  useEffect(() => {
    const t = setTimeout(() => {
      quantityInputRef.current?.focus();
    }, 100);
    return () => clearTimeout(t);
  }, []);

  // Autocomplete state
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteResults, setAutocompleteResults] = useState<SavedItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Favorites state & search
  const [favSearch, setFavSearch] = useState("");
  const [favQuantities, setFavQuantities] = useState<Record<string, string>>({});
  const [showFavoritesSection, setShowFavoritesSection] = useState(true);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "info" } | null>(null);

  // Modal for duplicate items
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateModalConfig, setDuplicateModalConfig] = useState<{
    quantity: string;
    itemName: string;
    source: string;
    onConfirm: (newNote: string) => void;
  } | null>(null);
  const [duplicateNoteInput, setDuplicateNoteInput] = useState("");

  // Auto-dismiss toast after 3 seconds
  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => {
      setToastMessage(null);
    }, 3200);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  // Filtered favorite items list
  const favoriteItems = savedItems.filter(s => s.isFavorite === true);
  const filteredFavorites = favoriteItems.filter(item => {
    if (!favSearch.trim()) return true;
    const q = favSearch.toLowerCase();
    return (
      (item.name || "").toLowerCase().includes(q) ||
      (item.fixedName || "").toLowerCase().includes(q) ||
      (item.company || "").toLowerCase().includes(q)
    );
  });

  // Check if a specific item name is favorited
  const isItemFavorited = (nameToCheck: string): boolean => {
    if (!nameToCheck || !nameToCheck.trim()) return false;
    const clean = nameToCheck.trim().toLowerCase();
    return savedItems.some(
      s => s.isFavorite === true &&
           (s.name.trim().toLowerCase() === clean ||
            (s.fixedName && s.fixedName.trim().toLowerCase() === clean))
    );
  };

  // Toggle favorite for an item
  const handleToggleFavorite = async (name: string, isFav: boolean, itemData?: any) => {
    if (!name || !name.trim()) return;
    const cleanName = name.trim();

    if (onToggleFavoriteItem) {
      await onToggleFavoriteItem(cleanName, isFav, {
        name: cleanName,
        fixedName: cleanName,
        company: itemData?.company || "",
        note: itemData?.note || "-"
      });
    } else {
      onSaveItemToDatabase({
        name: cleanName,
        fixedName: cleanName,
        company: itemData?.company || "",
        note: itemData?.note || "-",
        isFavorite: isFav,
        lastUsed: `${new Date().toLocaleDateString("ar-EG")} - ${new Date().toLocaleTimeString("ar-EG")}`
      });
    }

    if (isFav) {
      setToastMessage({
        text: `⭐ تمت إضافة "${cleanName}" إلى قائمة الأصناف المفضلة بنجاح!`,
        type: "success"
      });
    } else {
      setToastMessage({
        text: `ℹ️ تم إزالة "${cleanName}" من قائمة الأصناف المفضلة.`,
        type: "info"
      });
    }
  };

  // Quick add a favorite item to the cart
  const handleQuickAddFavorite = (favItem: SavedItem) => {
    const qty = (favQuantities[favItem.id] || favItem.defaultQty || "1").trim();
    if (!qty) {
      alert("⚠️ الرجاء تحديد كمية الصنف أولاً!");
      return;
    }

    const todayStr = new Date().toLocaleDateString("ar-EG");
    const nameToAdd = favItem.fixedName || favItem.name;

    const newItem: LocalCartItem = {
      id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
      company: qty,
      fixedName: nameToAdd,
      description: "-",
      note: favItem.note || "-",
      date: todayStr,
      time: new Date().toLocaleTimeString("ar-EG")
    };

    setCart(prev => [...prev, newItem]);
    
    // Auto-update last used
    onSaveItemToDatabase({
      ...favItem,
      lastUsed: `${todayStr} - ${new Date().toLocaleTimeString("ar-EG")}`
    });

    setToastMessage({
      text: `✓ تمت إضافة (${qty}) من "${nameToAdd}" إلى السلة!`,
      type: "success"
    });
  };

  // Add all filtered favorites to cart with quantity 1
  const handleAddAllFavoritesToCart = () => {
    if (filteredFavorites.length === 0) return;
    if (!confirm(`هل تريد إضافة عدد (${filteredFavorites.length}) صنف من المفضلة إلى السلة دفعة واحدة؟`)) return;

    const todayStr = new Date().toLocaleDateString("ar-EG");
    const newCartItems: LocalCartItem[] = filteredFavorites.map((favItem, idx) => {
      const qty = (favQuantities[favItem.id] || favItem.defaultQty || "1").trim();
      return {
        id: Date.now().toString() + idx + Math.random().toString(36).slice(2, 6),
        company: qty,
        fixedName: favItem.fixedName || favItem.name,
        description: "-",
        note: favItem.note || "-",
        date: todayStr,
        time: new Date().toLocaleTimeString("ar-EG")
      };
    });

    setCart(prev => [...prev, ...newCartItems]);
    setToastMessage({
      text: `✓ تم إضافة (${newCartItems.length}) أصناف من المفضلة إلى السلة بنجاح!`,
      type: "success"
    });
  };

  // Load saved item template lookup whenever itemName changes (prioritize favorites)
  useEffect(() => {
    if (!itemName.trim()) {
      setAutocompleteResults([]);
      setShowAutocomplete(false);
      return;
    }

    const query = itemName.trim().toLowerCase();
    const seen = new Set<string>();
    const favMatches: SavedItem[] = [];
    const otherMatches: SavedItem[] = [];

    for (const item of savedItems) {
      const nameKey = item.name.trim().toLowerCase();
      if (seen.has(nameKey)) continue;

      const isMatch = item.name.toLowerCase().includes(query) ||
                      (item.fixedName && item.fixedName.toLowerCase().includes(query));
      
      if (isMatch) {
        if (item.isFavorite) {
          favMatches.push(item);
        } else {
          otherMatches.push(item);
        }
        seen.add(nameKey);
        if (favMatches.length + otherMatches.length >= 12) break;
      }
    }

    // Put favorite matches at the top of the autocomplete
    const combined = [...favMatches, ...otherMatches];
    setAutocompleteResults(combined);
    setShowAutocomplete(combined.length > 0);
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
    if (!quantity.trim()) {
      alert("⚠️ الرجاء كتابة العدد (الكمية المطلوبة) للصنف أولاً!");
      quantityInputRef.current?.focus();
      return;
    }

    if (!itemName.trim()) {
      alert("⚠️ الرجاء كتابة اسم الصنف!");
      itemNameInputRef.current?.focus();
      return;
    }

    const todayStr = new Date().toLocaleDateString("ar-EG");
    const formattedQty = quantity.trim();

    // Regular add - allow any warehouse to add any item freely
    const newItem: LocalCartItem = {
      id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
      company: formattedQty,
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
    setShowAutocomplete(false);
    setActiveIndex(-1);

    // Refocus on quantity input for ultra-fast, smooth sequential entry
    setTimeout(() => {
      quantityInputRef.current?.focus();
    }, 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (!quantity.trim()) {
        alert("⚠️ الرجاء كتابة العدد (الكمية المطلوبة) أولاً قبل إضافة الصنف!");
        quantityInputRef.current?.focus();
        return;
      }
      if (showAutocomplete && activeIndex >= 0 && autocompleteResults[activeIndex]) {
        const item = autocompleteResults[activeIndex];
        setItemName(item.fixedName || item.name);
        setShowAutocomplete(false);
        setActiveIndex(-1);
      } else {
        handleAddToCart();
      }
    } else if (e.key === "ArrowDown" && showAutocomplete) {
      e.preventDefault();
      setActiveIndex(prev => Math.min(prev + 1, autocompleteResults.length - 1));
    } else if (e.key === "ArrowUp") {
      if (showAutocomplete) {
        e.preventDefault();
        setActiveIndex(prev => Math.max(prev - 1, -1));
      } else if (!itemName.trim() || (e.target as HTMLInputElement).selectionStart === 0) {
        // Return to quantity input on ArrowUp if empty or at start
        e.preventDefault();
        quantityInputRef.current?.focus();
      }
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
    <div className="bg-white p-5 sm:p-7 rounded-3xl shadow-sm border border-gray-100 space-y-6" dir="rtl">
      {/* Toast Notification */}
      {toastMessage && (
        <div 
          className={`fixed bottom-6 left-6 z-[9999] px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-2.5 text-sm font-bold animate-bounce transition-all ${
            toastMessage.type === "success" 
              ? "bg-amber-50 border-amber-300 text-amber-900 shadow-amber-500/10" 
              : "bg-gray-800 border-gray-700 text-white shadow-black/20"
          }`}
        >
          {toastMessage.type === "success" ? (
            <Sparkles className="w-5 h-5 text-amber-500 shrink-0" />
          ) : (
            <Info className="w-5 h-5 text-gray-300 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="card-title text-xl font-bold border-r-4 border-[#8b6b4d] pr-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <span className="flex items-center gap-2 text-gray-800">
          <ShoppingCart className="w-6 h-6 text-[#8b6b4d]" />
          سلة إضافة النواقص وإرسالها
        </span>
        <span className="text-xs text-gray-500 font-normal bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100">
          (F2 للحفظ السريع | Enter للإضافة)
        </span>
      </div>

      {/* ⭐ Favorites / Recurring Items Section ⭐ */}
      <div className="bg-gradient-to-br from-amber-50/60 via-[#fdfaf6] to-amber-50/40 p-4 sm:p-5 rounded-2xl border border-amber-200/80 shadow-xs">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs shadow-amber-500/30">
              <Star className="w-4 h-4 fill-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-sm sm:text-base text-gray-800">
                  الأصناف المفضلة (الطلبات المتكررة دورياً للمستودعات)
                </h3>
                <span className="bg-amber-100 text-amber-900 border border-amber-300 text-xs font-black px-2 py-0.5 rounded-full">
                  {favoriteItems.length} صنف
                </span>
              </div>
              <p className="text-[11px] text-gray-500 font-medium mt-0.5">
                أصناف سريعة بنقرة واحدة لتسهيل طلب الاحتياجات الدورية دون الحاجة لإعادة كتابتها.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
            {favoriteItems.length > 0 && (
              <button
                onClick={handleAddAllFavoritesToCart}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                title="إضافة جميع الأصناف المفضلة إلى السلة دفعة واحدة"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>إضافة كل المفضلة للسلة</span>
              </button>
            )}
            <button
              onClick={() => setShowFavoritesSection(prev => !prev)}
              className="p-1.5 text-gray-500 hover:text-gray-800 bg-white border border-gray-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
              title={showFavoritesSection ? "طي قسم المفضلة" : "عرض قسم المفضلة"}
            >
              {showFavoritesSection ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {showFavoritesSection && (
          <div className="space-y-3 pt-2">
            {/* Search within favorites if > 4 items */}
            {favoriteItems.length > 4 && (
              <div className="relative max-w-sm">
                <Search className="w-3.5 h-3.5 absolute right-3 top-3 text-gray-400" />
                <input
                  type="text"
                  placeholder="بحث سريع في الأصناف المفضلة..."
                  value={favSearch}
                  onChange={(e) => setFavSearch(e.target.value)}
                  className="w-full pr-8 pl-3 py-1.5 bg-white border border-amber-200 rounded-xl text-xs focus:outline-[#8b6b4d] font-bold text-gray-700"
                />
              </div>
            )}

            {favoriteItems.length === 0 ? (
              <div className="bg-white/80 border border-dashed border-amber-300 rounded-2xl p-5 text-center space-y-2">
                <div className="w-10 h-10 mx-auto rounded-full bg-amber-100 text-amber-700 flex items-center justify-center">
                  <Star className="w-5 h-5 fill-amber-500 text-amber-500" />
                </div>
                <h4 className="font-extrabold text-sm text-gray-800">لا توجد أصناف في المفضلة بعد</h4>
                <p className="text-xs text-gray-500 max-w-md mx-auto leading-relaxed">
                  يمكنك إضافة أي صنف متكرر تطلبه المستودعات دورياً بالضغط على زر 
                  <span className="inline-flex items-center gap-1 mx-1 px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded-md font-bold text-[11px]">
                    ⭐ إضافة إلى المفضلة
                  </span> 
                  بجانب أي صنف داخل السلة أدناه، وسيظهر هنا دائماً لإضافته بنقرة واحدة.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
                {filteredFavorites.map((favItem) => {
                  const currentQty = favQuantities[favItem.id] !== undefined 
                    ? favQuantities[favItem.id] 
                    : (favItem.defaultQty || "1");
                  const displayName = favItem.fixedName || favItem.name;

                  return (
                    <div 
                      key={favItem.id}
                      className="bg-white p-3 rounded-2xl border border-amber-200/90 hover:border-amber-400 hover:shadow-md transition-all flex flex-col justify-between gap-2.5 group"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex items-start gap-1.5 flex-1 min-w-0">
                          <Star className="w-4 h-4 text-amber-500 fill-amber-500 shrink-0 mt-0.5" />
                          <div className="min-w-0 flex-1">
                            <span 
                              className="font-extrabold text-xs sm:text-sm text-gray-800 block truncate cursor-pointer hover:text-[#8b6b4d]"
                              title={`انقر لتعبئة اسم "${displayName}" في الخانة`}
                              onClick={() => {
                                setItemName(displayName);
                                setQuantity(currentQty);
                                quantityInputRef.current?.focus();
                              }}
                            >
                              {displayName}
                            </span>
                            {favItem.company && favItem.company !== "-" && (
                              <span className="text-[10px] text-gray-400 block truncate">
                                {favItem.company}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Unstar button */}
                        <button
                          onClick={() => handleToggleFavorite(displayName, false, favItem)}
                          className="text-gray-300 hover:text-red-500 p-1 hover:bg-red-50 rounded-lg transition-all text-xs cursor-pointer shrink-0"
                          title="إزالة من المفضلة"
                        >
                          ✕
                        </button>
                      </div>

                      {/* Quantity & Quick Add */}
                      <div className="flex items-center gap-1.5 pt-1 border-t border-gray-50">
                        <div className="w-16">
                          <input
                            type="text"
                            value={currentQty}
                            onChange={(e) => setFavQuantities(prev => ({ ...prev, [favItem.id]: e.target.value }))}
                            placeholder="العدد"
                            className="w-full text-center p-1 bg-gray-50 border border-gray-200 rounded-lg text-xs font-black text-gray-800 focus:outline-[#8b6b4d]"
                          />
                        </div>
                        <button
                          onClick={() => handleQuickAddFavorite(favItem)}
                          className="flex-1 py-1.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white rounded-lg font-bold text-xs transition-all shadow-xs flex items-center justify-center gap-1 cursor-pointer"
                          title="أضف هذا الصنف فوراً إلى السلة بالكمية المحددة"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>إضافة للسلة</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main Grid: Form Inputs and Cart List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-7">
        {/* Form fields column */}
        <div className="space-y-4 bg-gray-50/60 p-5 rounded-2xl border border-gray-100">
          <div className="flex flex-col gap-1.5">
            <label className="font-extrabold text-sm text-gray-700 flex items-center gap-1.5">
              <span>🔢 خانة العدد</span>
            </label>
            <input
              ref={quantityInputRef}
              type="text"
              placeholder="اكتب العدد هنا..."
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === "Tab") {
                  e.preventDefault();
                  if (quantity.trim()) {
                    itemNameInputRef.current?.focus();
                  } else {
                    quantityInputRef.current?.focus();
                  }
                }
              }}
              className="w-full p-3 bg-white border-2 border-gray-200 focus:border-[#8b6b4d] rounded-xl focus:outline-none transition-all text-sm font-bold text-gray-800 shadow-xs"
            />
          </div>

          <div className="flex flex-col gap-1.5 relative" ref={containerRef}>
            <label className="font-extrabold text-sm text-gray-700 flex items-center gap-1.5">
              <span>📝 خانة كتابة الأصناف</span>
            </label>
            <input
              ref={itemNameInputRef}
              type="text"
              placeholder="اكتب اسم الصنف هنا..."
              value={itemName}
              disabled={!quantity.trim()}
              onChange={(e) => setItemName(e.target.value)}
              onFocus={(e) => {
                if (!quantity.trim()) {
                  e.preventDefault();
                  quantityInputRef.current?.focus();
                }
              }}
              onClick={(e) => {
                if (!quantity.trim()) {
                  e.preventDefault();
                  quantityInputRef.current?.focus();
                }
              }}
              onKeyDown={handleKeyDown}
              className={`w-full p-3 border-2 rounded-xl focus:border-[#8b6b4d] focus:outline-none transition-all text-sm font-bold text-gray-800 shadow-xs ${
                !quantity.trim()
                  ? "bg-gray-100/80 border-gray-200 cursor-not-allowed opacity-60"
                  : "bg-white border-gray-200"
              }`}
              autoComplete="off"
            />
            {/* Autocomplete list */}
            {showAutocomplete && (
              <div className="absolute top-[100%] left-0 right-0 bg-white border border-gray-200 rounded-b-xl shadow-xl z-50 max-h-52 overflow-y-auto mt-1 divide-y divide-gray-50">
                {autocompleteResults.map((item, index) => {
                  const isFav = item.isFavorite === true;
                  return (
                    <div
                      key={`${item.id || index}-${index}`}
                      onClick={() => {
                        setItemName(item.fixedName || item.name);
                        setShowAutocomplete(false);
                        setTimeout(() => {
                          itemNameInputRef.current?.focus();
                        }, 50);
                      }}
                      className={`p-2.5 px-4 cursor-pointer text-sm transition-all flex justify-between items-center ${
                        index === activeIndex ? "bg-[#f5f2ed] font-bold text-[#8b6b4d]" : "hover:bg-amber-50/50"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {isFav ? (
                          <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
                        ) : (
                          <Package className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        )}
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-gray-800">{item.fixedName || item.name}</span>
                            {isFav && (
                              <span className="bg-amber-100 text-amber-900 text-[10px] font-black px-1.5 py-0.2 rounded">
                                ⭐ مفضل
                              </span>
                            )}
                          </div>
                          <span className="block text-[10px] text-gray-400">آخر استخدام: {item.lastUsed || "غير مسجل"}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <button
            onClick={handleAddToCart}
            className="w-full py-3.5 bg-[#8b6b4d] hover:bg-[#6d4f34] active:scale-[0.99] text-white rounded-xl font-black transition-all shadow-md shadow-[#8b6b4d]/15 text-sm cursor-pointer flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>➕ أضف إلى السلة الحالية</span>
          </button>
        </div>

        {/* Local Cart list column */}
        <div className="bg-[#f5f2ed]/50 p-5 rounded-2xl border border-gray-200/70 flex flex-col justify-between min-h-[340px]">
          <div>
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-200/60">
              <span className="font-extrabold text-sm sm:text-base text-gray-800 flex items-center gap-2">
                <span>🛒 الأصناف المضافة بالسلة</span>
                <span className="bg-[#8b6b4d] text-white text-xs font-black px-2 py-0.5 rounded-full">
                  {cart.length}
                </span>
              </span>
              {cart.length > 0 && (
                <button
                  onClick={() => confirm("تأكيد تفريغ السلة؟") && setCart([])}
                  className="text-xs text-red-600 hover:text-red-800 font-bold transition-all cursor-pointer flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>تفريغ السلة</span>
                </button>
              )}
            </div>

            <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
              {cart.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-12 leading-relaxed font-medium">
                  السلة فارغة حالياً.<br />
                  ابدأ بإدخال الأعداد وأسماء الأصناف أو أضف من المفضلة أعلاه.
                </p>
              ) : (
                cart.map((item, idx) => {
                  const isFavorited = isItemFavorited(item.fixedName);

                  return (
                    <div 
                      key={`${item.id || idx}-${idx}`} 
                      className="bg-white p-3 rounded-2xl border-2 border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 transition-all hover:border-[#8b6b4d]/40 shadow-xs"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="bg-[#8b6b4d]/15 text-[#8b6b4d] font-black text-xs px-2.5 py-1 rounded-xl shrink-0">
                          {item.company && item.company !== "-" ? `العدد: ${item.company}` : "بدون عدد (غير محدد)"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-extrabold text-gray-800 text-sm truncate">
                            {item.fixedName}
                          </div>
                          {item.duplicateNote && (
                            <span className="text-[10px] text-red-600 font-bold bg-red-50 p-0.5 px-2 rounded-full inline-block mt-1">
                              🔄 مكرر من: {item.duplicateFrom}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Action buttons: Favorite toggle + Delete */}
                      <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
                        {isFavorited ? (
                          <button
                            onClick={() => handleToggleFavorite(item.fixedName, false, item)}
                            className="px-2.5 py-1 rounded-xl text-xs font-black transition-all bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100 flex items-center gap-1.5 cursor-pointer shadow-xs"
                            title="هذا الصنف مضاف إلى المفضلة (انقر لإزالته من المفضلة)"
                          >
                            <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                            <span>في المفضلة</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleToggleFavorite(item.fixedName, true, item)}
                            className="px-2.5 py-1 rounded-xl text-xs font-bold transition-all bg-gray-50 text-gray-700 border border-gray-200 hover:bg-amber-50 hover:text-amber-900 hover:border-amber-300 flex items-center gap-1.5 cursor-pointer shadow-xs group"
                            title="إضافة هذا الصنف إلى المفضلة لتسهيل طلبه لاحقاً للمستودعات"
                          >
                            <Star className="w-3.5 h-3.5 text-gray-400 group-hover:text-amber-500 group-hover:fill-amber-500 transition-all" />
                            <span>إضافة إلى المفضلة</span>
                          </button>
                        )}

                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="text-red-500 hover:text-red-700 p-1.5 hover:bg-red-50 rounded-xl text-xs cursor-pointer transition-all shrink-0"
                          title="حذف هذا الصنف من السلة"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {cart.length > 0 && (
            <button
              onClick={handleSaveInvoice}
              className="w-full mt-4 py-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white rounded-xl font-black transition-all shadow-md text-sm cursor-pointer flex justify-center items-center gap-2"
            >
              <Check className="w-4 h-4" />
              <span>💾 حفظ وإرسال الفاتورة للمدير (F2)</span>
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
