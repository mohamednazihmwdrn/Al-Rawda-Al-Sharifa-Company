import React, { useState } from "react";
import { User } from "../types";
import { executeUniversalPrint, getUniversalPrintHeaderBar, getUniversalPrintScript } from "../utils/print";

interface SmartPrintProps {
  currentUser: User;
}

export default function SmartPrint({ currentUser }: SmartPrintProps) {
  const [text, setText] = useState<string>("");
  const [prompt, setPrompt] = useState<string>("");
  const [printTitle, setPrintTitle] = useState<string>("");
  const [isCompact50Lines, setIsCompact50Lines] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  // Styling settings
  const [fontSize, setFontSize] = useState<number>(18);
  const [textAlign, setTextAlign] = useState<"right" | "center" | "left" | "justify">("right");
  const [padding, setPadding] = useState<number>(40);
  const [lineHeight, setLineHeight] = useState<number>(1.6);
  const [fontWeight, setFontWeight] = useState<"normal" | "medium" | "bold">("medium");
  const [isRtl, setIsRtl] = useState<boolean>(true);
  const [fontFamily, setFontFamily] = useState<string>("font-sans");
  const [borderStyle, setBorderStyle] = useState<"none" | "simple" | "double" | "elegant">("none");
  const [showHeader, setShowHeader] = useState<boolean>(false);
  const [headerText, setHeaderText] = useState<string>("الروضة الشريفة");
  const [showFooter, setShowFooter] = useState<boolean>(false);
  const [footerText, setFooterText] = useState<string>("المملكة العربية السعودية");

  const handleGenerateFromPrompt = async () => {
    if (!prompt.trim()) {
      setError("الرجاء كتابة توجيه (البرومبت) أولاً لتوليد النص.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/gemini/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "فشل توليد النص من الخادم.");
      }

      const data = await response.json();
      setText(data.text);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "حدث خطأ أثناء الاتصال بالذكاء الاصطناعي.");
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    const directionAttr = isRtl ? "rtl" : "ltr";
    const textAlignClass = textAlign === "right" ? "right" : textAlign === "center" ? "center" : textAlign === "left" ? "left" : "justify";
    
    // Choose border style
    let borderStyleCss = "";
    if (borderStyle === "simple") {
      borderStyleCss = "border: 1px solid #111; padding: 20px;";
    } else if (borderStyle === "double") {
      borderStyleCss = "border: 4px double #111; padding: 20px;";
    } else if (borderStyle === "elegant") {
      borderStyleCss = "border: 8px double #8b6b4d; padding: 25px; outline: 2px solid #8b6b4d; outline-offset: -12px;";
    }

    // Font styles
    const fontStyleCss = 
      fontFamily === "font-mono" ? "font-family: 'Courier New', Courier, monospace;" :
      fontFamily === "font-serif" ? "font-family: 'Georgia', serif;" :
      "font-family: 'Inter', system-ui, sans-serif;";

    // Auto apply super-compact mode to fit 50+ lines if requested
    const actualFontSize = isCompact50Lines ? 13 : fontSize;
    const actualLineHeight = isCompact50Lines ? 1.3 : lineHeight;
    const actualPadding = isCompact50Lines ? 15 : padding;
    const titleToUse = printTitle || 'طباعة نص حر - الروضة الشريفة';

    const html = `
      <!DOCTYPE html>
      <html lang="ar" dir="${directionAttr}">
        <head>
          <meta charset="UTF-8">
          <title>${titleToUse}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&display=swap');
            @page {
              size: A4;
              margin: ${isCompact50Lines ? '10mm' : '20mm'};
            }
            body {
              background: white;
              color: black;
              margin: 0;
              padding: 0;
              ${fontStyleCss}
              direction: ${directionAttr};
            }
            .paper-content {
              padding: ${actualPadding}px;
              font-size: ${actualFontSize}px;
              text-align: ${textAlignClass};
              line-height: ${actualLineHeight};
              font-weight: ${fontWeight};
              white-space: pre-wrap;
              word-break: break-word;
              ${borderStyleCss}
              min-height: 270mm;
              box-sizing: border-box;
            }
            .print-header {
              text-align: center;
              font-size: 14px;
              border-bottom: 2px solid #8b6b4d;
              padding-bottom: 10px;
              margin-bottom: 20px;
              font-weight: bold;
              display: ${showHeader ? 'block' : 'none'};
            }
            .title-section {
              text-align: center;
              font-size: ${actualFontSize + 6}px;
              font-weight: bold;
              border-bottom: 3.5px double #111;
              padding-bottom: 12px;
              margin-bottom: 25px;
              color: #000;
              letter-spacing: 0.5px;
            }
            .print-footer {
              text-align: center;
              font-size: 11px;
              border-top: 1px solid #ddd;
              padding-top: 10px;
              margin-top: 25px;
              color: #555;
              display: ${showFooter ? 'block' : 'none'};
              position: absolute;
              bottom: 10mm;
              left: 10mm;
              right: 10mm;
            }
            @media print {
              .no-print-universal-bar { display: none !important; }
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
          </style>
        </head>
        <body>
          ${getUniversalPrintHeaderBar(titleToUse)}
          <div class="paper-content">
            <div class="print-header">${headerText}</div>
            ${printTitle ? `<div class="title-section">${printTitle}</div>` : ""}
            <div>${text || "الرجاء كتابة نص هنا للطباعة..."}</div>
            <div class="print-footer">${footerText}</div>
          </div>
          ${getUniversalPrintScript()}
        </body>
      </html>
    `;

    executeUniversalPrint(html, titleToUse);
  };

  return (
    <div className="space-y-6">
      {/* Header and description */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800 border-r-4 border-[#8b6b4d] pr-3">📝 الطباعة الحرة والذكية للمدير</h2>
          <p className="text-xs text-gray-500 mt-1">اكتب أي نص بحرية، عدّل المقاسات والأبعاد بالكامل، أو اطلب من الذكاء الاصطناعي توليد وصقل المحتوى ثم اطبعه على ورق أبيض بكبسة زر.</p>
        </div>
        <button
          onClick={handlePrint}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-6 rounded-xl shadow-md transition-all cursor-pointer text-sm shrink-0 flex items-center gap-2"
        >
          🖨️ طباعة على ورقة بيضاء
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Controls & Editor (7 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Smart AI Prompt Area */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="text-sm font-bold text-gray-800 border-r-3 border-purple-600 pr-2.5 mb-3">✨ التوليد والتعديل بالذكاء الاصطناعي (برومبت)</h3>
            <div className="space-y-3">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="مثال: اكتب خطاب شكر للموظفين في مستودع فرعي مخزن النحاس على جهودهم الرائعة، أو صقل النص التالي ليكون بأسلوب رسمي..."
                className="w-full h-24 p-3 border border-gray-200 rounded-xl text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
              <button
                onClick={handleGenerateFromPrompt}
                disabled={loading}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white font-bold py-2 px-4 rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    جاري صياغة النص...
                  </>
                ) : (
                  <>🪄 توليد وصياغة النص بالذكاء الاصطناعي</>
                )}
              </button>
              {error && <p className="text-[11px] text-red-600 font-medium bg-red-50 p-2.5 rounded-lg">{error}</p>}
            </div>
          </div>

          {/* Control Dimension Settings */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4">
            <h3 className="text-sm font-bold text-gray-800 border-r-3 border-[#8b6b4d] pr-2.5">🛠️ أبعاد وتنسيقات الصفحة والكتابة</h3>

            {/* Font size */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold text-gray-700">
                <span>حجم الخط:</span>
                <span className="font-bold text-[#8b6b4d]">{fontSize}px</span>
              </div>
              <input
                type="range"
                min="12"
                max="48"
                value={fontSize}
                onChange={(e) => setFontSize(parseInt(e.target.value))}
                className="w-full accent-[#8b6b4d]"
              />
            </div>

            {/* Padding/Margins */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold text-gray-700">
                <span>الهوامش والتباعد الداخلي:</span>
                <span className="font-bold text-[#8b6b4d]">{padding}px</span>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                value={padding}
                onChange={(e) => setPadding(parseInt(e.target.value))}
                className="w-full accent-[#8b6b4d]"
              />
            </div>

            {/* Line Height */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold text-gray-700">
                <span>تباعد الأسطر (الارتفاع):</span>
                <span className="font-bold text-[#8b6b4d]">{lineHeight}</span>
              </div>
              <input
                type="range"
                min="1.2"
                max="2.5"
                step="0.1"
                value={lineHeight}
                onChange={(e) => setLineHeight(parseFloat(e.target.value))}
                className="w-full accent-[#8b6b4d]"
              />
            </div>

            {/* Layout parameters */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="col-span-2 bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-amber-900">تنسيق ذكي لـ 50 سطر أو أكثر</span>
                  <span className="text-[10px] text-amber-700 font-medium">يصغر الهوامش والخطوط لتفادي الخروج لصفحة ثانية</span>
                </div>
                <input
                  type="checkbox"
                  checked={isCompact50Lines}
                  onChange={(e) => setIsCompact50Lines(e.target.checked)}
                  className="w-4 h-4 accent-amber-700 cursor-pointer"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700 block">محاذاة النص:</label>
                <select
                  value={textAlign}
                  onChange={(e) => setTextAlign(e.target.value as any)}
                  className="w-full p-2 border border-gray-200 rounded-xl text-xs focus:outline-none"
                >
                  <option value="right">يمين (يمين - عربي)</option>
                  <option value="center">وسط (توسيط المذكرة)</option>
                  <option value="left">يسار (يسار - إنجليزي)</option>
                  <option value="justify">توزيع متساوي (Justify)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700 block">سماكة الخط:</label>
                <select
                  value={fontWeight}
                  onChange={(e) => setFontWeight(e.target.value as any)}
                  className="w-full p-2 border border-gray-200 rounded-xl text-xs focus:outline-none"
                >
                  <option value="normal">عادي (Normal)</option>
                  <option value="medium">متوسط (Medium)</option>
                  <option value="bold">عريض (Bold)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700 block">نوع الخط:</label>
                <select
                  value={fontFamily}
                  onChange={(e) => setFontFamily(e.target.value)}
                  className="w-full p-2 border border-gray-200 rounded-xl text-xs focus:outline-none"
                >
                  <option value="font-sans">خط النظام الافتراضي</option>
                  <option value="font-serif">خط كلاسيكي (Serif)</option>
                  <option value="font-mono">خط أحادي المسافة (Mono)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700 block">إطار الورقة:</label>
                <select
                  value={borderStyle}
                  onChange={(e) => setBorderStyle(e.target.value as any)}
                  className="w-full p-2 border border-gray-200 rounded-xl text-xs focus:outline-none"
                >
                  <option value="none">بدون إطار (ورقة بيضاء سادة)</option>
                  <option value="simple">إطار بسيط رفيع</option>
                  <option value="double">إطار مزدوج رسمي</option>
                  <option value="elegant">إطار ملكي مذهب</option>
                </select>
              </div>
            </div>

            {/* Header / Footer custom options */}
            <div className="border-t border-gray-100 pt-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="showHeader"
                    checked={showHeader}
                    onChange={(e) => setShowHeader(e.target.checked)}
                    className="accent-[#8b6b4d]"
                  />
                  <label htmlFor="showHeader" className="text-xs font-bold text-gray-700 cursor-pointer">تضمين ترويسة علوية</label>
                </div>
                {showHeader && (
                  <input
                    type="text"
                    value={headerText}
                    onChange={(e) => setHeaderText(e.target.value)}
                    className="p-1 px-2.5 border border-gray-200 rounded-lg text-xs w-40"
                    placeholder="محتوى الترويسة"
                  />
                )}
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="showFooter"
                    checked={showFooter}
                    onChange={(e) => setShowFooter(e.target.checked)}
                    className="accent-[#8b6b4d]"
                  />
                  <label htmlFor="showFooter" className="text-xs font-bold text-gray-700 cursor-pointer">تضمين تذييل سفلي</label>
                </div>
                {showFooter && (
                  <input
                    type="text"
                    value={footerText}
                    onChange={(e) => setFooterText(e.target.value)}
                    className="p-1 px-2.5 border border-gray-200 rounded-lg text-xs w-40"
                    placeholder="محتوى التذييل"
                  />
                )}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-700">اتجاه الكتابة المبدئي:</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsRtl(true)}
                    className={`p-1.5 px-3.5 rounded-lg text-xs font-semibold cursor-pointer ${isRtl ? "bg-[#8b6b4d] text-white" : "bg-gray-100 text-gray-700"}`}
                  >
                    عربي (RTL)
                  </button>
                  <button
                    onClick={() => setIsRtl(false)}
                    className={`p-1.5 px-3.5 rounded-lg text-xs font-semibold cursor-pointer ${!isRtl ? "bg-[#8b6b4d] text-white" : "bg-gray-100 text-gray-700"}`}
                  >
                    إنجليزي (LTR)
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Free Textarea Input & Live Paper Preview (7 cols) */}
        <div className="lg:col-span-7 flex flex-col space-y-4">
          {/* Title and Main Textarea Input */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col space-y-3 shrink-0">
            <h3 className="text-sm font-bold text-gray-800 border-r-3 border-[#8b6b4d] pr-2.5">📝 عنوان وتفاصيل المستند الحر</h3>
            
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-600 block">عنوان المستند أو الخطاب (اختياري - يفصل تلقائياً بخط مزدوج):</label>
              <input
                type="text"
                value={printTitle}
                onChange={(e) => setPrintTitle(e.target.value)}
                placeholder="مثال: قرار إداري بشأن تنظيم مواعيد مستودعات الروضة"
                className="w-full p-2.5 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-[#8b6b4d] bg-white text-right"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-600 block">نص الخطاب أو المسودة:</label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="اكتب هنا أي نص، مذكرات، تعاميم، قرارات إدارية أو ملاحظات تريد طباعتها على ورقة بيضاء..."
                className="w-full h-44 p-4 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-[#8b6b4d]"
              />
            </div>
          </div>

          {/* Virtual Paper Preview */}
          <div className="bg-gray-100 p-4 rounded-2xl flex justify-center">
            <div className="w-full max-w-[500px] bg-white shadow-lg border border-gray-300 overflow-hidden transition-all duration-300">
              <div className="text-[10px] text-center bg-gray-200 text-gray-500 py-1 font-mono select-none">
                📄 معاينة ما قبل الطباعة (ورق أبيض A4)
              </div>
              <div
                className={`transition-all duration-300 min-h-[500px] text-black ${fontFamily}`}
                style={{
                  padding: `${(isCompact50Lines ? 15 : padding) / 2}px`, // Scaled for small screen preview
                  fontSize: `${(isCompact50Lines ? 13 : fontSize) * 0.7}px`, // Scaled for preview
                  textAlign: textAlign,
                  lineHeight: isCompact50Lines ? 1.3 : lineHeight,
                  fontWeight: fontWeight === "normal" ? 400 : fontWeight === "medium" ? 500 : 700,
                  direction: isRtl ? "rtl" : "ltr",
                  border: borderStyle === "simple" ? "1px solid #111" : borderStyle === "double" ? "4px double #111" : borderStyle === "elegant" ? "8px double #8b6b4d" : "none",
                  outline: borderStyle === "elegant" ? "2px solid #8b6b4d" : "none",
                  outlineOffset: borderStyle === "elegant" ? "-6px" : "0px",
                }}
              >
                {showHeader && (
                  <div className="text-center font-bold border-b border-[#8b6b4d] pb-1 mb-4 text-[11px]" style={{ fontSize: `${(isCompact50Lines ? 13 : fontSize) * 0.5}px` }}>
                    {headerText}
                  </div>
                )}
                {printTitle && (
                  <div className="text-center font-bold border-b-2 border-double border-gray-800 pb-2 mb-4 text-[15px]" style={{ fontSize: `${(isCompact50Lines ? 13 : fontSize) * 0.9}px` }}>
                    {printTitle}
                  </div>
                )}
                <div className="whitespace-pre-wrap break-words">
                  {text || <span className="text-gray-300 italic select-none">الورقة فارغة.. اكتب نصاً بالمسودة أعلاه لتتمكن من معاينته وطباعته.</span>}
                </div>
                {showFooter && (
                  <div className="text-center text-[9px] text-gray-400 border-t border-gray-100 pt-1 mt-6" style={{ fontSize: `${fontSize * 0.45}px` }}>
                    {footerText}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
