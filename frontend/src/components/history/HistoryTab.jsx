/**
 * MỤC ĐÍCH: Tab Lịch Sử Bữa Ăn & Thống Kê Dinh Dưỡng Dành Riêng Cho Từng Tài Khoản.
 * TÍNH NĂNG:
 * 1. Nhật ký bữa ăn thực tế (real) hiển thị theo ngày & giờ chi tiết.
 * 2. Phân loại bữa ăn: Sáng 🌅, Trưa ☀️, Tối 🌙, Ăn vặt/Phụ 🍎.
 * 3. Thống kê dinh dưỡng: Xu hướng 7 ngày so với TDEE, Tỷ lệ Macro, Top món ăn yêu thích.
 * 4. Hỗ trợ xóa bữa ăn và cập nhật dữ liệu tự động theo thời gian thực.
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Clock,
  Flame,
  Trash2,
  TrendingUp,
  PieChart,
  Award,
  RefreshCw,
  Utensils,
  PlusCircle,
  Filter,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { getMealHistory, deleteMealLog, getMealStatistics } from '../../services/api';

const MEAL_TYPE_CONFIG = {
  breakfast: { label: 'Bữa Sáng', icon: '🌅', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.12)' },
  lunch: { label: 'Bữa Trưa', icon: '☀️', color: '#10B981', bg: 'rgba(16, 185, 129, 0.12)' },
  dinner: { label: 'Bữa Tối', icon: '🌙', color: '#6366F1', bg: 'rgba(99, 102, 241, 0.12)' },
  snack: { label: 'Bữa Phụ', icon: '🍎', color: '#EC4899', bg: 'rgba(236, 72, 153, 0.12)' },
};

export default function HistoryTab({ currentUser, userProfile, onSwitchToVision }) {
  const [activeSubTab, setActiveSubTab] = useState('history'); // 'history' | 'statistics'
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeletingId, setIsDeletingId] = useState(null);
  const [notification, setNotification] = useState(null);
  const [selectedFilterMeal, setSelectedFilterMeal] = useState('all');

  // Tải dữ liệu lịch sử và thống kê của riêng người dùng
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [historyRes, statsRes] = await Promise.all([
        getMealHistory({ limit: 150 }),
        getMealStatistics(),
      ]);
      if (historyRes?.logs) setLogs(historyRes.logs);
      if (statsRes) setStats(statsRes);
    } catch (err) {
      console.error('Lỗi tải dữ liệu lịch sử:', err);
      showNotification('error', 'Không thể nạp dữ liệu lịch sử. Vui lòng kiểm tra kết nối Backend.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentUser?.id]);

  const showNotification = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  // Xóa bữa ăn
  const handleDeleteLog = async (logId, mealName) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa bữa ăn này khỏi nhật ký?`)) return;
    try {
      setIsDeletingId(logId);
      await deleteMealLog(logId);
      showNotification('success', 'Đã xóa bữa ăn thành công khỏi nhật ký!');
      // Cập nhật lại danh sách trực tiếp
      setLogs((prev) => prev.filter((l) => l.id !== logId));
      // Tải lại thống kê
      const newStats = await getMealStatistics();
      if (newStats) setStats(newStats);
    } catch (err) {
      showNotification('error', 'Không thể xóa bữa ăn. Vui lòng thử lại!');
    } finally {
      setIsDeletingId(null);
    }
  };

  // Định dạng ngày giờ thân thiện
  const formatDateTime = (createdIso, dateStr) => {
    if (createdIso) {
      try {
        const d = new Date(createdIso);
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        return { time: `${hours}:${minutes}`, date: `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}` };
      } catch (e) {
        // fallback
      }
    }
    return { time: '--:--', date: dateStr || 'Gần đây' };
  };

  // Nhóm lịch sử theo ngày
  const groupedLogs = useMemo(() => {
    const groups = {};
    const filtered = selectedFilterMeal === 'all' 
      ? logs 
      : logs.filter((l) => (l.meal_type || 'lunch').toLowerCase() === selectedFilterMeal);

    for (const log of filtered) {
      const dKey = log.log_date || 'Khác';
      if (!groups[dKey]) groups[dKey] = [];
      groups[dKey].push(log);
    }
    return groups;
  }, [logs, selectedFilterMeal]);

  // Nhãn ngày (Hôm nay, Hôm qua,...)
  const getDayHeading = (dateStr) => {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    if (dateStr === today) return 'Hôm nay';
    if (dateStr === yesterday) return 'Hôm qua';
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
  };

  return (
    <div className="history-tab" style={{ maxWidth: '960px', margin: '0 auto' }}>
      {/* Header tiêu đề */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={22} color="var(--color-accent)" />
            Nhật Ký & Thống Kê Dinh Dưỡng
          </h1>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Theo dõi nhật ký thực tế theo ngày & giờ của tài khoản <strong>{currentUser?.email || 'bạn'}</strong>.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="btn btn-outline"
            style={{ height: '36px', padding: '0 12px', fontSize: '0.82rem' }}
            onClick={fetchData}
            title="Làm mới dữ liệu"
          >
            <RefreshCw size={14} /> Làm mới
          </button>
          <button
            className="btn btn-primary"
            style={{ height: '36px', padding: '0 14px', fontSize: '0.82rem' }}
            onClick={onSwitchToVision}
          >
            <PlusCircle size={15} /> Thêm bữa ăn
          </button>
        </div>
      </div>

      {/* Thông báo Alert */}
      {notification && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: 'var(--radius-inner)',
            marginBottom: '18px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            backgroundColor: notification.type === 'success' ? '#ECFDF5' : '#FEF2F2',
            border: `1px solid ${notification.type === 'success' ? '#10B981' : '#EF4444'}`,
            color: notification.type === 'success' ? '#065F46' : '#991B1B',
            fontSize: '0.88rem',
          }}
        >
          {notification.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Chuyển đổi Sub-Tab: Lịch Sử vs Thống Kê */}
      <div
        style={{
          display: 'flex',
          backgroundColor: 'var(--bg-surface)',
          padding: '4px',
          borderRadius: 'var(--radius-inner)',
          border: '1px solid var(--border-color)',
          marginBottom: '22px',
          width: 'fit-content',
        }}
      >
        <button
          onClick={() => setActiveSubTab('history')}
          style={{
            padding: '8px 18px',
            borderRadius: '6px',
            border: 'none',
            fontSize: '0.88rem',
            fontWeight: 600,
            cursor: 'pointer',
            backgroundColor: activeSubTab === 'history' ? 'var(--color-accent)' : 'transparent',
            color: activeSubTab === 'history' ? '#FFFFFF' : 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.15s ease',
          }}
        >
          <Clock size={16} /> Lịch sử theo ngày & giờ ({logs.length})
        </button>
        <button
          onClick={() => setActiveSubTab('statistics')}
          style={{
            padding: '8px 18px',
            borderRadius: '6px',
            border: 'none',
            fontSize: '0.88rem',
            fontWeight: 600,
            cursor: 'pointer',
            backgroundColor: activeSubTab === 'statistics' ? 'var(--color-accent)' : 'transparent',
            color: activeSubTab === 'statistics' ? '#FFFFFF' : 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.15s ease',
          }}
        >
          <TrendingUp size={16} /> Thống kê dinh dưỡng
        </button>
      </div>

      {/* ============================================================ */}
      {/* 1. VIEW LỊCH SỬ BỮA ĂN THEO NGÀY & GIỜ */}
      {/* ============================================================ */}
      {activeSubTab === 'history' && (
        <div>
          {/* Bộ lọc loại bữa ăn */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Filter size={14} /> Lọc theo bữa:
            </span>
            {[
              { key: 'all', label: 'Tất cả' },
              { key: 'breakfast', label: '🌅 Sáng' },
              { key: 'lunch', label: '☀️ Trưa' },
              { key: 'dinner', label: '🌙 Tối' },
              { key: 'snack', label: '🍎 Phụ' },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setSelectedFilterMeal(f.key)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '20px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  border: selectedFilterMeal === f.key ? '1px solid var(--color-accent)' : '1px solid var(--border-color)',
                  backgroundColor: selectedFilterMeal === f.key ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-surface)',
                  color: selectedFilterMeal === f.key ? 'var(--color-accent)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
              <RefreshCw size={32} className="animate-spin" style={{ opacity: 0.6, marginBottom: '12px' }} />
              <p>Đang tải nhật ký dinh dưỡng của bạn...</p>
            </div>
          ) : logs.length === 0 ? (
            <div
              className="card"
              style={{
                textAlign: 'center',
                padding: '60px 20px',
                backgroundColor: 'var(--bg-surface)',
                border: '1px dashed var(--border-color)',
              }}
            >
              <Utensils size={48} strokeWidth={1.2} style={{ opacity: 0.35, marginBottom: '14px', color: 'var(--color-accent)' }} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Chưa có bữa ăn nào được ghi nhận
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '420px', margin: '8px auto 20px' }}>
                Hãy sử dụng tính năng <strong>Quét món ăn bằng AI</strong> để nhận diện và lưu lại bữa ăn của bạn ngay hôm nay.
              </p>
              <button className="btn btn-primary" onClick={onSwitchToVision}>
                <PlusCircle size={16} /> Quét & Thêm món đầu tiên
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
              {Object.keys(groupedLogs).map((dateKey) => {
                const dayLogs = groupedLogs[dateKey];
                const dayTotalCal = Math.round(dayLogs.reduce((sum, l) => sum + (l.total_calories || 0), 0));

                return (
                  <div key={dateKey}>
                    {/* Header ngày */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'baseline',
                        paddingBottom: '8px',
                        borderBottom: '2px solid var(--border-color)',
                        marginBottom: '12px',
                      }}
                    >
                      <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        📅 {getDayHeading(dateKey)} <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-muted)' }}>({dateKey})</span>
                      </h3>
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-accent)' }}>
                        Tổng nạp: {dayTotalCal} kcal
                      </span>
                    </div>

                    {/* Danh sách bữa ăn trong ngày */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {dayLogs.map((log) => {
                        const mealCfg = MEAL_TYPE_CONFIG[log.meal_type] || MEAL_TYPE_CONFIG.lunch;
                        const { time } = formatDateTime(log.created_at, log.log_date);

                        return (
                          <div
                            key={log.id}
                            className="card"
                            style={{
                              padding: '16px',
                              marginBottom: 0,
                              borderRadius: 'var(--radius-inner)',
                              border: '1px solid var(--border-color)',
                              borderLeft: `5px solid ${mealCfg.color}`,
                              backgroundColor: 'var(--bg-surface)',
                            }}
                          >
                            {/* Dòng 1: Thời gian + Loại bữa + Năng lượng + Nút Xóa */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span
                                  style={{
                                    fontSize: '0.78rem',
                                    fontWeight: 700,
                                    padding: '3px 8px',
                                    borderRadius: '6px',
                                    backgroundColor: mealCfg.bg,
                                    color: mealCfg.color,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                  }}
                                >
                                  <span>{mealCfg.icon}</span> {mealCfg.label}
                                </span>

                                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <Clock size={13} /> {time}
                                </span>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span className="tabular-nums" style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-accent)' }}>
                                  {Math.round(log.total_calories || 0)} <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>kcal</span>
                                </span>

                                <button
                                  onClick={() => handleDeleteLog(log.id, mealCfg.label)}
                                  disabled={isDeletingId === log.id}
                                  title="Xóa bữa ăn này"
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: '#EF4444',
                                    padding: '4px 6px',
                                    borderRadius: '4px',
                                    opacity: isDeletingId === log.id ? 0.4 : 0.8,
                                    transition: 'opacity 0.15s ease',
                                  }}
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </div>

                            {/* Macro mini summary */}
                            <div
                              style={{
                                display: 'flex',
                                gap: '16px',
                                fontSize: '0.78rem',
                                color: 'var(--text-secondary)',
                                padding: '6px 10px',
                                backgroundColor: 'var(--bg-card)',
                                borderRadius: '4px',
                                marginBottom: '10px',
                              }}
                            >
                              <span>Đạm (P): <strong>{Number(log.total_protein || 0).toFixed(1)}g</strong></span>
                              <span>Carb (C): <strong>{Number(log.total_carb || 0).toFixed(1)}g</strong></span>
                              <span>Béo (F): <strong>{Number(log.total_fat || 0).toFixed(1)}g</strong></span>
                            </div>

                            {/* Danh sách món ăn trong bữa */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              {(log.items || []).map((item, idx) => (
                                <div
                                  key={item.id || idx}
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '6px 8px',
                                    fontSize: '0.82rem',
                                    borderRadius: '4px',
                                    backgroundColor: 'rgba(0, 0, 0, 0.02)',
                                  }}
                                >
                                  <div>
                                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.food_name}</span>
                                    <span style={{ color: 'var(--text-muted)', marginLeft: '6px', fontSize: '0.75rem' }}>
                                      ({item.actual_gram}g)
                                    </span>
                                  </div>
                                  <span className="tabular-nums" style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>
                                    {Math.round(item.calories)} kcal
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* 2. VIEW THỐNG KÊ DINH DƯỠNG CÁ NHÂN */}
      {/* ============================================================ */}
      {activeSubTab === 'statistics' && (
        <div>
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
              <RefreshCw size={32} className="animate-spin" style={{ opacity: 0.6, marginBottom: '12px' }} />
              <p>Đang tính toán thống kê dinh dưỡng...</p>
            </div>
          ) : !stats || !stats.has_data ? (
            <div
              className="card"
              style={{
                textAlign: 'center',
                padding: '60px 20px',
                backgroundColor: 'var(--bg-surface)',
                border: '1px dashed var(--border-color)',
              }}
            >
              <TrendingUp size={48} strokeWidth={1.2} style={{ opacity: 0.35, marginBottom: '14px', color: 'var(--color-accent)' }} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Chưa có dữ liệu thống kê
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '420px', margin: '8px auto 20px' }}>
                Hãy ghi nhận ít nhất một bữa ăn để kích hoạt các biểu đồ và phân tích dinh dưỡng cá nhân.
              </p>
              <button className="btn btn-primary" onClick={onSwitchToVision}>
                <PlusCircle size={16} /> Thêm bữa ăn ngay
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* 4 Thẻ chỉ số tổng quan */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
                <div className="card" style={{ padding: '16px', marginBottom: 0, backgroundColor: 'var(--bg-surface)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>
                    <span>Tổng calo nạp</span>
                    <Flame size={18} color="#EF4444" />
                  </div>
                  <p className="tabular-nums" style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '6px' }}>
                    {Math.round(stats.total_calories).toLocaleString()} <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>kcal</span>
                  </p>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Trong {stats.total_days} ngày ghi nhận</span>
                </div>

                <div className="card" style={{ padding: '16px', marginBottom: 0, backgroundColor: 'var(--bg-surface)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>
                    <span>TB calo / ngày</span>
                    <TrendingUp size={18} color="var(--color-accent)" />
                  </div>
                  <p className="tabular-nums" style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--color-accent)', marginTop: '6px' }}>
                    {Math.round(stats.avg_daily_calories)} <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>kcal</span>
                  </p>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Mục tiêu: {Math.round(stats.target_calories)} kcal
                  </span>
                </div>

                <div className="card" style={{ padding: '16px', marginBottom: 0, backgroundColor: 'var(--bg-surface)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>
                    <span>Tổng số bữa</span>
                    <Utensils size={18} color="#3B82F6" />
                  </div>
                  <p className="tabular-nums" style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '6px' }}>
                    {stats.total_meals} <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>bữa</span>
                  </p>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Đã lưu vào PostgreSQL</span>
                </div>

                <div className="card" style={{ padding: '16px', marginBottom: 0, backgroundColor: 'var(--bg-surface)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>
                    <span>Calo hôm nay</span>
                    <Clock size={18} color="#F59E0B" />
                  </div>
                  <p className="tabular-nums" style={{ fontSize: '1.45rem', fontWeight: 800, color: '#F59E0B', marginTop: '6px' }}>
                    {Math.round(stats.today_calories)} <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>kcal</span>
                  </p>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Còn lại: {Math.max(0, Math.round(stats.target_calories - stats.today_calories))} kcal
                  </span>
                </div>
              </div>

              {/* Biểu đồ xu hướng 7 ngày gần nhất */}
              <div className="card" style={{ padding: '20px', marginBottom: 0, backgroundColor: 'var(--bg-surface)' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <TrendingUp size={18} color="var(--color-accent)" />
                  Xu hướng calo 7 ngày gần nhất
                </h3>

                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px', height: '170px', padding: '10px 0', borderBottom: '1px solid var(--border-color)' }}>
                  {stats.recent_days.map((d, idx) => {
                    const maxScale = Math.max(stats.target_calories * 1.3, 2500);
                    const heightPercent = Math.min(100, Math.max(8, (d.calories / maxScale) * 100));
                    const isOver = d.calories > stats.target_calories;

                    return (
                      <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                        <span className="tabular-nums" style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                          {d.calories > 0 ? d.calories : ''}
                        </span>
                        <div
                          style={{
                            width: '100%',
                            maxWidth: '36px',
                            height: `${heightPercent}%`,
                            borderRadius: '4px 4px 0 0',
                            backgroundColor: isOver ? '#EF4444' : d.calories > 0 ? 'var(--color-accent)' : 'rgba(0,0,0,0.06)',
                            transition: 'height 0.3s ease',
                          }}
                          title={`${d.full_date}: ${d.calories} kcal (${d.meals_count} bữa)`}
                        />
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '6px' }}>{d.date}</span>
                      </div>
                    );
                  })}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  <span>🟢 Cột xanh: Nạp dưới mục tiêu</span>
                  <span>🔴 Cột đỏ: Vượt mức mục tiêu ({Math.round(stats.target_calories)} kcal)</span>
                </div>
              </div>

              {/* 2 Cột: Phân bổ Macro & Top món ăn ưa thích */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                {/* Cột 1: Phân bổ Macro */}
                <div className="card" style={{ padding: '18px', marginBottom: 0, backgroundColor: 'var(--bg-surface)' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <PieChart size={17} color="#3B82F6" />
                    Tỷ lệ dinh dưỡng nạp vào (Macro)
                  </h3>

                  <div style={{ width: '100%', height: '10px', borderRadius: '5px', overflow: 'hidden', display: 'flex', marginBottom: '14px' }}>
                    <div style={{ width: `${stats.macro_percentages.protein}%`, backgroundColor: '#3B82F6' }} title={`Đạm: ${stats.macro_percentages.protein}%`} />
                    <div style={{ width: `${stats.macro_percentages.carb}%`, backgroundColor: '#F59E0B' }} title={`Carb: ${stats.macro_percentages.carb}%`} />
                    <div style={{ width: `${stats.macro_percentages.fat}%`, backgroundColor: '#EF4444' }} title={`Béo: ${stats.macro_percentages.fat}%`} />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', textAlign: 'center' }}>
                    <div style={{ padding: '8px', backgroundColor: 'var(--bg-card)', borderRadius: '6px' }}>
                      <span style={{ fontSize: '0.72rem', color: '#3B82F6', fontWeight: 700 }}>Đạm (Protein)</span>
                      <p className="tabular-nums" style={{ fontSize: '1rem', fontWeight: 800, marginTop: '2px' }}>{stats.macro_percentages.protein}%</p>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{stats.macro_totals.protein}g</span>
                    </div>

                    <div style={{ padding: '8px', backgroundColor: 'var(--bg-card)', borderRadius: '6px' }}>
                      <span style={{ fontSize: '0.72rem', color: '#D97706', fontWeight: 700 }}>Carb (Đường)</span>
                      <p className="tabular-nums" style={{ fontSize: '1rem', fontWeight: 800, marginTop: '2px' }}>{stats.macro_percentages.carb}%</p>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{stats.macro_totals.carb}g</span>
                    </div>

                    <div style={{ padding: '8px', backgroundColor: 'var(--bg-card)', borderRadius: '6px' }}>
                      <span style={{ fontSize: '0.72rem', color: '#DC2626', fontWeight: 700 }}>Chất béo (Fat)</span>
                      <p className="tabular-nums" style={{ fontSize: '1rem', fontWeight: 800, marginTop: '2px' }}>{stats.macro_percentages.fat}%</p>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{stats.macro_totals.fat}g</span>
                    </div>
                  </div>
                </div>

                {/* Cột 2: Top 5 món ăn ưa thích */}
                <div className="card" style={{ padding: '18px', marginBottom: 0, backgroundColor: 'var(--bg-surface)' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Award size={17} color="#F59E0B" />
                    Top 5 món ăn nạp nhiều nhất
                  </h3>

                  {stats.top_foods.length === 0 ? (
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Chưa có dữ liệu món ăn</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {stats.top_foods.map((food, idx) => (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '6px 10px',
                            borderRadius: '6px',
                            backgroundColor: 'var(--bg-card)',
                            fontSize: '0.82rem',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span
                              style={{
                                width: '20px',
                                height: '20px',
                                borderRadius: '50%',
                                backgroundColor: idx === 0 ? '#FEF3C7' : 'rgba(0,0,0,0.06)',
                                color: idx === 0 ? '#D97706' : 'var(--text-muted)',
                                fontWeight: 800,
                                fontSize: '0.7rem',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              {idx + 1}
                            </span>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{food.name}</span>
                          </div>

                          <div style={{ textAlign: 'right' }}>
                            <span style={{ fontWeight: 700, color: 'var(--color-accent)' }}>{food.count} lần</span>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '6px' }}>
                              ({Math.round(food.total_cal)} kcal)
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
