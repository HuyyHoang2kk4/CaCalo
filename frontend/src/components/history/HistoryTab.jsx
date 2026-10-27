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
  CheckCircle2,
  Edit3,
  X,
  Plus,
  Save,
  Check
} from 'lucide-react';
import { getMealHistory, deleteMealLog, updateMealLog, getMealStatistics } from '../../services/api';

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

  // Chỉnh sửa bữa ăn (Edit Modal)
  const [editingLog, setEditingLog] = useState(null);
  const [editForm, setEditForm] = useState({
    meal_type: 'lunch',
    log_date: '',
    items: [],
  });
  const [isUpdating, setIsUpdating] = useState(false);

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

  // Mở modal chỉnh sửa bữa ăn
  const handleOpenEditModal = (log) => {
    setEditingLog(log);
    setEditForm({
      meal_type: log.meal_type || 'lunch',
      log_date: log.log_date || new Date().toISOString().split('T')[0],
      items: (log.items || []).map((it, idx) => {
        const gram = Math.max(1, Number(it.actual_gram) || 100);
        const cal = Number(it.calories) || 0;
        const pro = Number(it.protein) || 0;
        const carb = Number(it.carb) || 0;
        const fat = Number(it.fat) || 0;
        return {
          _key: it.id || `item_${idx}_${Date.now()}`,
          id: it.id,
          food_id: it.food_id || null,
          food_name: it.food_name || '',
          actual_gram: gram,
          calories: cal,
          protein: pro,
          carb: carb,
          fat: fat,
          _cal_per_g: cal / gram,
          _pro_per_g: pro / gram,
          _carb_per_g: carb / gram,
          _fat_per_g: fat / gram,
        };
      }),
    });
  };

  const handleUpdateItemField = (key, field, value) => {
    setEditForm((prev) => ({
      ...prev,
      items: prev.items.map((it) => {
        if (it._key !== key) return it;

        if (field === 'actual_gram') {
          const newG = Number(value);
          const validG = Math.max(0, newG || 0);
          const calPerG = (it._cal_per_g !== undefined && !isNaN(it._cal_per_g))
            ? it._cal_per_g
            : (it.actual_gram > 0 ? it.calories / it.actual_gram : 0);
          const proPerG = (it._pro_per_g !== undefined && !isNaN(it._pro_per_g))
            ? it._pro_per_g
            : (it.actual_gram > 0 ? it.protein / it.actual_gram : 0);
          const carbPerG = (it._carb_per_g !== undefined && !isNaN(it._carb_per_g))
            ? it._carb_per_g
            : (it.actual_gram > 0 ? it.carb / it.actual_gram : 0);
          const fatPerG = (it._fat_per_g !== undefined && !isNaN(it._fat_per_g))
            ? it._fat_per_g
            : (it.actual_gram > 0 ? it.fat / it.actual_gram : 0);

          return {
            ...it,
            actual_gram: value,
            calories: Math.round(calPerG * validG),
            protein: Number((proPerG * validG).toFixed(1)),
            carb: Number((carbPerG * validG).toFixed(1)),
            fat: Number((fatPerG * validG).toFixed(1)),
            _cal_per_g: calPerG,
            _pro_per_g: proPerG,
            _carb_per_g: carbPerG,
            _fat_per_g: fatPerG,
          };
        }

        const updated = { ...it, [field]: value };
        const curG = Math.max(1, Number(updated.actual_gram) || 100);
        if (field === 'calories') updated._cal_per_g = Number(value || 0) / curG;
        if (field === 'protein') updated._pro_per_g = Number(value || 0) / curG;
        if (field === 'carb') updated._carb_per_g = Number(value || 0) / curG;
        if (field === 'fat') updated._fat_per_g = Number(value || 0) / curG;
        return updated;
      }),
    }));
  };

  const handleRemoveItemFromMeal = (key) => {
    if (editForm.items.length <= 1) {
      alert('Bữa ăn cần có ít nhất 1 món. Nếu muốn xóa hẳn bữa ăn này, vui lòng dùng nút Xóa ngoài danh sách.');
      return;
    }
    setEditForm((prev) => ({
      ...prev,
      items: prev.items.filter((it) => it._key !== key),
    }));
  };

  const handleSaveEditMeal = async () => {
    if (!editingLog) return;
    if (editForm.items.length === 0) {
      showNotification('error', 'Bữa ăn phải có ít nhất 1 món!');
      return;
    }
    for (const it of editForm.items) {
      if (!it.food_name.trim()) {
        showNotification('error', 'Vui lòng nhập tên cho tất cả các món ăn!');
        return;
      }
    }

    setIsUpdating(true);
    try {
      const payload = {
        meal_type: editForm.meal_type,
        log_date: editForm.log_date,
        items: editForm.items.map((it) => ({
          food_id: it.food_id || null,
          food_name: it.food_name.trim(),
          portion_size: `${Math.max(5, Number(it.actual_gram) || 100)}g`,
          portion_multiplier: 1.0,
          actual_gram: Math.max(5, Number(it.actual_gram) || 100),
          calories: Math.max(0, Number(it.calories) || 0),
          protein: Math.max(0, Number(it.protein) || 0),
          carb: Math.max(0, Number(it.carb) || 0),
          fat: Math.max(0, Number(it.fat) || 0),
          toppings_applied: [],
        })),
      };

      const res = await updateMealLog(editingLog.id, payload);

      if (res?.meal_log) {
        setLogs((prev) => prev.map((l) => (l.id === editingLog.id ? res.meal_log : l)));
      } else {
        await fetchData();
      }

      const newStats = await getMealStatistics();
      if (newStats) setStats(newStats);

      showNotification('success', 'Đã cập nhật bữa ăn thành công!');
      setEditingLog(null);
    } catch (err) {
      console.error('Lỗi cập nhật bữa ăn:', err);
      const detail = err.response?.data?.detail || err.message;
      showNotification('error', detail ? `Cập nhật thất bại: ${detail}` : 'Không thể cập nhật bữa ăn!');
    } finally {
      setIsUpdating(false);
    }
  };

  // Tính tổng calo và macro tức thì trong Edit Modal
  const editModalTotals = useMemo(() => {
    if (!editingLog) return { calo: 0, protein: 0, carb: 0, fat: 0 };
    const c = editForm.items.reduce((s, i) => s + (Number(i.calories) || 0), 0);
    const p = editForm.items.reduce((s, i) => s + (Number(i.protein) || 0), 0);
    const cb = editForm.items.reduce((s, i) => s + (Number(i.carb) || 0), 0);
    const f = editForm.items.reduce((s, i) => s + (Number(i.fat) || 0), 0);
    return {
      calo: Math.round(c),
      protein: Number(p.toFixed(1)),
      carb: Number(cb.toFixed(1)),
      fat: Number(f.toFixed(1)),
    };
  }, [editForm.items, editingLog]);

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

                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span className="tabular-nums" style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-accent)' }}>
                                  {Math.round(log.total_calories || 0)} <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>kcal</span>
                                </span>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <button
                                    onClick={() => handleOpenEditModal(log)}
                                    title="Chỉnh sửa bữa ăn này"
                                    style={{
                                      background: 'rgba(16, 185, 129, 0.1)',
                                      border: 'none',
                                      cursor: 'pointer',
                                      color: 'var(--color-accent)',
                                      padding: '5px 8px',
                                      borderRadius: '5px',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      fontSize: '0.75rem',
                                      fontWeight: 600,
                                      transition: 'all 0.15s ease',
                                    }}
                                  >
                                    <Edit3 size={13} /> Sửa
                                  </button>

                                  <button
                                    onClick={() => handleDeleteLog(log.id, mealCfg.label)}
                                    disabled={isDeletingId === log.id}
                                    title="Xóa bữa ăn này"
                                    style={{
                                      background: 'rgba(239, 68, 68, 0.08)',
                                      border: 'none',
                                      cursor: 'pointer',
                                      color: '#EF4444',
                                      padding: '5px 7px',
                                      borderRadius: '5px',
                                      opacity: isDeletingId === log.id ? 0.4 : 0.85,
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      transition: 'opacity 0.15s ease',
                                    }}
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </div>
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

      {/* ============================================================ */}
      {/* MODAL CHỈNH SỬA BỮA ĂN (EDIT MEAL MODAL) */}
      {/* ============================================================ */}
      {editingLog && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={() => setEditingLog(null)}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '620px',
              maxHeight: '92vh',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-card)',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
              padding: '24px',
              border: '1px solid var(--border-color)',
              marginBottom: 0,
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                  <Edit3 size={18} color="var(--color-accent)" />
                  Chỉnh sửa Bữa Ăn #{editingLog.id}
                </h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Cập nhật loại bữa, ngày và danh sách các món ăn đã nạp
                </span>
              </div>
              <button
                onClick={() => setEditingLog(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* 1. Chọn loại bữa ăn & Ngày */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Loại bữa ăn:
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                    {[
                      { key: 'breakfast', label: 'Sáng', icon: '🌅' },
                      { key: 'lunch', label: 'Trưa', icon: '☀️' },
                      { key: 'dinner', label: 'Tối', icon: '🌙' },
                      { key: 'snack', label: 'Phụ', icon: '🍎' },
                    ].map((m) => (
                      <button
                        key={m.key}
                        type="button"
                        onClick={() => setEditForm((p) => ({ ...p, meal_type: m.key }))}
                        style={{
                          padding: '6px 2px',
                          borderRadius: '6px',
                          fontSize: '0.76rem',
                          fontWeight: 600,
                          border: editForm.meal_type === m.key ? '2px solid var(--color-accent)' : '1px solid var(--border-color)',
                          backgroundColor: editForm.meal_type === m.key ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-surface)',
                          color: editForm.meal_type === m.key ? 'var(--color-accent)' : 'var(--text-secondary)',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '2px',
                        }}
                      >
                        <span>{m.icon}</span>
                        <span>{m.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Ngày ghi nhận:
                  </label>
                  <input
                    type="date"
                    value={editForm.log_date}
                    onChange={(e) => setEditForm((p) => ({ ...p, log_date: e.target.value }))}
                    style={{
                      width: '100%',
                      height: '38px',
                      padding: '0 10px',
                      borderRadius: 'var(--radius-inner)',
                      border: '1px solid var(--border-strong)',
                      fontSize: '0.88rem',
                      fontWeight: 600,
                      backgroundColor: 'var(--bg-surface)',
                      color: 'var(--text-primary)',
                    }}
                  />
                </div>
              </div>

              {/* 2. Danh sách các món ăn trong bữa */}
              <div>
                <div style={{ marginBottom: '8px' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Danh sách món ăn ({editForm.items.length} món):
                  </label>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {editForm.items.map((it) => (
                    <div
                      key={it._key}
                      style={{
                        padding: '12px',
                        borderRadius: 'var(--radius-inner)',
                        backgroundColor: 'var(--bg-surface)',
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                      }}
                    >
                      {/* Dòng 1: Tên món + Gram + Calo + Xóa */}
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ flex: '1 1 180px' }}>
                          <input
                            type="text"
                            value={it.food_name}
                            onChange={(e) => handleUpdateItemField(it._key, 'food_name', e.target.value)}
                            placeholder="Tên món ăn..."
                            style={{
                              width: '100%',
                              height: '34px',
                              padding: '0 8px',
                              borderRadius: '4px',
                              border: '1px solid var(--border-strong)',
                              fontSize: '0.85rem',
                              fontWeight: 600,
                              backgroundColor: 'var(--bg-card)',
                              color: 'var(--text-primary)',
                            }}
                          />
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <input
                            type="number"
                            min="5"
                            max="3000"
                            value={it.actual_gram}
                            onChange={(e) => handleUpdateItemField(it._key, 'actual_gram', e.target.value)}
                            style={{
                              width: '75px',
                              height: '34px',
                              padding: '0 6px',
                              borderRadius: '4px',
                              border: '1px solid var(--border-strong)',
                              fontSize: '0.85rem',
                              fontWeight: 600,
                              textAlign: 'center',
                              backgroundColor: 'var(--bg-card)',
                              color: 'var(--text-primary)',
                            }}
                          />
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>g</span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <input
                            type="number"
                            min="0"
                            max="5000"
                            value={it.calories}
                            onChange={(e) => handleUpdateItemField(it._key, 'calories', e.target.value)}
                            style={{
                              width: '85px',
                              height: '34px',
                              padding: '0 6px',
                              borderRadius: '4px',
                              border: '1px solid var(--color-accent)',
                              fontSize: '0.9rem',
                              fontWeight: 700,
                              textAlign: 'center',
                              backgroundColor: 'var(--bg-card)',
                              color: 'var(--color-accent)',
                            }}
                          />
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-accent)' }}>kcal</span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveItemFromMeal(it._key)}
                          title="Xóa món này khỏi bữa"
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#EF4444',
                            padding: '6px',
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      {/* Dòng 2: Đạm, Carb, Béo */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px', borderRadius: '4px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                          <span style={{ fontSize: '0.72rem', color: '#10B981', fontWeight: 600 }}>Đạm:</span>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={it.protein}
                            onChange={(e) => handleUpdateItemField(it._key, 'protein', e.target.value)}
                            style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '0.8rem', fontWeight: 600, outline: 'none', color: 'var(--text-primary)' }}
                          />
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>g</span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px', borderRadius: '4px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                          <span style={{ fontSize: '0.72rem', color: '#3B82F6', fontWeight: 600 }}>Carb:</span>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={it.carb}
                            onChange={(e) => handleUpdateItemField(it._key, 'carb', e.target.value)}
                            style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '0.8rem', fontWeight: 600, outline: 'none', color: 'var(--text-primary)' }}
                          />
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>g</span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px', borderRadius: '4px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                          <span style={{ fontSize: '0.72rem', color: '#F59E0B', fontWeight: 600 }}>Béo:</span>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={it.fat}
                            onChange={(e) => handleUpdateItemField(it._key, 'fat', e.target.value)}
                            style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '0.8rem', fontWeight: 600, outline: 'none', color: 'var(--text-primary)' }}
                          />
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>g</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 3. Tổng cộng Dinh dưỡng tức thì */}
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-inner)',
                  backgroundColor: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '10px',
                }}
              >
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>Tổng năng lượng bữa ăn:</span>
                  <span className="tabular-nums" style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-accent)' }}>
                    {editModalTotals.calo} <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>kcal</span>
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '14px', fontSize: '0.82rem' }}>
                  <span>Đạm: <strong style={{ color: '#10B981' }}>{editModalTotals.protein}g</strong></span>
                  <span>Carb: <strong style={{ color: '#3B82F6' }}>{editModalTotals.carb}g</strong></span>
                  <span>Béo: <strong style={{ color: '#F59E0B' }}>{editModalTotals.fat}g</strong></span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
              <button
                type="button"
                className="btn btn-outline"
                style={{ height: '38px', fontSize: '0.85rem' }}
                onClick={() => setEditingLog(null)}
                disabled={isUpdating}
              >
                Hủy
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ height: '38px', fontSize: '0.85rem' }}
                onClick={handleSaveEditMeal}
                disabled={isUpdating}
              >
                {isUpdating ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" /> Đang lưu...
                  </>
                ) : (
                  <>
                    <Save size={15} /> Lưu thay đổi
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
