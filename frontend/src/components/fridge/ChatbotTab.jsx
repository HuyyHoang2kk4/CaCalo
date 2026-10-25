/**
 * MỤC ĐÍCH: Màn hình Trợ lý AI Dinh dưỡng (CC-3.4) — Chatbot RAG.
 * KIẾN TRÚC: AI được inject context từ DB (món ăn, hồ sơ user, nhật ký hôm nay).
 *            AI chỉ diễn đạt — số liệu Calo/Macro luôn từ DB (AI Guardrails).
 * ĐẦU VÀO: userProfile (hồ sơ người dùng để hiển thị gợi ý câu hỏi phù hợp)
 */
import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, User, Sparkles, RotateCcw, Info } from 'lucide-react';
import { chatWithAI } from '../../services/api';

// Câu hỏi gợi ý theo từng ý định
const SUGGESTED_QUESTIONS = [
  { text: 'Hôm nay tôi đã ăn bao nhiêu calo?', icon: '📊' },
  { text: 'Chỉ số BMI và TDEE của tôi là bao nhiêu?', icon: '📏' },
  { text: 'Nên ăn gì để đủ ngân sách calo còn lại?', icon: '🍽️' },
  { text: 'Phở bò bao nhiêu calo một tô?', icon: '🍜' },
  { text: 'Tôi đang có ức gà và cà chua, nấu gì ngon?', icon: '🧑‍🍳' },
  { text: 'Bữa tối nên ăn gì để giảm cân?', icon: '🥗' },
];

function ChatMessage({ msg }) {
  const isUser = msg.role === 'user';
  const isSystem = msg.role === 'system';

  if (isSystem) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '8px 12px', backgroundColor: 'var(--bg-surface)',
        borderRadius: 'var(--radius-inner)', margin: '8px 0',
        fontSize: '0.78rem', color: 'var(--text-muted)',
      }}>
        <Info size={13} />
        <span>{msg.content}</span>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: isUser ? 'row-reverse' : 'row',
      alignItems: 'flex-end', gap: '10px', marginBottom: '14px',
    }}>
      {/* Avatar */}
      <div style={{
        width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
        backgroundColor: isUser ? 'var(--color-accent)' : 'var(--bg-surface)',
        border: isUser ? 'none' : '1px solid var(--border-color)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {isUser
          ? <User size={16} color="white" />
          : <Bot size={16} color="var(--color-accent)" />
        }
      </div>

      {/* Bubble */}
      <div style={{
        maxWidth: '80%',
        padding: '10px 14px',
        borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
        backgroundColor: isUser ? 'var(--color-accent)' : 'var(--bg-surface)',
        color: isUser ? 'white' : 'var(--text-primary)',
        fontSize: '0.88rem', lineHeight: 1.6,
        border: isUser ? 'none' : '1px solid var(--border-color)',
        boxShadow: isUser ? '0 2px 8px rgba(var(--accent-rgb), 0.25)' : 'none',
        whiteSpace: 'pre-wrap',
      }}>
        {/* Render **bold** text */}
        {msg.content.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
          part.startsWith('**') && part.endsWith('**')
            ? <strong key={i}>{part.slice(2, -2)}</strong>
            : <span key={i}>{part}</span>
        )}
        {msg.isLoading && (
          <span style={{ display: 'inline-flex', gap: '3px', marginLeft: '4px' }}>
            {[0, 1, 2].map(i => (
              <span key={i} style={{
                width: '5px', height: '5px', borderRadius: '50%',
                backgroundColor: 'var(--text-muted)',
                animation: `bounce 1s ease-in-out ${i * 0.2}s infinite`,
              }} />
            ))}
          </span>
        )}
      </div>
    </div>
  );
}

export default function ChatbotTab({ userProfile }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: '👋 Xin chào! Tôi là **CaCalo AI** — Trợ lý dinh dưỡng thông minh của bạn.\n\nTôi có thể giúp bạn:\n• Kiểm tra calo đã ăn hôm nay\n• Gợi ý món ăn phù hợp mục tiêu\n• Tư vấn dinh dưỡng cá nhân hóa\n• Trả lời câu hỏi về sức khỏe ăn uống\n\nBạn muốn hỏi gì không?',
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Lấy history để gửi lên API (chỉ user/assistant, bỏ system)
  const getHistory = () => messages
    .filter(m => m.role !== 'system' && !m.isLoading)
    .map(m => ({ role: m.role, content: m.content }));

  const sendMessage = async (text) => {
    const userText = (text || input).trim();
    if (!userText || isLoading) return;

    setInput('');
    const newMessages = [...messages, { role: 'user', content: userText }];
    const loadingMsg = { role: 'assistant', content: '', isLoading: true };
    setMessages([...newMessages, loadingMsg]);
    setIsLoading(true);

    try {
      const history = getHistory();
      const res = await chatWithAI(userText, history);
      const reply = res?.reply || 'Xin lỗi, tôi chưa hiểu câu hỏi này. Bạn có thể hỏi lại không?';

      setMessages([
        ...newMessages,
        { role: 'assistant', content: reply },
        ...(res?.intent === 'today_summary' && res?.data?.total_calories !== undefined
          ? [{ role: 'system', content: `📊 Dữ liệu từ nhật ký DB: ${res.data.total_calories} kcal đã nạp / ${res.data.target_calories} kcal mục tiêu` }]
          : [])
      ]);
    } catch (err) {
      setMessages([
        ...newMessages,
        { role: 'assistant', content: '⚠️ Trợ lý AI tạm thời gặp sự cố. Vui lòng thử lại sau nhé!' }
      ]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleReset = () => {
    setMessages([{
      role: 'assistant',
      content: '🔄 Cuộc trò chuyện mới bắt đầu! Tôi có thể giúp gì cho bạn?',
    }]);
    setInput('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', maxHeight: 'calc(100vh - 160px)' }}>
      {/* Header */}
      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
            Trợ Lý Dinh Dưỡng AI
          </h1>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Tư vấn cá nhân hóa dựa trên hồ sơ và nhật ký ăn của bạn
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{
            display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem',
            color: 'var(--color-success)', fontWeight: 600,
            backgroundColor: 'rgba(74,222,128,0.1)', padding: '4px 10px',
            borderRadius: 'var(--radius-pill)',
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--color-success)', animation: 'pulse 2s infinite' }} />
            RAG Active
          </span>
          <button
            onClick={handleReset}
            title="Bắt đầu cuộc trò chuyện mới"
            style={{
              width: '32px', height: '32px', borderRadius: 'var(--radius-inner)',
              border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-surface)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'var(--text-muted)',
            }}
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      {/* Suggested questions (chỉ hiển thị khi chỉ có 1 tin nhắn chào) */}
      {messages.length === 1 && (
        <div style={{ marginBottom: '12px' }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600 }}>
            Câu hỏi gợi ý:
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {SUGGESTED_QUESTIONS.map((q, i) => (
              <button
                key={i}
                onClick={() => sendMessage(q.text)}
                className="btn"
                style={{
                  height: '32px', minHeight: '32px', fontSize: '0.78rem',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-surface)',
                  color: 'var(--text-secondary)',
                  borderRadius: 'var(--radius-pill)',
                  gap: '5px',
                }}
              >
                <span>{q.icon}</span>
                <span>{q.text}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chat messages */}
      <div className="card" style={{
        flex: 1, overflowY: 'auto', padding: '16px',
        display: 'flex', flexDirection: 'column',
      }}>
        {messages.map((msg, i) => (
          <ChatMessage key={i} msg={msg} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* AI Guardrails notice */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '6px 12px', fontSize: '0.72rem', color: 'var(--text-muted)',
      }}>
        <Sparkles size={11} color="var(--color-accent)" />
        <span>Số liệu Calo/Macro từ DB — AI chỉ tư vấn, không tự tính (AI Guardrails)</span>
      </div>

      {/* Input area */}
      <div style={{
        display: 'flex', gap: '8px', padding: '12px',
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-inner)',
        marginTop: '8px',
      }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Hỏi về dinh dưỡng, calo, gợi ý món ăn... (Enter để gửi)"
          rows={1}
          style={{
            flex: 1, resize: 'none', border: 'none', outline: 'none',
            backgroundColor: 'transparent', fontSize: '0.88rem',
            color: 'var(--text-primary)', lineHeight: 1.5,
            fontFamily: 'inherit',
          }}
        />
        <button
          onClick={() => sendMessage()}
          disabled={!input.trim() || isLoading}
          className="btn btn-primary"
          style={{
            width: '40px', height: '40px', minHeight: '40px', borderRadius: 'var(--radius-inner)',
            padding: 0, flexShrink: 0,
            opacity: (!input.trim() || isLoading) ? 0.5 : 1,
            cursor: (!input.trim() || isLoading) ? 'not-allowed' : 'pointer',
          }}
          title="Gửi tin nhắn (Enter)"
        >
          <Send size={16} />
        </button>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0); opacity: 0.5; }
          40% { transform: scale(1); opacity: 1; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
