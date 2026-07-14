import React, { useState, useEffect } from "react";
import { User } from "../types";
import { getRandomAyat } from "../data/constants";

interface LoginProps {
  users: { [key: string]: User };
  onLoginSuccess: (user: User) => void;
}

export default function Login({ users, onLoginSuccess }: LoginProps) {
  const [username, setUsername] = useState("مدير");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [ayat, setAyat] = useState({ text: "", reference: "" });

  useEffect(() => {
    setAyat(getRandomAyat());
    const interval = setInterval(() => {
      setAyat(getRandomAyat());
    }, 60000); // 1 minute
    return () => clearInterval(interval);
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const user = users[username];
    if (user && user.password === password) {
      setError(false);
      onLoginSuccess(user);
    } else {
      setError(true);
    }
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-[#1e2b3c] to-[#2c3e50] flex items-center justify-center z-[9999] p-4">
      <div className="bg-white p-8 md:p-10 rounded-3xl max-w-md w-full shadow-2xl animate-fade-in-up border border-[#d4b48c]/30">
        <h2 className="text-[#8b6b4d] text-center text-3xl font-bold mb-2">🌹 الروضة الشريفة</h2>
        <p className="text-center text-gray-500 mb-4 text-sm">مرحباً بك كيف حالك اليوم</p>
        
        {ayat.text && (
          <div className="text-center bg-[#f5f2ed] p-4 rounded-2xl border-r-4 border-[#8b6b4d] mb-6 shadow-xs">
            <p className="text-[#8b6b4d] text-base md:text-lg font-extrabold leading-relaxed">"{ayat.text}"</p>
            <span className="text-xs text-gray-500 font-bold block mt-1.5">({ayat.reference})</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="font-semibold text-sm text-[#1e2b3c]">اختر المستخدم</label>
            <select
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full p-3 border-2 border-gray-200 rounded-2xl bg-white focus:border-[#8b6b4d] focus:outline-none transition-all text-sm"
            >
              {(() => {
                const order = ["مدير", "مخزن النحاس", "مخزن النادي"];
                const sortedKeys = Object.keys(users).sort((a, b) => {
                  const idxA = order.indexOf(a);
                  const idxB = order.indexOf(b);
                  if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                  if (idxA !== -1) return -1;
                  if (idxB !== -1) return 1;
                  return a.localeCompare(b, "ar");
                });

                return sortedKeys.map((key) => {
                  const u = users[key];
                  return (
                    <option key={key} value={key}>
                      {u.displayName || u.username} {u.role && u.role !== "مدير" ? `(${u.role})` : ""}
                    </option>
                  );
                });
              })()}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="font-semibold text-sm text-[#1e2b3c]">كلمة السر</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 border-2 border-gray-200 rounded-2xl focus:border-[#8b6b4d] focus:outline-none transition-all text-sm text-left"
              dir="ltr"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full py-3.5 bg-[#8b6b4d] text-white rounded-2xl font-bold hover:bg-[#6d4f34] transition-all transform hover:-translate-y-0.5 shadow-md shadow-[#8b6b4d]/20 text-lg cursor-pointer"
          >
            تسجيل الدخول
          </button>
        </form>

        {error && (
          <div className="text-red-500 text-center text-sm mt-4 font-medium animate-bounce">
            ⚠️ كلمة السر غير صحيحة!
          </div>
        )}
      </div>
    </div>
  );
}
