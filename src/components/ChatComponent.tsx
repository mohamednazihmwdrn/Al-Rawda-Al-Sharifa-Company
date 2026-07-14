import React, { useState, useEffect, useRef } from "react";
import { User } from "../types";
import { 
  Chat, 
  ChatMessage, 
  listenChats, 
  listenMessages, 
  sendMessage, 
  createOrGetDirectChat, 
  createGroupChat 
} from "../services/dbService";
import { getPrintUserName } from "../utils/print";

interface ChatComponentProps {
  currentUser: User;
  users: { [username: string]: User };
}

export default function ChatComponent({ currentUser, users }: ChatComponentProps) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessageText, setNewMessageText] = useState("");
  
  // Group creation states
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Listen to chats the current user is a participant of
  useEffect(() => {
    const unsub = listenChats(currentUser.username, setChats);
    return () => unsub();
  }, [currentUser.username]);

  // Listen to messages of active chat
  useEffect(() => {
    if (!activeChatId) {
      setMessages([]);
      return;
    }
    const unsub = listenMessages(activeChatId, setMessages);
    return () => unsub();
  }, [activeChatId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChatId || !newMessageText.trim()) return;

    try {
      await sendMessage(
        activeChatId,
        currentUser.username,
        currentUser.displayName || currentUser.username,
        newMessageText.trim()
      );
      setNewMessageText("");
    } catch (err) {
      console.error("Failed to send message:", err);
    }
  };

  const startDirectChat = async (targetUser: User) => {
    try {
      const chatId = await createOrGetDirectChat(
        currentUser.username,
        targetUser.username,
        targetUser.displayName || targetUser.username
      );
      setActiveChatId(chatId);
    } catch (err) {
      console.error("Failed to start direct chat:", err);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim() || selectedParticipants.length === 0) {
      alert("⚠️ الرجاء كتابة اسم المجموعة واختيار مشارك واحد على الأقل!");
      return;
    }

    try {
      const participants = Array.from(new Set([currentUser.username, ...selectedParticipants]));
      const chatId = await createGroupChat(groupName.trim(), participants);
      setActiveChatId(chatId);
      setGroupName("");
      setSelectedParticipants([]);
      setShowCreateGroup(false);
      alert("👥 تم إنشاء المجموعة بنجاح!");
    } catch (err) {
      console.error("Failed to create group:", err);
    }
  };

  const toggleParticipant = (username: string) => {
    setSelectedParticipants(prev => 
      prev.includes(username) 
        ? prev.filter(u => u !== username) 
        : [...prev, username]
    );
  };

  const activeChat = chats.find(c => c.id === activeChatId);

  // Format timestamp nicely
  const formatTime = (isoString: string) => {
    if (!isoString) return "";
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  const formatFullDate = (isoString: string) => {
    if (!isoString) return "";
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString("ar-EG", { month: "short", day: "numeric" });
    } catch {
      return "";
    }
  };

  // Determine chat header name (especially for direct chats where we want to see the OTHER person's name)
  const getChatDisplayName = (chat: Chat) => {
    if (chat.type === "group") return `👥 ${chat.name}`;
    
    // For direct chat, find the other participant
    const otherUsername = chat.participants.find(p => p !== currentUser.username);
    if (!otherUsername) return chat.name;
    const otherUser = users[otherUsername];
    return `👤 ${otherUser?.displayName || otherUsername}`;
  };

  return (
    <div className="bg-gray-50/50 min-h-[calc(100vh-140px)] rounded-3xl border border-gray-100 overflow-hidden flex flex-col md:flex-row shadow-sm">
      
      {/* Right Sidebar: Chat List */}
      <div className={`w-full md:w-80 bg-white border-l border-gray-100 flex flex-col ${activeChatId ? "hidden md:flex" : "flex"}`}>
        {/* Sidebar Header */}
        <div className="p-4 border-b border-gray-100 space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
              <span>💬 قسم الدردشة والتواصل</span>
            </h3>
            {currentUser.role === "مدير" && (
              <button
                onClick={() => setShowCreateGroup(!showCreateGroup)}
                className="p-2 bg-[#8b6b4d]/10 hover:bg-[#8b6b4d]/20 text-[#8b6b4d] rounded-xl transition-all text-xs font-bold flex items-center gap-1 cursor-pointer"
                title="إنشاء مجموعة جديدة"
              >
                <span>➕</span>
                <span>مجموعة جديدة</span>
              </button>
            )}
          </div>
        </div>

        {/* Create Group Form Panel */}
        {showCreateGroup && currentUser.role === "مدير" && (
          <form onSubmit={handleCreateGroup} className="p-4 bg-amber-50/50 border-b border-amber-100 space-y-3">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-gray-600">اسم المجموعة</label>
              <input
                type="text"
                placeholder="مثال: نقاش المستودعات الفوري..."
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="p-2 border rounded-xl text-xs bg-white focus:outline-[#8b6b4d]"
                required
              />
            </div>
            
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-gray-600 block">اختر الأعضاء المشاركين:</label>
              <div className="max-h-32 overflow-y-auto space-y-1 bg-white p-2 rounded-xl border border-gray-100">
                {Object.values(users).map((u) => {
                  if (u.username === currentUser.username) return null;
                  return (
                    <label key={u.username} className="flex items-center gap-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 p-1 rounded-lg cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedParticipants.includes(u.username)}
                        onChange={() => toggleParticipant(u.username)}
                        className="accent-[#8b6b4d]"
                      />
                      <span>{getPrintUserName(u.displayName || u.username)} ({u.role})</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold transition-all cursor-pointer"
              >
                💾 إنشاء المجموعة
              </button>
              <button
                type="button"
                onClick={() => setShowCreateGroup(false)}
                className="px-2 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-[11px] font-bold transition-all cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </form>
        )}

        {/* Chats and Users List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-4">
          {/* Active Conversations Section */}
          <div className="space-y-1">
            <h4 className="text-[10px] font-bold text-gray-400 px-2 uppercase tracking-wider mb-2">💬 المحادثات النشطة</h4>
            {chats.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">لا توجد محادثات جارية حالياً</p>
            ) : (
              chats.map((chat) => {
                const isActive = chat.id === activeChatId;
                return (
                  <button
                    key={chat.id}
                    onClick={() => setActiveChatId(chat.id)}
                    className={`w-full text-right p-3 rounded-xl transition-all flex flex-col gap-1 cursor-pointer border ${
                      isActive 
                        ? "bg-[#8b6b4d]/10 border-[#8b6b4d]/20 text-[#8b6b4d]" 
                        : "bg-white hover:bg-gray-50 border-gray-100 text-gray-700"
                    }`}
                  >
                    <div className="flex justify-between items-center w-full">
                      <strong className="text-sm font-bold truncate">
                        {getChatDisplayName(chat)}
                      </strong>
                      <span className="text-[9px] text-gray-400">
                        {chat.lastMessageTime ? formatTime(chat.lastMessageTime) : ""}
                      </span>
                    </div>
                    {chat.lastMessage && (
                      <div className="text-xs text-gray-400 truncate flex justify-between items-center w-full">
                        <span className="truncate">
                          {chat.lastMessageSender === (currentUser.displayName || currentUser.username) ? "أنت: " : `${chat.lastMessageSender}: `}
                          {chat.lastMessage}
                        </span>
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Quick Start New Chat Section */}
          <div className="space-y-1 pt-2 border-t border-gray-100/70">
            <h4 className="text-[10px] font-bold text-gray-400 px-2 uppercase tracking-wider mb-2">👥 ابدأ محادثة مباشرة مع:</h4>
            <div className="space-y-1">
              {Object.values(users).map((u) => {
                if (u.username === currentUser.username) return null;
                return (
                  <button
                    key={u.username}
                    onClick={() => startDirectChat(u)}
                    className="w-full text-right p-2.5 rounded-xl bg-white hover:bg-gray-50 border border-gray-100 flex items-center justify-between text-xs font-semibold text-gray-700 transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span>{getPrintUserName(u.displayName || u.username)}</span>
                    </div>
                    <span className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded-md text-gray-500">
                      {u.role === "مدير" ? "إدارة" : "مستودع"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Left Chat Window Area */}
      <div className={`flex-1 flex flex-col bg-white ${!activeChatId ? "hidden md:flex justify-center items-center p-8 text-center" : "flex"}`}>
        {activeChatId && activeChat ? (
          <>
            {/* Chat Area Header */}
            <div className="p-4 border-b border-gray-100 bg-white flex items-center gap-3 justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setActiveChatId(null)}
                  className="md:hidden p-1.5 hover:bg-gray-100 rounded-lg text-gray-600 cursor-pointer"
                  title="رجوع للمحادثات"
                >
                  <span>🔙 رجوع</span>
                </button>
                <div>
                  <h4 className="font-bold text-gray-800 text-base">{getChatDisplayName(activeChat)}</h4>
                  <p className="text-[10px] text-gray-400">
                    مشارك في المحادثة: {activeChat.participants.map(p => getPrintUserName(users[p]?.displayName || p)).join(" | ")}
                  </p>
                </div>
              </div>
            </div>

            {/* Chat Messages Log */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col justify-center items-center text-center p-6 text-gray-400 space-y-1">
                  <span className="text-3xl">👋</span>
                  <p className="text-xs font-bold">أرسل رسالة للبدء في نقاش فوري وآمن مع هذا المخزن!</p>
                </div>
              ) : (
                messages.map((msg, idx) => {
                  const isMe = msg.sender === currentUser.username;
                  return (
                    <div key={msg.id || idx} className={`flex ${isMe ? "justify-start" : "justify-end"}`}>
                      <div className={`max-w-[80%] p-3.5 rounded-2xl shadow-sm text-sm ${
                        isMe 
                          ? "bg-[#8b6b4d] text-white rounded-tr-none" 
                          : "bg-white border border-gray-100 text-gray-800 rounded-tl-none"
                      }`}>
                        {/* Sender Display Name (only if it's a group and not me) */}
                        {!isMe && activeChat.type === "group" && (
                          <div className="text-[10px] font-bold text-[#8b6b4d] mb-1">
                            {getPrintUserName(msg.senderName)}
                          </div>
                        )}
                        <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                        <div className={`text-[9px] mt-1.5 flex justify-end ${isMe ? "text-amber-100/80" : "text-gray-400"}`}>
                          {formatTime(msg.timestamp)}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input Bar */}
            <form onSubmit={handleSendMessage} className="p-3 border-t border-gray-100 bg-white flex gap-2 items-center">
              <input
                type="text"
                placeholder="اكتب رسالتك وتوجيهاتك هنا..."
                value={newMessageText}
                onChange={(e) => setNewMessageText(e.target.value)}
                className="flex-1 p-2.5 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-[#8b6b4d] focus:outline-none transition-all text-sm"
                required
              />
              <button
                type="submit"
                className="p-2.5 bg-[#8b6b4d] hover:bg-[#725439] text-white rounded-xl transition-all font-bold flex items-center justify-center cursor-pointer px-4 gap-1 text-xs"
              >
                <span>🚀 إرسال</span>
              </button>
            </form>
          </>
        ) : (
          <div className="space-y-3">
            <div className="text-5xl">💬</div>
            <h4 className="font-bold text-gray-600 text-base">بريد الدردشة الفوري</h4>
            <p className="text-xs text-gray-400 max-w-sm">
              اختر أحد المخازن أو المجموعات النشطة من القائمة الجانبية لبدء المحادثة الفورية وتوجيه التعليمات بكل دقة وسهولة.
            </p>
          </div>
        )}
      </div>

    </div>
  );
}
