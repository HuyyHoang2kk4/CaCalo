/**
 * MỤC ĐÍCH: Màn hình Quét món ăn tính Calo — Kiến trúc Hybrid (Google Gemini Flash + PostgreSQL).
 * TÍNH NĂNG ĐẦY ĐỦ:
 * - CC-2.1: Tải ảnh kéo thả, nén ảnh Canvas client (<1MB), mở Camera WebRTC chụp trực tiếp.
 * - CC-2.2: Google Gemini Flash Vision bóc tách đa thành phần, đối chiếu CSDL PostgreSQL tính Calo chuẩn.
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

export default function VisionTab({ foods = [], currentUser, onOpenAuthModal }) {
  // 1. Quản lý ảnh & Camera
  const fileInputRef = useRef(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // 2. Kết quả phân tích Gemini Vision (Danh sách món bóc tách)
  const [analysisResult, setAnalysisResult] = useState(null);
  // Danh sách món đang hiển thị (người dùng có thể sửa gram, xóa, thêm)
  const [editableItems, setEditableItems] = useState([]);

  // 3. Trạng thái lưu & Loại bữa ăn (Sáng, Trưa, Tối, Phụ)
  const [saveStatus, setSaveStatus] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedMealType, setSelectedMealType] = useState(() => {
    const h = new Date().getHours();
    if (h >= 5 && h < 10) return 'breakfast';
    if (h >= 10 && h < 14) return 'lunch';
    if (h >= 14 && h < 17) return 'snack';
    return 'dinner';
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddFood, setShowAddFood] = useState(false);

  // 4. Sửa nhãn AI feedback
  const [isCorrecting, setIsCorrecting] = useState(false);
  const [correctedText, setCorrectedText] = useState('');

  // 5. Chỉnh sửa chi tiết món ăn (Tên, Gram, Calo, Macros)
  const [itemToEdit, setItemToEdit] = useState(null);
  const [itemEditForm, setItemEditForm] = useState({
    ten: '',
    gram: 100,
    calo: 0,
    protein: 0,
    carb: 0,
    fat: 0,
  });

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
  // TÍNH TOÁN CALO & MACRO CHO TỪNG MÓN
  // ============================================================
  const getItemCalories = (item) => {
    const gram = Math.max(0, Number(item.uoc_luong_gram) || 0);

    // Nếu đã lưu tỷ lệ calo/g
    if (item._cal_per_g !== undefined && !isNaN(item._cal_per_g)) {
      return Math.round(item._cal_per_g * gram);
    }

    const origGram = Math.max(1, Number(item._original_gram) || Number(item.uoc_luong_gram) || 100);
    const m = item.matched_food;

    if (m && m.matched) {
      const cal100 = (m.calo_per_100g !== undefined && m.calo_per_100g !== null)
        ? Number(m.calo_per_100g)
        : (Number(m.calo_db || 0) * 100 / origGram);
      return Math.round((cal100 * gram) / 100) || 0;
    }
    const ratio = origGram > 0 ? gram / origGram : 1;
    return Math.round((Number(item.calo_ai) || 0) * ratio) || 0;
  };

  const getItemMacros = (item) => {
    const gram = Math.max(0, Number(item.uoc_luong_gram) || 0);

    // Nếu đã lưu tỷ lệ macro/g
    if (item._pro_per_g !== undefined && !isNaN(item._pro_per_g)) {
      return {
        protein: Number((item._pro_per_g * gram).toFixed(1)),
        carb: Number((item._carb_per_g * gram).toFixed(1)),
        fat: Number((item._fat_per_g * gram).toFixed(1)),
      };
    }

    const origGram = Math.max(1, Number(item._original_gram) || Number(item.uoc_luong_gram) || 100);
    const m = item.matched_food;

    if (m && m.matched) {
      return {
        protein: Number(((Number(m?.protein_db || 0) * gram) / origGram).toFixed(1)),
        carb: Number(((Number(m?.carb_db || 0) * gram) / origGram).toFixed(1)),
        fat: Number(((Number(m?.fat_db || 0) * gram) / origGram).toFixed(1)),
      };
    }
    const ratio = origGram > 0 ? gram / origGram : 1;
    return {
      protein: Number(((Number(item.protein_ai) || 0) * ratio).toFixed(1)),
      carb: Number(((Number(item.carb_ai) || 0) * ratio).toFixed(1)),
      fat: Number(((Number(item.fat_ai) || 0) * ratio).toFixed(1)),
    };
  };

  // ============================================================
  // TÍNH TOÁN DINH DƯỠNG TỔNG CỘNG
  // ============================================================
  const totalNutrition = useMemo(() => {
    let calo = 0, protein = 0, carb = 0, fat = 0;
    for (const item of editableItems) {
      calo += getItemCalories(item);
      const macros = getItemMacros(item);
      protein += macros.protein;
      carb += macros.carb;
      fat += macros.fat;
    }
    return {
      calo: Math.round(calo) || 0,
      protein: Number((protein || 0).toFixed(1)),
      carb: Number((carb || 0).toFixed(1)),
      fat: Number((fat || 0).toFixed(1)),
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
          message: res?.error || res?.nhan_xet || 'Không thể nhận diện món ăn. Vui lòng thử lại với ảnh rõ nét hơn.',
        });
      }
    } catch (err) {
      console.error('Lỗi nhận diện:', err);
      const detail = err.response?.data?.detail || err.message;
      setSaveStatus({
        type: 'error',
        message: detail ? `Lỗi: ${detail}` : 'Lỗi nhận diện hình ảnh! Vui lòng kiểm tra kết nối Backend (Port 8000).',
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
    const g = Number(newGram);
    const validG = Math.max(0, g || 0);

    setEditableItems((prev) =>
      prev.map((item) => {
        if (item._id !== itemId) return item;

        const curGram = Math.max(1, Number(item.uoc_luong_gram) || 100);

        let calPerG = item._cal_per_g;
        let proPerG = item._pro_per_g;
        let carbPerG = item._carb_per_g;
        let fatPerG = item._fat_per_g;

        if (calPerG === undefined) {
          const cal = getItemCalories(item);
          const macros = getItemMacros(item);
          calPerG = cal / curGram;
          proPerG = macros.protein / curGram;
          carbPerG = macros.carb / curGram;
          fatPerG = macros.fat / curGram;
        }

        const newCal = Math.round(calPerG * validG);
        const newPro = Number((proPerG * validG).toFixed(1));
        const newCarb = Number((carbPerG * validG).toFixed(1));
        const newFat = Number((fatPerG * validG).toFixed(1));

        return {
          ...item,
          uoc_luong_gram: newGram,
          _original_gram: validG || 1,
          calo_ai: newCal,
          protein_ai: newPro,
          carb_ai: newCarb,
          fat_ai: newFat,
          _cal_per_g: calPerG,
          _pro_per_g: proPerG,
          _carb_per_g: carbPerG,
          _fat_per_g: fatPerG,
          matched_food: item.matched_food
            ? {
                ...item.matched_food,
                calo_db: newCal,
                protein_db: newPro,
                carb_db: newCarb,
                fat_db: newFat,
              }
            : null,
        };
      })
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
    if (itemToEdit && itemToEdit._id === itemId) {
      setItemToEdit(null);
    }
  };

  const handleOpenEditItem = (item) => {
    const gram = Math.max(1, Number(item.uoc_luong_gram) || 100);
    const cal = getItemCalories(item);
    const macros = getItemMacros(item);
    setItemToEdit(item);
    setItemEditForm({
      ten: item.ten || '',
      gram: gram,
      calo: cal,
      protein: macros.protein,
      carb: macros.carb,
      fat: macros.fat,
      _cal_per_g: cal / gram,
      _pro_per_g: macros.protein / gram,
      _carb_per_g: macros.carb / gram,
      _fat_per_g: macros.fat / gram,
    });
  };

  const handleModalGramChange = (newVal) => {
    const newG = Number(newVal);
    const validG = Math.max(0, newG || 0);
    const calPerG = (itemEditForm._cal_per_g !== undefined && !isNaN(itemEditForm._cal_per_g))
      ? itemEditForm._cal_per_g
      : (itemEditForm.gram > 0 ? itemEditForm.calo / itemEditForm.gram : 0);
    const proPerG = (itemEditForm._pro_per_g !== undefined && !isNaN(itemEditForm._pro_per_g))
      ? itemEditForm._pro_per_g
      : (itemEditForm.gram > 0 ? itemEditForm.protein / itemEditForm.gram : 0);
    const carbPerG = (itemEditForm._carb_per_g !== undefined && !isNaN(itemEditForm._carb_per_g))
      ? itemEditForm._carb_per_g
      : (itemEditForm.gram > 0 ? itemEditForm.carb / itemEditForm.gram : 0);
    const fatPerG = (itemEditForm._fat_per_g !== undefined && !isNaN(itemEditForm._fat_per_g))
      ? itemEditForm._fat_per_g
      : (itemEditForm.gram > 0 ? itemEditForm.fat / itemEditForm.gram : 0);

    setItemEditForm((prev) => ({
      ...prev,
      gram: newVal,
      calo: Math.round(calPerG * validG),
      protein: Number((proPerG * validG).toFixed(1)),
      carb: Number((carbPerG * validG).toFixed(1)),
      fat: Number((fatPerG * validG).toFixed(1)),
      _cal_per_g: calPerG,
      _pro_per_g: proPerG,
      _carb_per_g: carbPerG,
      _fat_per_g: fatPerG,
    }));
  };

  const handleModalCaloChange = (newVal) => {
    const val = Number(newVal) || 0;
    const curG = Math.max(1, Number(itemEditForm.gram) || 100);
    setItemEditForm((prev) => ({
      ...prev,
      calo: newVal,
      _cal_per_g: val / curG,
    }));
  };

  const handleModalMacroChange = (field, newVal) => {
    const val = Number(newVal) || 0;
    const curG = Math.max(1, Number(itemEditForm.gram) || 100);
    const key = `_${field === 'protein' ? 'pro' : field}_per_g`;
    setItemEditForm((prev) => ({
      ...prev,
      [field]: newVal,
      [key]: val / curG,
    }));
  };

  const handleSaveEditItem = () => {
    if (!itemToEdit) return;
    const newName = itemEditForm.ten.trim() || itemToEdit.ten;
    const newGram = Math.max(1, Number(itemEditForm.gram) || 100);
    const newCalo = Math.max(0, Number(itemEditForm.calo) || 0);
    const newPro = Math.max(0, Number(itemEditForm.protein) || 0);
    const newCarb = Math.max(0, Number(itemEditForm.carb) || 0);
    const newFat = Math.max(0, Number(itemEditForm.fat) || 0);

    setEditableItems((prev) =>
      prev.map((it) => {
        if (it._id !== itemToEdit._id) return it;
        return {
          ...it,
          ten: newName,
          uoc_luong_gram: newGram,
          _original_gram: newGram,
          calo_ai: newCalo,
          protein_ai: newPro,
          carb_ai: newCarb,
          fat_ai: newFat,
          _cal_per_g: newCalo / newGram,
          _pro_per_g: newPro / newGram,
          _carb_per_g: newCarb / newGram,
          _fat_per_g: newFat / newGram,
          _is_custom: true,
          matched_food: it.matched_food
            ? {
                ...it.matched_food,
                food_name: newName,
                calo_db: newCalo,
                protein_db: newPro,
                carb_db: newCarb,
                fat_db: newFat,
                calo_per_100g: (newCalo / newGram) * 100,
              }
            : null,
        };
      })
    );
    setItemToEdit(null);
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
    if (!currentUser) {
      if (onOpenAuthModal) onOpenAuthModal();
      return;
    }
    if (editableItems.length === 0) return;
    setIsSubmitting(true);
    setSaveStatus(null);

    const items = editableItems.map((item) => {
      const m = item.matched_food;
      const gram = Number(item.uoc_luong_gram) || 100;
      const cal = getItemCalories(item);
      const macros = getItemMacros(item);

      return {
        food_id: m?.food_id || null,
        serving_id: null,
        food_name: item.ten,
        portion_size: `${gram}g`,
        portion_multiplier: 1.0,
        actual_gram: gram,
        calories: cal,
        protein: macros.protein,
        carb: macros.carb,
        fat: macros.fat,
        toppings_applied: [],
        image_proof_url: null,
      };
    });

    const mealLabels = { breakfast: 'Bữa Sáng', lunch: 'Bữa Trưa', dinner: 'Bữa Tối', snack: 'Bữa Phụ' };
    const payload = {
      meal_type: selectedMealType || 'lunch',
      items: items,
    };

    try {
      const res = await createMealLog(payload);
      setSaveStatus({
        type: 'success',
        message: `Đã lưu thành công ${items.length} món vào ${mealLabels[selectedMealType] || 'nhật ký'} (Mã bữa ăn: #${res.meal_log_id})! Bạn có thể xem lại tại tab Lịch sử & Thống kê.`,
      });
    } catch (err) {
      console.error('Lỗi lưu nhật ký:', err);
      const detail = err.response?.data?.detail || err.message;
      setSaveStatus({
        type: 'error',
        message: detail ? `Lưu thất bại: ${detail}` : 'Lưu thất bại! Vui lòng thử lại.',
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
        model_version: analysisResult?.ai_source || 'gemini-flash',
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
    setItemToEdit(null);
  };

  // ============================================================
  // RENDER GIAO DIỆN
  // ============================================================
  return (
    <div className="vision-tab">
      {/* Tiêu đề */}
      <div style={{ marginBottom: '16px' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
          Quét Món Ăn & Tính Calo (AI Vision)
        </h1>
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
              {analysisResult?.ai_source?.includes('gemini') ? '✨ Google Gemini AI Vision' : 'WebRTC Camera & Tải tệp'}
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
                  Google Gemini đang bóc tách từng thành phần
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
                      backgroundColor: 'rgba(16, 185, 129, 0.15)',
                      color: 'var(--color-accent)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Sparkles size={12} />
                    Google Gemini AI Vision
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
                      border: '1px solid var(--border-color)',
                      borderLeft: isMatched ? '4px solid var(--color-accent)' : '4px solid #F59E0B',
                      backgroundColor: 'var(--bg-surface)',
                    }}
                  >
                    {/* Dòng 1: Tên món + Badge + Nút Sửa / Xóa */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {item.ten}
                          </span>
                          {item._is_custom && (
                            <span
                              style={{
                                fontSize: '0.68rem',
                                fontWeight: 600,
                                padding: '1px 6px',
                                borderRadius: '4px',
                                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                                color: 'var(--color-accent)',
                              }}
                            >
                              ✏️ Đã chỉnh sửa
                            </span>
                          )}
                        </div>
                        {item.ghi_chu && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.ghi_chu}</span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <button
                          onClick={() => handleOpenEditItem(item)}
                          title="Chỉnh sửa món này (Tên, Gram, Calo, Macros)"
                          style={{
                            background: 'rgba(16, 185, 129, 0.1)', border: 'none', cursor: 'pointer',
                            color: 'var(--color-accent)', padding: '4px 8px', borderRadius: '5px',
                            display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 600
                          }}
                        >
                          <Edit3 size={13} /> Sửa
                        </button>
                        <button
                          onClick={() => removeItem(item._id)}
                          title="Xóa món này"
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: '#EF4444', padding: '4px', borderRadius: '4px',
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
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
                            title="Bấm để sửa nhanh gram"
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
                    {(() => {
                      const itemMacros = getItemMacros(item);
                      return (
                        <div style={{ display: 'flex', gap: '12px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          <span>Đạm: <strong>{itemMacros.protein}g</strong></span>
                          <span>Carb: <strong>{itemMacros.carb}g</strong></span>
                          <span>Béo: <strong>{itemMacros.fat}g</strong></span>
                        </div>
                      );
                    })()}
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

              {/* CHỌN LOẠI BỮA ĂN (Sáng, Trưa, Tối, Phụ) */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  Ghi nhận vào bữa ăn:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                  {[
                    { key: 'breakfast', label: 'Bữa Sáng', icon: '🌅' },
                    { key: 'lunch', label: 'Bữa Trưa', icon: '☀️' },
                    { key: 'dinner', label: 'Bữa Tối', icon: '🌙' },
                    { key: 'snack', label: 'Bữa Phụ', icon: '🍎' },
                  ].map((m) => (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => setSelectedMealType(m.key)}
                      style={{
                        padding: '8px 4px',
                        borderRadius: 'var(--radius-inner)',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        border: selectedMealType === m.key ? '2px solid var(--color-accent)' : '1px solid var(--border-color)',
                        backgroundColor: selectedMealType === m.key ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-card)',
                        color: selectedMealType === m.key ? 'var(--color-accent)' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '3px',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <span style={{ fontSize: '1.1rem' }}>{m.icon}</span>
                      <span>{m.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* NÚT LƯU VÀO NHẬT KÝ DATABASE */}
              <button
                className="btn btn-primary"
                style={{ width: '100%', height: '46px', fontSize: '0.92rem', fontWeight: 600 }}
                disabled={isSubmitting || editableItems.length === 0}
                onClick={handleSaveMealLog}
              >
                {isSubmitting
                  ? 'Đang lưu vào PostgreSQL...'
                  : (!currentUser
                    ? `🔑 Đăng nhập để lưu vào nhật ký`
                    : `💾 Lưu ${editableItems.length} món vào ${
                        selectedMealType === 'breakfast' ? 'Bữa Sáng' :
                        selectedMealType === 'lunch' ? 'Bữa Trưa' :
                        selectedMealType === 'dinner' ? 'Bữa Tối' : 'Bữa Phụ'
                      }`)}
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

      {/* MODAL CHỈNH SỬA CHI TIẾT MÓN ĂN */}
      {itemToEdit && (
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
          onClick={() => setItemToEdit(null)}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '460px',
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-card)',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
              padding: '22px',
              border: '1px solid var(--border-color)',
              marginBottom: 0,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                <Edit3 size={18} color="var(--color-accent)" /> Chỉnh sửa món ăn
              </h3>
              <button
                onClick={() => setItemToEdit(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Inputs Form */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  Tên món ăn:
                </label>
                <input
                  type="text"
                  value={itemEditForm.ten}
                  onChange={(e) => setItemEditForm((p) => ({ ...p, ten: e.target.value }))}
                  placeholder="Nhập tên món ăn..."
                  style={{
                    width: '100%', height: '38px', padding: '0 10px',
                    borderRadius: 'var(--radius-inner)', border: '1px solid var(--border-strong)',
                    fontSize: '0.88rem', fontWeight: 600, backgroundColor: 'var(--bg-surface)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                    Khối lượng (g):
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="3000"
                    value={itemEditForm.gram}
                    onChange={(e) => handleModalGramChange(e.target.value)}
                    style={{
                      width: '100%', height: '38px', padding: '0 10px',
                      borderRadius: 'var(--radius-inner)', border: '1px solid var(--border-strong)',
                      fontSize: '0.9rem', fontWeight: 600, backgroundColor: 'var(--bg-surface)',
                      color: 'var(--text-primary)',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                    Năng lượng (kcal):
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="5000"
                    value={itemEditForm.calo}
                    onChange={(e) => handleModalCaloChange(e.target.value)}
                    style={{
                      width: '100%', height: '38px', padding: '0 10px',
                      borderRadius: 'var(--radius-inner)', border: '1px solid var(--color-accent)',
                      fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-accent)',
                      backgroundColor: 'var(--bg-surface)',
                    }}
                  />
                </div>
              </div>

              {/* 3 Macro: Protein, Carb, Fat (Tự động tính theo gram hoặc chỉnh riêng) */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Dinh dưỡng đa lượng (Tự động cập nhật theo gram):
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                  <div style={{ padding: '8px', borderRadius: 'var(--radius-inner)', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: '0.72rem', color: '#10B981', fontWeight: 600, display: 'block' }}>Đạm (P) g</span>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={itemEditForm.protein}
                      onChange={(e) => handleModalMacroChange('protein', e.target.value)}
                      style={{ width: '100%', border: 'none', background: 'transparent', fontWeight: 700, fontSize: '0.88rem', outline: 'none', color: 'var(--text-primary)' }}
                    />
                  </div>
                  <div style={{ padding: '8px', borderRadius: 'var(--radius-inner)', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: '0.72rem', color: '#3B82F6', fontWeight: 600, display: 'block' }}>Carb (C) g</span>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={itemEditForm.carb}
                      onChange={(e) => handleModalMacroChange('carb', e.target.value)}
                      style={{ width: '100%', border: 'none', background: 'transparent', fontWeight: 700, fontSize: '0.88rem', outline: 'none', color: 'var(--text-primary)' }}
                    />
                  </div>
                  <div style={{ padding: '8px', borderRadius: 'var(--radius-inner)', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: '0.72rem', color: '#F59E0B', fontWeight: 600, display: 'block' }}>Béo (F) g</span>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={itemEditForm.fat}
                      onChange={(e) => handleModalMacroChange('fat', e.target.value)}
                      style={{ width: '100%', border: 'none', background: 'transparent', fontWeight: 700, fontSize: '0.88rem', outline: 'none', color: 'var(--text-primary)' }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '22px' }}>
              <button
                className="btn btn-outline"
                style={{ height: '38px', fontSize: '0.84rem' }}
                onClick={() => setItemToEdit(null)}
              >
                Hủy
              </button>
              <button
                className="btn btn-primary"
                style={{ height: '38px', fontSize: '0.84rem' }}
                onClick={handleSaveEditItem}
              >
                <Check size={16} /> Lưu thay đổi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
