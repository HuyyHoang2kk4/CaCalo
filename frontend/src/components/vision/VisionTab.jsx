/**
 * MỤC ĐÍCH: Màn hình Quét món ăn tính Calo — Kiến trúc Hybrid (GPT Vision + PostgreSQL).
 * TÍNH NĂNG ĐẦY ĐỦ:
 * - CC-2.1: Tải ảnh kéo thả, nén ảnh Canvas client (<1MB), mở Camera WebRTC chụp trực tiếp.
 * - CC-2.2: GPT-4o-mini Vision bóc tách đa thành phần, đối chiếu CSDL PostgreSQL tính Calo chuẩn.
 * - CC-2.3 & CC-2.4: Người dùng sửa gram từng món, thêm/xóa món, chọn Toppings.
 * - CC-2.5: Chỉnh sửa nhãn AI (Human-in-the-loop), thu thập phản hồi.
 * - CC-2.7: Tìm kiếm nhanh món ăn có dấu / không dấu từ PostgreSQL.
 */
import React, { useState, useMemo, useRef } from 'react';
import {
  Camera, Upload, Check, Search, Info, CheckCircle2,
  AlertCircle, Edit3, Sparkles, X, Trash2, Plus, RefreshCw
} from 'lucide-react';
import { createMealLog, submitAIFeedback, predictFoodImage } from '../../services/api';
import { compressImage } from '../../services/imageUtils';
import CameraModal from './CameraModal';

export default function VisionTab({ foods = [] }) {
  // 1. Quản lý ảnh & Camera
  const fileInputRef = useRef(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // 2. Kết quả phân tích GPT Vision (Danh sách món bóc tách)
  const [analysisResult, setAnalysisResult] = useState(null);
  // Danh sách món đang hiển thị (người dùng có thể sửa gram, xóa, thêm)
  const [editableItems, setEditableItems] = useState([]);

  // 3. Trạng thái lưu & Tìm kiếm thêm món thủ công
  const [saveStatus, setSaveStatus] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddFood, setShowAddFood] = useState(false);

  // 4. Sửa nhãn AI feedback
  const [isCorrecting, setIsCorrecting] = useState(false);
  const [correctedText, setCorrectedText] = useState('');

  // Tìm kiếm món ăn trong CSDL để thêm thủ công
  const searchResults = useMemo(() => {
    if (!searchQuery.trim() || !foods) return [];
    const q = searchQuery.toLowerCase().trim();
    return foods.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        (f.name_unsigned && f.name_unsigned.toLowerCase().includes(q))
    ).slice(0, 8);
  }, [searchQuery, foods]);

  // ============================================================
  // TÍNH TOÁN DINH DƯỠNG TỔNG CỘNG
  // ============================================================
  const totalNutrition = useMemo(() => {
    let calo = 0, protein = 0, carb = 0, fat = 0;
    for (const item of editableItems) {
      const m = item.matched_food;
      if (m && m.matched) {
        // Tính lại từ DB theo gram hiện tại (người dùng có thể đã sửa)
        const gram = item.uoc_luong_gram;
        calo += (m.calo_per_100g * gram) / 100;
        protein += (m.protein_db / (item._original_gram || gram)) * gram;
        carb += (m.carb_db / (item._original_gram || gram)) * gram;
        fat += (m.fat_db / (item._original_gram || gram)) * gram;
      } else {
        // Dùng số liệu GPT ước lượng (tỷ lệ theo gram)
        const ratio = item.uoc_luong_gram / (item._original_gram || item.uoc_luong_gram);
        calo += item.calo_ai * ratio;
        protein += item.protein_ai * ratio;
        carb += item.carb_ai * ratio;
        fat += item.fat_ai * ratio;
      }
    }
    return {
      calo: Math.round(calo),
      protein: Number(protein.toFixed(1)),
      carb: Number(carb.toFixed(1)),
      fat: Number(fat.toFixed(1)),
    };
  }, [editableItems]);

  // Tỷ lệ Macro (%)
  const macroPercentages = useMemo(() => {
    const total = totalNutrition.protein + totalNutrition.carb + totalNutrition.fat;
    if (total <= 0) return { pro: 25, carb: 55, fat: 20 };
    const p = Math.round((totalNutrition.protein / total) * 100);
    const c = Math.round((totalNutrition.carb / total) * 100);
    const f = Math.max(0, 100 - p - c);
    return { pro: p, carb: c, fat: f };
  }, [totalNutrition]);

  // ============================================================
  // XỬ LÝ ẢNH → GỬI API → HIỂN THỊ KẾT QUẢ
  // ============================================================
  const processAndPredictImage = async (imageFileOrBlob) => {
    try {
      setIsAnalyzing(true);
      setSaveStatus(null);
      setAnalysisResult(null);
      setEditableItems([]);

      const previewUrl = URL.createObjectURL(imageFileOrBlob);
      setImagePreviewUrl(previewUrl);

      // Nén ảnh qua Canvas (< 1MB, max 1280px)
      const compressedBlob = await compressImage(imageFileOrBlob, 1280, 0.82);

      // Gửi lên FastAPI Vision Endpoint
      const res = await predictFoodImage(compressedBlob);

      if (res && res.success && res.items && res.items.length > 0) {
        setAnalysisResult(res);
        // Tạo bản sao editable, lưu gram gốc để tính tỷ lệ khi sửa
        const editable = res.items.map((item, idx) => ({
          ...item,
          _id: Date.now() + idx,
          _original_gram: item.uoc_luong_gram,
          _editing_gram: false,
        }));
        setEditableItems(editable);
      } else {
        setSaveStatus({
          type: 'error',
          message: 'Không thể nhận diện món ăn. Vui lòng thử lại với ảnh rõ nét hơn.',
        });
      }
    } catch (err) {
      console.error('Lỗi nhận diện:', err);
      setSaveStatus({
        type: 'error',
        message: 'Lỗi nhận diện hình ảnh! Vui lòng kiểm tra kết nối Backend.',
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Kéo thả ảnh
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) processAndPredictImage(files[0]);
  };

  const handleFileSelect = (e) => {
    const files = e.target.files;
    if (files && files.length > 0) processAndPredictImage(files[0]);
  };

  const handleCaptureFromCamera = (blob) => {
    processAndPredictImage(blob);
  };

  // ============================================================
  // SỬA / XÓA / THÊM MÓN ĂN
  // ============================================================
  const updateItemGram = (itemId, newGram) => {
    setEditableItems((prev) =>
      prev.map((item) =>
        item._id === itemId
          ? { ...item, uoc_luong_gram: Math.max(10, Number(newGram) || 0) }
          : item
      )
    );
  };

  const toggleEditGram = (itemId) => {
    setEditableItems((prev) =>
      prev.map((item) =>
        item._id === itemId
          ? { ...item, _editing_gram: !item._editing_gram }
          : item
      )
    );
  };

  const removeItem = (itemId) => {
    setEditableItems((prev) => prev.filter((item) => item._id !== itemId));
  };

  const addFoodFromDB = (food) => {
    const nut = food.nutrition_per_100g;
    const defaultServing = food.servings?.find((s) => s.is_default) || food.servings?.[0];
    const gram = defaultServing ? defaultServing.gram : 300;
    const calo = nut ? Math.round((nut.calories * gram) / 100) : 0;

    const newItem = {
      _id: Date.now(),
      _original_gram: gram,
      _editing_gram: false,
      ten: food.name,
      uoc_luong_gram: gram,
      calo_ai: calo,
      protein_ai: nut ? Number(((nut.protein * gram) / 100).toFixed(1)) : 0,
      carb_ai: nut ? Number(((nut.carb * gram) / 100).toFixed(1)) : 0,
      fat_ai: nut ? Number(((nut.fat * gram) / 100).toFixed(1)) : 0,
      ghi_chu: defaultServing ? `${defaultServing.unit} (${gram}g)` : 'Thêm thủ công',
      matched_food: {
        matched: true,
        food_id: food.id,
        food_name: food.name,
        category: food.category,
        calo_db: calo,
        protein_db: nut ? Number(((nut.protein * gram) / 100).toFixed(1)) : 0,
        carb_db: nut ? Number(((nut.carb * gram) / 100).toFixed(1)) : 0,
        fat_db: nut ? Number(((nut.fat * gram) / 100).toFixed(1)) : 0,
        calo_per_100g: nut ? nut.calories : 0,
        source: food.source || 'Viện Dinh dưỡng Quốc gia',
        toppings: food.toppings || [],
      },
    };

    setEditableItems((prev) => [...prev, newItem]);
    setSearchQuery('');
    setShowAddFood(false);
  };

  // ============================================================
  // LƯU VÀO NHẬT KÝ BỮA ĂN (PostgreSQL)
  // ============================================================
  const handleSaveMealLog = async () => {
    if (editableItems.length === 0) return;
    setIsSubmitting(true);
    setSaveStatus(null);

    const items = editableItems.map((item) => {
      const m = item.matched_food;
      const gram = item.uoc_luong_gram;
      let cal, pro, carb, fat;

      if (m && m.matched) {
        cal = Math.round((m.calo_per_100g * gram) / 100);
        const ratio = gram / (item._original_gram || gram);
        pro = Number((m.protein_db * ratio).toFixed(1));
        carb = Number((m.carb_db * ratio).toFixed(1));
        fat = Number((m.fat_db * ratio).toFixed(1));
      } else {
        const ratio = gram / (item._original_gram || gram);
        cal = Math.round(item.calo_ai * ratio);
        pro = Number((item.protein_ai * ratio).toFixed(1));
        carb = Number((item.carb_ai * ratio).toFixed(1));
        fat = Number((item.fat_ai * ratio).toFixed(1));
      }

      return {
        food_id: m?.food_id || null,
        serving_id: null,
        food_name: item.ten,
        portion_size: `${gram}g (${item.ghi_chu || 'AI ước lượng'})`,
        portion_multiplier: 1.0,
        actual_gram: gram,
        calories: cal,
        protein: pro,
        carb: carb,
        fat: fat,
        toppings_applied: [],
        image_proof_url: null,
      };
    });

    const payload = {
      meal_type: 'lunch',
      items: items,
    };

    try {
      const res = await createMealLog(payload);
      setSaveStatus({
        type: 'success',
        message: `Đã lưu thành công ${items.length} món vào PostgreSQL! (Mã bữa ăn: #${res.meal_log_id})`,
      });
    } catch (err) {
      setSaveStatus({
        type: 'error',
        message: 'Lưu thất bại! Vui lòng đảm bảo PostgreSQL đang hoạt động.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Gửi phản hồi sửa lỗi AI
  const handleSendFeedback = async () => {
    if (!correctedText.trim()) return;
    try {
      await submitAIFeedback({
        predicted_label: editableItems.map((i) => i.ten).join(', '),
        confidence_score: 0.7,
        user_corrected_label: correctedText.trim(),
        model_version: analysisResult?.ai_source || 'gpt-4o-mini',
        raw_predictions: editableItems.map((i) => ({ label: i.ten, gram: i.uoc_luong_gram })),
      });
      setSaveStatus({
        type: 'success',
        message: `Đã ghi nhận phản hồi: "${correctedText.trim()}" vào bảng ai_feedback_logs!`,
      });
      setIsCorrecting(false);
      setCorrectedText('');
    } catch (err) {
      alert('Không thể gửi phản hồi lúc này!');
    }
  };

  // Reset toàn bộ
  const handleReset = () => {
    setImagePreviewUrl(null);
    setAnalysisResult(null);
    setEditableItems([]);
    setSaveStatus(null);
    setIsCorrecting(false);
  };

  // ============================================================
  // TÍNH CALO RIÊNG CHO 1 MÓN (để hiển thị trên UI)
  // ============================================================
  const getItemCalories = (item) => {
    const m = item.matched_food;
    const gram = item.uoc_luong_gram;
    if (m && m.matched) {
      return Math.round((m.calo_per_100g * gram) / 100);
    }
    const ratio = gram / (item._original_gram || gram);
    return Math.round(item.calo_ai * ratio);
  };

  // ============================================================
  // RENDER GIAO DIỆN
  // ============================================================
  return (
    <div className="vision-tab">
      {/* Tiêu đề */}
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
          Quét Món Ăn & Tính Calo (AI Vision)
        </h1>
        <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
          Chụp ảnh bữa ăn → AI bóc tách từng thành phần → Đối chiếu CSDL tính Calo chuẩn xác.
        </p>
      </div>

      {/* Alert Box */}
      {saveStatus && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: 'var(--radius-inner)',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            backgroundColor: saveStatus.type === 'success' ? '#ECFDF5' : '#FEF2F2',
            border: `1px solid ${saveStatus.type === 'success' ? '#10B981' : '#EF4444'}`,
            color: saveStatus.type === 'success' ? '#065F46' : '#991B1B',
            fontSize: '0.88rem',
          }}
        >
          {saveStatus.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{saveStatus.message}</span>
        </div>
      )}

      {/* Bố cục 2 cột */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>

        {/* CỘT 1: TẢI ẢNH / CAMERA */}
        <section className="card" style={{ marginBottom: 0 }}>
          <div className="card-header">
            <h2 className="card-title">Hình ảnh món ăn</h2>
            <span className="card-subtitle">
              {analysisResult?.ai_source === 'gpt-4o-mini' ? '🧠 GPT Vision' : analysisResult?.ai_source === 'local_fallback' ? '🔬 Local Analyzer' : 'WebRTC Camera & Tải tệp'}
            </span>
          </div>

          {/* Dropzone / Preview ảnh */}
          <div
            className="dropzone-box"
            role="button"
            tabIndex={0}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              position: 'relative',
              borderColor: isDragging ? 'var(--color-accent)' : undefined,
              backgroundColor: isDragging ? 'var(--color-accent-light)' : undefined,
              minHeight: '200px',
              cursor: 'pointer',
            }}
          >
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFileSelect}
            />

            {imagePreviewUrl ? (
              <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                <img
                  src={imagePreviewUrl}
                  alt="Món ăn vừa chụp/tải lên"
                  style={{
                    width: '100%',
                    maxHeight: '220px',
                    objectFit: 'cover',
                    borderRadius: 'var(--radius-inner)',
                  }}
                />
                <button
                  type="button"
                  title="Hủy ảnh"
                  onClick={(e) => { e.stopPropagation(); handleReset(); }}
                  style={{
                    position: 'absolute', top: '8px', right: '8px',
                    backgroundColor: 'rgba(0,0,0,0.6)', color: '#FFF',
                    border: 'none', borderRadius: '50%',
                    width: '28px', height: '28px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <>
                <div
                  style={{
                    width: '48px', height: '48px', borderRadius: '50%',
                    backgroundColor: 'var(--color-accent-light)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--color-accent)',
                  }}
                >
                  <Upload size={24} strokeWidth={1.75} />
                </div>
                <div>
                  <p style={{ fontWeight: 600, fontSize: '0.92rem' }}>Kéo thả ảnh món ăn vào đây</p>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>hoặc bấm để chọn ảnh từ máy</p>
                </div>
              </>
            )}

            {/* Loading overlay */}
            {isAnalyzing && (
              <div
                style={{
                  position: 'absolute', inset: 0,
                  backgroundColor: 'rgba(255, 255, 255, 0.88)',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  borderRadius: 'var(--radius-inner)', gap: '8px',
                }}
              >
                <Sparkles size={28} className="animate-spin" color="var(--color-accent)" />
                <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-accent)' }}>
                  AI đang phân tích món ăn...
                </span>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  GPT Vision đang bóc tách từng thành phần
                </span>
              </div>
            )}
          </div>

          {/* Nút Camera */}
          <button
            className="btn btn-outline"
            style={{ width: '100%', marginTop: '12px', height: '40px' }}
            onClick={(e) => { e.stopPropagation(); setIsCameraOpen(true); }}
          >
            <Camera size={16} /> Mở Camera WebRTC trực tiếp
          </button>

          {/* Nhận xét của AI */}
          {analysisResult?.nhan_xet && (
            <div
              style={{
                marginTop: '12px', padding: '10px 14px',
                backgroundColor: '#F0F9FF', border: '1px solid #BAE6FD',
                borderRadius: 'var(--radius-inner)', fontSize: '0.84rem', color: '#0C4A6E',
              }}
            >
              <strong>💬 AI nhận xét:</strong> {analysisResult.nhan_xet}
            </div>
          )}

          {/* Nút sửa nhãn AI */}
          {analysisResult && (
            <div style={{ marginTop: '12px' }}>
              <button
                className="btn btn-outline"
                style={{ fontSize: '0.78rem', height: '32px', minHeight: '32px', padding: '0 10px' }}
                onClick={() => setIsCorrecting(!isCorrecting)}
              >
                <Edit3 size={14} /> AI nhận diện chưa đúng? Gửi phản hồi
              </button>

              {isCorrecting && (
                <div
                  style={{
                    padding: '12px', backgroundColor: 'var(--bg-surface)',
                    borderRadius: 'var(--radius-inner)', marginTop: '8px',
                    border: '1px solid var(--border-strong)',
                  }}
                >
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                    Nhập mô tả chính xác về bữa ăn này:
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      value={correctedText}
                      onChange={(e) => setCorrectedText(e.target.value)}
                      placeholder="VD: Đây là cơm tấm sườn bì chả, không phải bún bò..."
                      style={{
                        flex: 1, height: '36px', padding: '0 10px',
                        borderRadius: 'var(--radius-inner)',
                        border: '1px solid var(--border-color)', fontSize: '0.85rem',
                      }}
                    />
                    <button
                      className="btn btn-primary"
                      style={{ height: '36px', minHeight: '36px', fontSize: '0.8rem' }}
                      onClick={handleSendFeedback}
                    >
                      Gửi
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* CỘT 2: KẾT QUẢ PHÂN TÍCH & DINH DƯỠNG */}
        <section className="card" style={{ marginBottom: 0 }}>
          <div className="card-header">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {analysisResult && (
                  <span
                    className="brand-badge"
                    style={{
                      backgroundColor: analysisResult.ai_source === 'gpt-4o-mini' ? '#DBEAFE' : '#FEF3C7',
                      color: analysisResult.ai_source === 'gpt-4o-mini' ? '#1D4ED8' : '#D97706',
                    }}
                  >
                    <Sparkles size={12} style={{ display: 'inline', marginRight: '4px' }} />
                    {analysisResult.ai_source === 'gpt-4o-mini' ? 'GPT Vision' : 'Local Analyzer'}
                  </span>
                )}
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {editableItems.length > 0 ? `${editableItems.length} thành phần` : 'Chờ ảnh...'}
                </span>
              </div>
              <h2 className="card-title" style={{ fontSize: '1.15rem', marginTop: '6px' }}>
                Kết quả phân tích dinh dưỡng
              </h2>
            </div>
            {editableItems.length > 0 && (
              <button
                className="btn btn-outline"
                style={{ fontSize: '0.75rem', height: '30px', minHeight: '30px', padding: '0 8px' }}
                onClick={handleReset}
              >
                <RefreshCw size={13} /> Quét lại
              </button>
            )}
          </div>

          {/* Khi chưa có kết quả */}
          {editableItems.length === 0 && !isAnalyzing && (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
              <Camera size={40} strokeWidth={1.2} style={{ marginBottom: '12px', opacity: 0.4 }} />
              <p style={{ fontSize: '0.9rem', fontWeight: 500 }}>Chưa có ảnh nào được phân tích</p>
              <p style={{ fontSize: '0.8rem' }}>Tải ảnh hoặc chụp Camera ở cột bên trái để bắt đầu</p>
            </div>
          )}

          {/* DANH SÁCH MÓN ĂN BÓC TÁCH */}
          {editableItems.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
              {editableItems.map((item, idx) => {
                const m = item.matched_food;
                const isMatched = m && m.matched;
                const itemCal = getItemCalories(item);

                return (
                  <div
                    key={item._id}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 'var(--radius-inner)',
                      border: `1px solid ${isMatched ? '#D1FAE5' : '#FEF3C7'}`,
                      backgroundColor: isMatched ? '#F0FDF4' : '#FFFBEB',
                    }}
                  >
                    {/* Dòng 1: Tên món + Badge + Nút xóa */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {item.ten}
                          </span>
                          <span
                            style={{
                              fontSize: '0.65rem', fontWeight: 600,
                              padding: '2px 6px', borderRadius: '4px',
                              backgroundColor: isMatched ? '#D1FAE5' : '#FEF3C7',
                              color: isMatched ? '#065F46' : '#92400E',
                            }}
                          >
                            {isMatched ? 'DB ✅' : 'AI ước lượng ⚠️'}
                          </span>
                        </div>
                        {item.ghi_chu && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.ghi_chu}</span>
                        )}
                      </div>
                      <button
                        onClick={() => removeItem(item._id)}
                        title="Xóa món này"
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: '#EF4444', padding: '4px', borderRadius: '4px',
                        }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>

                    {/* Dòng 2: Gram + Calo */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Khối lượng:</span>
                        {item._editing_gram ? (
                          <input
                            type="number"
                            min="10"
                            max="3000"
                            value={item.uoc_luong_gram}
                            onChange={(e) => updateItemGram(item._id, e.target.value)}
                            onBlur={() => toggleEditGram(item._id)}
                            autoFocus
                            style={{
                              width: '70px', height: '26px', padding: '0 6px',
                              borderRadius: '4px', border: '1px solid var(--color-accent)',
                              fontSize: '0.82rem', fontWeight: 600,
                            }}
                          />
                        ) : (
                          <span
                            onClick={() => toggleEditGram(item._id)}
                            style={{
                              fontSize: '0.85rem', fontWeight: 700,
                              color: 'var(--color-accent)',
                              cursor: 'pointer',
                              borderBottom: '1px dashed var(--color-accent)',
                              paddingBottom: '1px',
                            }}
                            title="Bấm để sửa gram"
                          >
                            {item.uoc_luong_gram}g ✏️
                          </span>
                        )}
                      </div>
                      <span className="tabular-nums" style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-accent)' }}>
                        {itemCal} kcal
                      </span>
                    </div>

                    {/* Dòng 3: Chi tiết Macro nhỏ */}
                    <div style={{ display: 'flex', gap: '12px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {isMatched ? (
                        <>
                          <span>Đạm: <strong>{Number((m.protein_db * item.uoc_luong_gram / (item._original_gram || item.uoc_luong_gram)).toFixed(1))}g</strong></span>
                          <span>Carb: <strong>{Number((m.carb_db * item.uoc_luong_gram / (item._original_gram || item.uoc_luong_gram)).toFixed(1))}g</strong></span>
                          <span>Béo: <strong>{Number((m.fat_db * item.uoc_luong_gram / (item._original_gram || item.uoc_luong_gram)).toFixed(1))}g</strong></span>
                        </>
                      ) : (
                        <>
                          <span>Đạm: <strong>{item.protein_ai}g</strong></span>
                          <span>Carb: <strong>{item.carb_ai}g</strong></span>
                          <span>Béo: <strong>{item.fat_ai}g</strong></span>
                        </>
                      )}
                    </div>

                    {/* Nguồn dữ liệu */}
                    {isMatched && (
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <Info size={10} /> Nguồn: {m.source || 'Viện Dinh dưỡng Quốc gia'}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* NÚT THÊM MÓN THỦ CÔNG */}
          {editableItems.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <button
                className="btn btn-outline"
                style={{ width: '100%', height: '36px', fontSize: '0.82rem' }}
                onClick={() => setShowAddFood(!showAddFood)}
              >
                <Plus size={15} /> {showAddFood ? 'Đóng tìm kiếm' : 'Thêm món từ CSDL'}
              </button>

              {showAddFood && (
                <div style={{ marginTop: '8px' }}>
                  <div style={{ position: 'relative' }}>
                    <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '10px' }} />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Gõ: pho bo, com tam, bun cha..."
                      style={{
                        width: '100%', height: '38px', paddingLeft: '34px', paddingRight: '10px',
                        borderRadius: 'var(--radius-inner)',
                        border: '1px solid var(--border-strong)', fontSize: '0.85rem',
                      }}
                    />
                  </div>
                  {searchResults.length > 0 && (
                    <div
                      style={{
                        marginTop: '4px', maxHeight: '180px', overflowY: 'auto',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-inner)', backgroundColor: 'var(--bg-card)',
                        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                      }}
                    >
                      {searchResults.map((f) => (
                        <div
                          key={f.id}
                          onClick={() => addFoodFromDB(f)}
                          style={{
                            padding: '8px 12px', fontSize: '0.83rem', cursor: 'pointer',
                            borderBottom: '1px solid var(--border-color)',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          }}
                        >
                          <div>
                            <span style={{ fontWeight: 600 }}>{f.name}</span>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginLeft: '6px' }}>({f.category})</span>
                          </div>
                          <span style={{ color: 'var(--color-accent)', fontWeight: 600, fontSize: '0.78rem' }}>
                            + Thêm
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* THẺ TỔNG KẾT DINH DƯỠNG */}
          {editableItems.length > 0 && (
            <>
              <div
                style={{
                  backgroundColor: 'var(--bg-surface)', padding: '16px',
                  borderRadius: 'var(--radius-inner)', border: '1px solid var(--border-color)',
                  marginBottom: '16px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                    Tổng năng lượng bữa ăn:
                  </span>
                  <span className="tabular-nums" style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--color-accent)' }}>
                    {totalNutrition.calo} <span style={{ fontSize: '1rem', fontWeight: 500 }}>kcal</span>
                  </span>
                </div>

                {/* Macro Bar */}
                <div style={{ marginTop: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '4px', color: 'var(--text-secondary)' }}>
                    <span>Phân bổ Macro:</span>
                    <span>
                      Đạm {macroPercentages.pro}% • Bột đường {macroPercentages.carb}% • Béo {macroPercentages.fat}%
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '8px', borderRadius: '4px', overflow: 'hidden', display: 'flex' }}>
                    <div style={{ width: `${macroPercentages.pro}%`, backgroundColor: '#3B82F6' }} title={`Đạm: ${totalNutrition.protein}g`} />
                    <div style={{ width: `${macroPercentages.carb}%`, backgroundColor: '#F59E0B' }} title={`Carb: ${totalNutrition.carb}g`} />
                    <div style={{ width: `${macroPercentages.fat}%`, backgroundColor: '#EF4444' }} title={`Béo: ${totalNutrition.fat}g`} />
                  </div>
                </div>

                {/* Chi tiết macro */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '12px', textAlign: 'center', fontSize: '0.8rem' }}>
                  <div style={{ padding: '6px', backgroundColor: 'var(--bg-card)', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                    <span style={{ color: '#3B82F6', fontWeight: 600 }}>Đạm (Protein)</span>
                    <p className="tabular-nums" style={{ fontWeight: 700, marginTop: '2px' }}>{totalNutrition.protein}g</p>
                  </div>
                  <div style={{ padding: '6px', backgroundColor: 'var(--bg-card)', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                    <span style={{ color: '#D97706', fontWeight: 600 }}>Bột đường (Carb)</span>
                    <p className="tabular-nums" style={{ fontWeight: 700, marginTop: '2px' }}>{totalNutrition.carb}g</p>
                  </div>
                  <div style={{ padding: '6px', backgroundColor: 'var(--bg-card)', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                    <span style={{ color: '#DC2626', fontWeight: 600 }}>Chất béo (Fat)</span>
                    <p className="tabular-nums" style={{ fontWeight: 700, marginTop: '2px' }}>{totalNutrition.fat}g</p>
                  </div>
                </div>
              </div>

              {/* NÚT LƯU */}
              <button
                className="btn btn-primary"
                style={{ width: '100%', height: '44px' }}
                disabled={isSubmitting || editableItems.length === 0}
                onClick={handleSaveMealLog}
              >
                {isSubmitting
                  ? 'Đang lưu vào PostgreSQL...'
                  : `✅ Xác nhận & Lưu ${editableItems.length} món vào nhật ký`}
              </button>
            </>
          )}
        </section>
      </div>

      {/* Camera Modal */}
      <CameraModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={handleCaptureFromCamera}
      />
    </div>
  );
}
