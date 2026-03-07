import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send, Loader2, Bot, User, Sparkles } from 'lucide-react';
import { sendClinicaQuery } from '../../lib/clinicaApi';
import { supabase } from '../../lib/supabase';
import ToolResultCard from './ToolResultCard';
import AuthPromptCard from './AuthPromptCard';

const STORAGE_PREFIX_MESSAGES = 'clinica_chat_';
const STORAGE_PREFIX_SESSION = 'clinica_session_';
const ANON_KEY = 'anon';

function storageKeys(userId) {
  const key = userId || ANON_KEY;
  return {
    messages: STORAGE_PREFIX_MESSAGES + key,
    session: STORAGE_PREFIX_SESSION + key,
  };
}

function loadStored(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function rehydrateMessages(msgs) {
  return msgs.map(m => ({ ...m, timestamp: m.timestamp ? new Date(m.timestamp) : new Date() }));
}

function getInitialUserId() {
  // Check if there's a cached user ID from a previous session
  try {
    const raw = localStorage.getItem('clinica_current_uid');
    return raw || null;
  } catch { return null; }
}

const SUGGESTED_QUERIES = [
  { label: 'ابحث عن طبيب', query: 'ابحث لي عن طبيب' },
  { label: 'مواعيدي', query: 'اعرض مواعيدي' },
  { label: 'سجلي الطبي', query: 'اعرض سجلي الطبي' },
  { label: 'الأطباء المتاحين', query: 'اعرض الأطباء المتاحين' },
];

export default function ChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(getInitialUserId);
  const keys = storageKeys(currentUserId);
  const [messages, setMessages] = useState(() => rehydrateMessages(loadStored(keys.messages, [])));
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(() => loadStored(keys.session, null));
  const [hasNewMessage, setHasNewMessage] = useState(false);

  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const wasAuthenticatedRef = useRef(null);
  const pendingContextRef = useRef(null);

  // Persist messages to the current user's localStorage key
  useEffect(() => {
    const k = storageKeys(currentUserId);
    try { localStorage.setItem(k.messages, JSON.stringify(messages)); } catch {}
  }, [messages, currentUserId]);

  // Persist sessionId to the current user's localStorage key
  useEffect(() => {
    const k = storageKeys(currentUserId);
    try {
      if (sessionId) localStorage.setItem(k.session, JSON.stringify(sessionId));
      else localStorage.removeItem(k.session);
    } catch {}
  }, [sessionId, currentUserId]);

  // Auth state listener: swap storage when user changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const uid = data?.session?.user?.id || null;
      wasAuthenticatedRef.current = !!data?.session;
      if (uid !== currentUserId) {
        setCurrentUserId(uid);
        try { localStorage.setItem('clinica_current_uid', uid || ''); } catch {}
        const k = storageKeys(uid);
        setMessages(rehydrateMessages(loadStored(k.messages, [])));
        setSessionId(loadStored(k.session, null));
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const isNowAuthenticated = !!session;
      const wasPreviouslyAuthenticated = wasAuthenticatedRef.current;
      wasAuthenticatedRef.current = isNowAuthenticated;

      if (event === 'SIGNED_IN' && wasPreviouslyAuthenticated === false) {
        const uid = session.user.id;
        const anonKeys = storageKeys(null);
        const userKeys = storageKeys(uid);

        // Migrate anonymous conversation to the user's storage if user has no existing history
        const existingUserMsgs = loadStored(userKeys.messages, []);
        const anonMsgs = loadStored(anonKeys.messages, []);

        let mergedMessages;
        if (existingUserMsgs.length === 0 && anonMsgs.length > 0) {
          // First login with an active anon conversation: migrate it
          mergedMessages = [...anonMsgs];
          // Build context for the new authenticated session
          const contextLines = anonMsgs
            .filter(m => m.role === 'user' || m.role === 'assistant')
            .map(m => `${m.role === 'user' ? 'Patient' : 'Assistant'}: ${m.text}`)
            .join('\n');
          if (contextLines) pendingContextRef.current = contextLines;
        } else {
          mergedMessages = existingUserMsgs;
        }

        // Add login confirmation
        mergedMessages.push({
          role: 'assistant',
          text: 'تم تسجيل الدخول بنجاح! يمكنك الآن الوصول إلى جميع الخدمات.',
          timestamp: new Date().toISOString(),
        });

        // Clear anonymous storage
        try {
          localStorage.removeItem(anonKeys.messages);
          localStorage.removeItem(anonKeys.session);
        } catch {}

        // Switch to user-scoped storage
        setCurrentUserId(uid);
        try { localStorage.setItem('clinica_current_uid', uid); } catch {}
        setMessages(rehydrateMessages(mergedMessages));
        setSessionId(null);
      }

      if (event === 'SIGNED_OUT') {
        // Reset to anonymous empty chat
        setCurrentUserId(null);
        try { localStorage.removeItem('clinica_current_uid'); } catch {}
        setMessages([]);
        setSessionId(null);
        pendingContextRef.current = null;
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const handleSend = useCallback(async (queryText) => {
    const query = (queryText || input).trim();
    if (!query || isLoading) return;

    // Add user message
    const userMsg = { role: 'user', text: query, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      let fullQuery = query;
      if (pendingContextRef.current) {
        fullQuery = `[Previous conversation context - continue from where we left off]:\n${pendingContextRef.current}\n\n[Current request]: ${query}`;
        pendingContextRef.current = null;
      }

      const response = await sendClinicaQuery(fullQuery, sessionId);

      // Save session ID from first response
      if (response.sessionId) {
        setSessionId(response.sessionId);
      }

      // Server requires authentication — show inline auth prompt
      if (response.type === 'auth_required') {
        setMessages(prev => [
          ...prev,
          {
            role: 'auth_prompt',
            text: response.message,
            timestamp: new Date(),
          },
        ]);
        return;
      }

      // Add assistant message
      const assistantMsg = {
        role: 'assistant',
        text: response.text || '',
        toolResults: response.toolResults || [],
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMsg]);

      // Notify if chat is closed
      if (!isOpen) setHasNewMessage(true);

    } catch (err) {
      console.error('Chatbot error:', err);
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          text: 'عذرا، حدث خطأ في الاتصال. يرجى المحاولة مرة أخرى.',
          timestamp: new Date(),
          isError: true,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, sessionId, isOpen]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleChat = () => {
    setIsOpen(prev => !prev);
    setHasNewMessage(false);
  };

  return (
    <>
      {/* ─── Chat Panel ─── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-24 left-5 z-50 w-[380px] max-w-[calc(100vw-40px)] h-[560px] max-h-[calc(100vh-120px)] bg-background rounded-3xl shadow-2xl border border-primary/10 flex flex-col overflow-hidden"
            dir="rtl"
          >
            {/* Header */}
            <div className="bg-primary px-5 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-accent/20 rounded-xl flex items-center justify-center">
                  <Bot size={22} className="text-accent" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-white text-base">Clinica AI</h3>
                  <p className="text-white/50 text-xs font-sans">مساعدك الطبي الذكي</p>
                </div>
              </div>
              <button
                onClick={toggleChat}
                className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors"
              >
                <X size={18} className="text-white/70" />
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth">
              {/* Welcome message if empty */}
              {messages.length === 0 && !isLoading && (
                <div className="flex flex-col items-center text-center py-6">
                  <div className="w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center mb-4">
                    <Sparkles size={28} className="text-accent" />
                  </div>
                  <h4 className="font-heading font-bold text-primary text-lg mb-1">مرحبا بك!</h4>
                  <p className="font-sans text-text/50 text-sm mb-6 leading-relaxed max-w-[260px]">
                    أنا مساعدك الطبي الذكي. يمكنني مساعدتك في البحث عن أطباء، حجز المواعيد، وعرض سجلك الطبي.
                  </p>
                  <div className="flex flex-wrap justify-center gap-2 w-full">
                    {SUGGESTED_QUERIES.map((sq, i) => (
                      <button
                        key={i}
                        onClick={() => { setInput(sq.query); inputRef.current?.focus(); }}
                        className="px-3 py-2 bg-white rounded-xl border border-primary/10 text-xs font-sans font-medium text-primary hover:border-accent hover:text-accent transition-colors"
                      >
                        {sq.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Message bubbles */}
              {messages.map((msg, i) =>
                msg.role === 'auth_prompt' ? (
                  <AuthPromptCard key={i} message={msg.text} />
                ) : (
                  <MessageBubble key={i} message={msg} onFillInput={(text) => { setInput(text); inputRef.current?.focus(); }} />
                )
              )}

              {/* Loading indicator */}
              {isLoading && (
                <div className="flex items-start gap-2">
                  <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot size={14} className="text-accent" />
                  </div>
                  <div className="bg-white rounded-2xl rounded-tr-sm px-4 py-3 border border-primary/5 shadow-sm">
                    <div className="flex gap-1.5">
                      <span className="w-2 h-2 bg-primary/20 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-primary/20 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-primary/20 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Input Bar */}
            <div className="p-3 border-t border-primary/5 bg-white shrink-0">
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="اكتب رسالتك..."
                  disabled={isLoading}
                  className="flex-1 px-4 py-2.5 bg-background rounded-xl font-sans text-sm text-primary placeholder:text-text/30 focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-60"
                />
                <button
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isLoading}
                  className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center text-primary hover:bg-accent/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                >
                  {isLoading ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Send size={18} className="rotate-180" />
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Floating Bubble ─── */}
      <motion.button
        onClick={toggleChat}
        className="fixed bottom-6 left-6 z-50 w-14 h-14 bg-accent rounded-2xl shadow-lg shadow-accent/30 flex items-center justify-center text-primary hover:scale-110 hover:shadow-xl hover:shadow-accent/40 transition-all duration-200"
        whileTap={{ scale: 0.9 }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 15, delay: 0.5 }}
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}>
              <X size={24} />
            </motion.div>
          ) : (
            <motion.div key="chat" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }}>
              <MessageCircle size={24} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Notification badge */}
        {hasNewMessage && !isOpen && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white animate-pulse" />
        )}
      </motion.button>
    </>
  );
}

// ─── Message Bubble ───
function MessageBubble({ message, onFillInput }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex items-start gap-2 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
        isUser ? 'bg-primary/10' : 'bg-accent/10'
      }`}>
        {isUser ? <User size={14} className="text-primary" /> : <Bot size={14} className="text-accent" />}
      </div>

      {/* Bubble */}
      <div className={`max-w-[85%] space-y-2 ${isUser ? 'items-end' : 'items-start'}`}>
        <div className={`rounded-2xl px-4 py-2.5 text-sm font-sans leading-relaxed ${
          isUser
            ? 'bg-primary text-white rounded-tl-sm'
            : message.isError
              ? 'bg-red-50 text-red-700 border border-red-200 rounded-tr-sm'
              : 'bg-white text-text border border-primary/5 shadow-sm rounded-tr-sm'
        }`}>
          {message.text && <p className="whitespace-pre-wrap">{message.text}</p>}
        </div>

        {/* Tool Results */}
        {message.toolResults?.length > 0 && (
          <div className="space-y-2 mt-1">
            {message.toolResults.map((tr, i) => (
              <ToolResultCard key={i} toolName={tr.toolName} data={tr.data} onFillInput={onFillInput} />
            ))}
          </div>
        )}

        {/* Timestamp */}
        <p className={`text-[10px] font-sans text-text/30 px-1 ${isUser ? 'text-left' : 'text-right'}`}>
          {message.timestamp?.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
}
