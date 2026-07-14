import React from "react";
import { User } from "../types";

interface PrivacyPolicyProps {
  currentUser: User;
}

export default function PrivacyPolicy({ currentUser }: PrivacyPolicyProps) {
  return (
    <div className="bg-white p-6 md:p-10 rounded-2xl shadow-md border border-gray-100 space-y-10 text-right max-w-5xl mx-auto" dir="rtl">
      {/* Header section with enhanced premium styling */}
      <div className="border-b-2 border-gray-100 pb-8 text-center space-y-4">
        <div className="w-20 h-20 bg-[#8b6b4d]/10 text-[#8b6b4d] rounded-full flex items-center justify-center mx-auto text-4xl shadow-sm">
          🛡️
        </div>
        <h1 className="text-3xl font-black text-gray-900 tracking-tight">سياسة الخصوصية وأمان وحماية البيانات الشاملة للنظام</h1>
        <p className="text-sm text-[#8b6b4d] font-bold">وثيقة رسمية تنظم أمان البيانات، ملكية النظام، وحقوق الاستخدام</p>
        <p className="text-xs text-gray-400">آخر تحديث وتعديل شامل: يوليو ٢٠٢٦</p>
      </div>

      {/* Introduction */}
      <div className="space-y-4 bg-amber-50/25 p-6 rounded-2xl border border-[#8b6b4d]/15">
        <h3 className="font-bold text-[#8b6b4d] text-lg flex items-center gap-2">
          <span>ℹ️</span> تمهيد ومقدمة عامة
        </h3>
        <p className="text-sm text-gray-700 leading-relaxed">
          يرحب بكم نظام إدارة النواقص والمستودعات وعروض الأسعار الذكي والخاص بشركة <strong>"الروضة الشريفة"</strong>. 
          توضح هذه الاتفاقية والسياسة الأمنية كافة التفاصيل المتعلقة بآلية جمع وحفظ ومعالجة البيانات التجارية الحساسة لشركتكم وفروعكم ومستودعاتكم. 
          لقد تم تصميم وتطوير وهيكلة هذا النظام بأقصى درجات الحماية والأمان لضمان الحفاظ التام على أسرار وسير العمل اليومي لديكم، 
          ومنع أي تسريب للمعلومات التجارية تحت أي ظرف من الظروف.
        </p>
      </div>

      {/* Core Privacy Sections */}
      <div className="space-y-8">
        
        {/* Section 1: Data collection & processing */}
        <section className="space-y-3 bg-white p-5 rounded-2xl border border-gray-100 shadow-3xs">
          <h3 className="font-extrabold text-gray-900 text-base flex items-center gap-2">
            <span className="text-emerald-600">📊</span> أولاً: البيانات التفصيلية التي تتم معالجتها وحفظها
          </h3>
          <p className="text-sm text-gray-600 leading-relaxed pr-6">
            يقوم النظام بالتعامل الفني السحابي ومعالجة البيانات التي يتم إدخالها من قبل المستخدمين المخولين، وتنقسم إلى الأقسام التالية بالتفصيل:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pr-6 pt-2">
            <div className="bg-gray-50 p-4 rounded-xl space-y-1.5">
              <strong className="text-xs text-[#8b6b4d] block">📦 بيانات النواقص وعجز المستودعات</strong>
              <p className="text-[11px] text-gray-500 leading-relaxed">
                تشمل أسماء النواقص والسلع، وتصنيفات الشركات المنتجة لها بدقة (مثل شركات GLC, JOTUN, Skip، وغيرها)، والكميات المطلوبة لكل بند، والملاحظات الإضافية المرفقة لتوضيح الاحتياجات اللوجستية لكل مستودع فرعي.
              </p>
            </div>
            <div className="bg-gray-50 p-4 rounded-xl space-y-1.5">
              <strong className="text-xs text-[#8b6b4d] block">📨 الفواتير والطلبات المعتمدة</strong>
              <p className="text-[11px] text-gray-500 leading-relaxed">
                تشمل عمليات تجميع الفواتير، وحالات التسليم الخاصة بها (تم الاستلام بالكامل، بضائع معلقة بالمستودعات، أو بنود متأخرة) مع حفظ التاريخ والوقت المفصل لكل إجراء تجاري مسجل.
              </p>
            </div>
            <div className="bg-gray-50 p-4 rounded-xl space-y-1.5">
              <strong className="text-xs text-[#8b6b4d] block">💵 عروض الأسعار وحسابات العملاء</strong>
              <p className="text-[11px] text-gray-500 leading-relaxed">
                تشمل عروض الأسعار الصادرة للعملاء متضمنة تفاصيل الأصناف المحسوبة والأسعار الإجمالية وحسابات الهواتف والأسماء الاختيارية، وتخضع لسرية تامة لحماية أسعار وعروض الشركة.
              </p>
            </div>
            <div className="bg-gray-50 p-4 rounded-xl space-y-1.5">
              <strong className="text-xs text-[#8b6b4d] block">💬 المحادثات والدردشة الداخلية الفورية</strong>
              <p className="text-[11px] text-gray-500 leading-relaxed">
                تُحفظ سجلات الرسائل المرسلة داخل قسم المحادثات الفورية المدمج في النظام لضمان توثيق الملاحظات المتبادلة وتسهيل وتسريع التنسيق بين المستودعات والمدير العام.
              </p>
            </div>
          </div>
        </section>

        {/* Section 2: Roles & Security Permissions */}
        <section className="space-y-3 bg-white p-5 rounded-2xl border border-gray-100 shadow-3xs">
          <h3 className="font-extrabold text-gray-900 text-base flex items-center gap-2">
            <span className="text-[#8b6b4d]">🔐</span> ثانياً: نظام هيكلة الصلاحيات الحديدية (User Access Control)
          </h3>
          <p className="text-sm text-gray-600 leading-relaxed pr-6">
            يعتمد النظام على تصميم برمجي صارم يفصل بين صلاحيات وأدوار المستخدمين لضمان خصوصية مطلقة وسرية تامة للمعلومات:
          </p>
          <ul className="list-disc pr-12 text-xs text-gray-600 space-y-2.5">
            <li>
              <strong>حساب المدير العام (المدير):</strong> يتمتع بحق الإشراف والمراقبة الكاملة لكافة الفروع والمستودعات والتقارير الشاملة، ويحق له استعراض سجل الأنشطة والتدفقات المالية وعروض الأسعار، وتعديل بيانات مستخدمي النظام بالكامل.
            </li>
            <li>
              <strong>حسابات مستودعات الفروع (المخازن):</strong> يقتصر إذن الدخول والوصول الممنوح لهم فقط على النواقص والإدخالات والبيانات التابعة لمستودعهم الخاص فحسب. لا يسمح برمجيّاً لأي مستودع فرعي بالاطلاع على نواقص أو فواتير أو نشاط أي فرع أو مستودع آخر، لضمان أعلى مستويات الأمان اللامركزي.
            </li>
          </ul>
        </section>

        {/* Section 3: 10 PM UI Cleanup and Archiving Policy */}
        <section className="space-y-3 bg-white p-5 rounded-2xl border border-gray-100 shadow-3xs">
          <h3 className="font-extrabold text-gray-900 text-base flex items-center gap-2">
            <span className="text-blue-600">🕒</span> ثالثاً: آلية الإغلاق والتنظيف اليومي التلقائي (Daily UI Filter)
          </h3>
          <p className="text-sm text-gray-600 leading-relaxed pr-6">
            تأكيداً على حيوية وتجدد لوحة التحكم اليومية وبناءً على الطلب الخاص للإدارة:
          </p>
          <ul className="list-disc pr-12 text-xs text-gray-600 space-y-2.5">
            <li>
              <strong>فلتر الإغلاق بعد الساعة العاشرة (10:00 مساءً):</strong> عند حلول الساعة العاشرة مساءً يومياً، يتم تفعيل مرشح بصري تلقائي يقوم بإخفاء نواقص اليوم النشطة والمنجزة من واجهة لوحة التحكم الرئيسية لتهيئة الواجهة لاستقبال مهام اليوم التالي بوضوح ومرونة وسلاسة تامة.
            </li>
            <li>
              <strong>الحفاظ الكامل والأمن على السجلات التاريخية:</strong> نؤكد ونشدد على أن تصفية وإخفاء النواقص بعد الساعة العاشرة مساءً هو إجراء تصفية بصري مؤقت ومحدد بالواجهة فقط لترتيبها، <strong>ولا يترتب عليه نهائياً أي حذف أو مسح للبيانات من النظام أو قاعدة البيانات</strong>. تظل جميع السجلات، الطلبات، الفواتير، النواقص، والأرقام التاريخية محفوظة ومسجلة بشكل كامل وبأدق تفاصيلها داخل قسم <strong>"الأرشيف"</strong> وقسم <strong>"التقارير التفصيلية"</strong> للرجوع إليها في أي وقت دون أي فقدان أو نقص للمميزات.
            </li>
          </ul>
        </section>

        {/* Section 4: Infrastructure & Database */}
        <section className="space-y-3 bg-white p-5 rounded-2xl border border-gray-100 shadow-3xs">
          <h3 className="font-extrabold text-gray-900 text-base flex items-center gap-2">
            <span className="text-indigo-600">☁️</span> رابعاً: البنية التحتية السحابية وقواعد البيانات
          </h3>
          <p className="text-sm text-gray-600 leading-relaxed pr-6">
            يعتمد نظام الروضة الشريفة على تقنيات سحابية رائدة ومستقرة:
          </p>
          <ul className="list-disc pr-12 text-xs text-gray-600 space-y-2">
            <li><strong>خوادم الاستضافة:</strong> يتم تشغيل خوادم النظام على منصة <strong>Google Cloud Platform</strong> باستخدام تقنية Containers فائقة الأداء والمحمية بجدران نارية لحجب الاتصالات غير المصرح بها.</li>
            <li><strong>قاعدة البيانات السحابية الحية:</strong> يتم تخزين السجلات في قاعدة بيانات <strong>Google Firestore</strong> المؤمنة بنظام قواعد الأمان الصارم (Security Rules)، مما يضمن عدم تمكن أي شخص من قراءة أو كتابة البيانات دون أن يكون مستخدماً معتمداً ومسجلاً رسمياً من قبل الإدارة.</li>
          </ul>
        </section>

        {/* Developer Info: Extremely Highlighted & Detailed */}
        <section className="bg-gradient-to-br from-[#8b6b4d]/10 via-amber-50/5 to-transparent p-6 md:p-8 rounded-2xl border-2 border-[#8b6b4d]/20 space-y-6">
          <div className="border-b border-[#8b6b4d]/20 pb-3">
            <h3 className="font-black text-gray-950 text-xl flex items-center gap-2">
              <span>👨‍💻</span> خامساً: المطور الفني المسؤول وصاحب الملكية الفكرية
            </h3>
            <p className="text-xs text-gray-500 mt-1">المطور الحصري للنظام والدعم البرمجي والهندسي المباشر</p>
          </div>
          
          <div className="text-sm text-gray-700 leading-relaxed space-y-3">
            <p>
              تم تصميم وبرمجة وتطوير وهيكلة هذا النظام السحابي بالكامل بشكل مخصص وحصري لشركة <strong>"الروضة الشريفة"</strong>، بواسطة المهندس البرمجي المسؤول عن الدعم الفني، الصيانة الدورية وتحديثات الأمان للنظام:
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="bg-white p-5 rounded-2xl border border-gray-100 flex items-center gap-4 shadow-sm">
              <span className="text-3xl bg-amber-50 p-3 rounded-full">👤</span>
              <div>
                <span className="block text-xs text-gray-400">المهندس ومطور النظام المسؤول</span>
                <strong className="text-base text-gray-800 font-extrabold">م. محمد نزيه</strong>
              </div>
            </div>
            
            <div className="bg-white p-5 rounded-2xl border border-gray-100 flex items-center gap-4 shadow-sm">
              <span className="text-3xl bg-emerald-50 p-3 rounded-full">📱</span>
              <div>
                <span className="block text-xs text-gray-400">للاتصال الهاتفي والدعم الفني الفوري</span>
                <a href="tel:01029190615" className="text-base text-emerald-600 font-black hover:underline select-all" dir="ltr">
                  01029190615
                </a>
              </div>
            </div>
          </div>

          <div className="bg-red-50/50 p-4 rounded-xl border border-red-100 text-xs text-red-800 leading-relaxed space-y-2">
            <p className="font-extrabold flex items-center gap-1.5">
              <span>⚠️</span> إشعار حقوق الطبع والنشر والملكية الفكرية والقانونية:
            </p>
            <p className="font-medium pr-5">
              إن هذا النظام بجميع شفراته البرمجية (Source Code)، وتصاميمه الواجهية وقواعد بياناته المهيكلة، هو ملكية فكرية حصرية ومحفوظة بالكامل للمطور البرمجي <strong>المهندس محمد نزيه</strong>. يُحظر تماماً وبشكل قاطع إعادة نسخ، أو توزيع، أو تعديل، أو هندسة عكسية، أو بيع، أو محاولة نقل النظام للعمل لدى أي جهة تجارية أخرى دون موافقة كتابية صريحة وموقعة وموثقة من قبل المهندس محمد نزيه. أي مخالفة لهذه البنود تعرض فاعلها للمساءلة القانونية والقضائية طبقاً لقوانين حماية الملكية الفكرية والجرائم الإلكترونية السارية.
            </p>
          </div>
        </section>

        {/* Section 6: User Rights & Backup */}
        <section className="space-y-3 bg-white p-5 rounded-2xl border border-gray-100 shadow-3xs">
          <h3 className="font-extrabold text-gray-900 text-base flex items-center gap-2">
            <span className="text-rose-600">🚨</span> سادساً: التزامات أمان الحسابات والنسخ الاحتياطي للبيانات
          </h3>
          <p className="text-sm text-gray-600 leading-relaxed pr-6">
            لضمان استمرارية وأمان العمل على أكمل وجه وبدون انقطاع:
          </p>
          <ul className="list-disc pr-12 text-xs text-gray-600 space-y-2.5">
            <li><strong>تغيير كلمات المرور وسرية الولوج:</strong> يلتزم كل مستخدم بالحفاظ على سرية حسابه المسجل بالموقع، وكلمة المرور الخاصة به، وعدم مشاركتها مع أي جهة خارجية أو عمالة غير مصرح لها تجنباً للتلاعب بالبيانات.</li>
            <li><strong>النسخ الاحتياطي الدوري:</strong> يتيح النظام لمدير النظام العام إمكانية تصدير واستيراد قواعد البيانات وإجراء عمليات النسخ الاحتياطي وحفظها بشكل آمن، لضمان استعادة البيانات الفورية في الحالات الطارئة.</li>
          </ul>
        </section>
      </div>

      {/* Footer copyright */}
      <div className="border-t-2 border-gray-100 pt-8 text-center text-xs text-gray-400 flex flex-col sm:flex-row justify-between items-center gap-4">
        <span className="font-bold text-gray-500">حقوق البرمجة والتطوير محفوظة بالكامل © ٢٠٢٦ المهندس محمد نزيه</span>
        <span className="bg-[#8b6b4d]/5 px-4 py-1.5 rounded-full text-[#8b6b4d] font-bold text-xs shadow-3xs">
          نظام إدارة المستودعات والروضة الشريفة v2.5
        </span>
      </div>
    </div>
  );
}
