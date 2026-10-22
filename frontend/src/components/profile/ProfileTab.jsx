/**
 * MỤC ĐÍCH: Màn hình Quản lý Hồ sơ & Cá nhân hóa Dinh dưỡng (Personalization Tab).
 * TÍNH NĂNG:
 * - Hiển thị Real-time bảng chỉ số thể trạng: BMI, BMR, TDEE, Calo mục tiêu, Macro Ratio
 * - Form tùy biến thể trạng: Chiều cao, cân nặng, giới tính, năm sinh, mức độ vận động
 * - Lựa chọn Mục tiêu (Giảm cân / Giữ cân / Tăng cân) & Chế độ ăn (Bình thường, Low-carb, Keto, Chay)
 * - Ràng buộc an toàn: Dị ứng thực phẩm & Nguyên liệu không thích
 * - Tự động cập nhật trực tiếp vào PostgreSQL và đồng bộ sang Dashboard
 */
import React, { useState, useEffect } from 'react';
import { 
  User, Flame, Activity, Scale, Target, ShieldAlert, Heart, 
  Save, CheckCircle2, AlertCircle, LogOut, LogIn, Sparkles, Award
} from 'lucide-react';
import { updateUserProfile, logoutUser } from '../../services/api';

const ALLERGY_OPTIONS = [
  { id: 'seafood', label: 'Hải sản (Tôm, cua, mực)' },
  { id: 'peanut', label: 'Đậu phộng / Lạc' },
  { id: 'milk', label: 'Sữa bò & Lactose' },
  { id: 'egg', label: 'Trứng gà, vịt' },
  { id: 'soybean', label: 'Đậu nành' },
  { id: 'gluten', label: 'Gluten / Lúa mì' },
];

const DISLIKE_OPTIONS = [
  'Hành lá', 'Mắm tôm', 'Thịt mỡ', 'Nội tạng', 'Ớt cay', 'Rau mùi'
];

export default function ProfileTab({ currentUser, userProfile, onProfileUpdated, onOpenAuthModal }) {
  // Local editable form states
  const [formData, setFormData] = useState({
    fullName: '',
    gender: 'male',
    birthYear: 2000,
    heightCm: 170,
    weightKg: 65,
    activityLevel: 1.375,
    goal: 'maintain',
    dietType: 'normal',
    allergies: [],
    dislikedIngredients: [],
  });

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState('');
  const [saveError, setSaveError] = useState('');

  // Đồng bộ form khi userProfile từ Backend thay đổi
  useEffect(() => {
    if (userProfile) {
      setFormData({
        fullName: currentUser?.full_name || '',
        gender: userProfile.gender || 'male',
        birthYear: userProfile.birth_year || 2000,
        heightCm: Number(userProfile.height_cm || 170),
        weightKg: Number(userProfile.weight_kg || 65),
        activityLevel: Number(userProfile.activity_level || 1.375),
        goal: userProfile.goal || 'maintain',
        dietType: userProfile.diet_type || 'normal',
        allergies: userProfile.allergies || [],
        dislikedIngredients: userProfile.disliked_ingredients || [],
      });
    }
  }, [userProfile, currentUser]);

  const toggleAllergy = (allergyId) => {
    setFormData(prev => {
      const exists = prev.allergies.includes(allergyId);
      return {
        ...prev,
        allergies: exists 
          ? prev.allergies.filter(a => a !== allergyId) 
          : [...prev.allergies, allergyId]
      };
    });
  };

  const toggleDislike = (item) => {
    setFormData(prev => {
      const exists = prev.dislikedIngredients.includes(item);
      return {
        ...prev,
        dislikedIngredients: exists 
          ? prev.dislikedIngredients.filter(d => d !== item) 
          : [...prev.dislikedIngredients, item]
      };
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess('');
    setSaveError('');

    try {
      const payload = {
        full_name: formData.fullName,
        gender: formData.gender,
        birth_year: Number(formData.birthYear),
        height_cm: Number(formData.heightCm),
        weight_kg: Number(formData.weightKg),
        activity_level: Number(formData.activityLevel),
        goal: formData.goal,
        diet_type: formData.dietType,
        allergies: formData.allergies,
        disliked_ingredients: formData.dislikedIngredients,
      };

      const res = await updateUserProfile(payload);
      setSaveSuccess('Đã lưu và cập nhật chỉ số dinh dưỡng thành công!');
      if (res.user && onProfileUpdated) {
        onProfileUpdated(res.user);
      }
      setTimeout(() => setSaveSuccess(''), 4000);
    } catch (err) {
      setSaveError(err.message || 'Lỗi lưu thông tin');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    logoutUser();
    window.location.reload();
  };

  const currentBmi = userProfile?.bmi || 22.2;
  const currentBmiStatus = userProfile?.bmi_status || 'Bình thường (Lý tưởng)';
  const currentTargetCal = userProfile?.target_calories || 2000;
  const currentTdee = userProfile?.tdee || 2255;
  const currentBmr = userProfile?.bmr || 1640;
  const idealWeight = userProfile?.ideal_weight_kg || 65;

  return (
    <div className="profile-container animate-fade-in">
      {/* 1. Header Hồ sơ người dùng */}
      <section className="profile-header-card">
        <div className="profile-user-info">
          <div className="profile-avatar-circle">
            <User size={36} color="var(--color-accent)" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>
                {currentUser?.full_name || 'Khách / Demo User'}
              </h2>
              <span className="badge badge-accent">
                {currentUser?.role === 'admin' ? 'Quản trị viên' : 'Thành viên'}
              </span>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '2px' }}>
              {currentUser?.email || 'demo@cacalo.vn (Chế độ xem trước)'}
            </p>
          </div>
        </div>

        <div className="profile-actions">
          {currentUser ? (
            <button 
              type="button" 
              className="btn btn-outline btn-sm"
              onClick={handleLogout}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <LogOut size={16} />
              <span>Đăng xuất</span>
            </button>
          ) : (
            <button 
              type="button" 
              className="btn btn-primary btn-sm"
              onClick={onOpenAuthModal}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <LogIn size={16} />
              <span>Đăng nhập / Đăng ký</span>
            </button>
          )}
        </div>
      </section>

      {/* 2. Thẻ hiển thị chỉ số sức khỏe & dinh dưỡng tính toán tự động */}
      <section className="health-matrix-section">
        <h3 className="section-title">
          <Sparkles size={18} color="var(--color-accent)" />
          Chỉ số thể trạng & Dinh dưỡng cá nhân hóa
        </h3>

        <div className="health-matrix-grid">
          {/* Card BMI */}
          <div className="health-card">
            <div className="health-card-header">
              <span className="health-card-title">Chỉ số khối cơ thể (BMI)</span>
              <Scale size={18} color="var(--color-accent)" />
            </div>
            <div className="health-card-body">
              <span className="health-card-value tabular-nums">{currentBmi}</span>
              <span className="bmi-status-tag">{currentBmiStatus}</span>
            </div>
            {/* Visual scale */}
            <div className="bmi-visual-scale" title="Thang đo BMI chuẩn Châu Á (WHO WPR)">
              <div className={`bmi-scale-bar segment-under ${currentBmi < 18.5 ? 'active' : ''}`}>Gầy</div>
              <div className={`bmi-scale-bar segment-normal ${currentBmi >= 18.5 && currentBmi < 23 ? 'active' : ''}`}>Chuẩn</div>
              <div className={`bmi-scale-bar segment-over ${currentBmi >= 23 && currentBmi < 25 ? 'active' : ''}`}>Thừa cân</div>
              <div className={`bmi-scale-bar segment-obese ${currentBmi >= 25 ? 'active' : ''}`}>Béo phì</div>
            </div>
            <p className="health-card-hint">
              Cân nặng lý tưởng khuyến nghị: <strong>{idealWeight} kg</strong>
            </p>
          </div>

          {/* Card Target Calories */}
          <div className="health-card">
            <div className="health-card-header">
              <span className="health-card-title">Mục tiêu Calo hằng ngày</span>
              <Flame size={18} color="var(--color-carb)" />
            </div>
            <div className="health-card-body">
              <span className="health-card-value tabular-nums" style={{ color: 'var(--color-carb)' }}>
                {currentTargetCal}
              </span>
              <span className="health-unit">kcal / ngày</span>
            </div>
            <div className="energy-substats">
              <span>BMR: <strong>{currentBmr} kcal</strong></span>
              <span>•</span>
              <span>TDEE: <strong>{currentTdee} kcal</strong></span>
            </div>
            <p className="health-card-hint">
              Được tự động điều chỉnh theo mục tiêu: <strong>{
                formData.goal === 'lose_weight' ? 'Giảm mỡ (-500 kcal)' : 
                formData.goal === 'gain_weight' ? 'Tăng cơ (+450 kcal)' : 'Duy trì cân nặng'
              }</strong>
            </p>
          </div>

          {/* Card Macro Ratio */}
          <div className="health-card">
            <div className="health-card-header">
              <span className="health-card-title">Phân bổ Dinh dưỡng đa lượng</span>
              <Activity size={18} color="var(--color-protein)" />
            </div>
            <div className="macro-target-chips">
              <div className="macro-chip macro-pro">
                <span className="chip-name">Đạm (Protein)</span>
                <span className="chip-val tabular-nums">{userProfile?.target_protein_g || 150}g</span>
              </div>
              <div className="macro-chip macro-carb">
                <span className="chip-name">Tinh bột (Carb)</span>
                <span className="chip-val tabular-nums">{userProfile?.target_carb_g || 225}g</span>
              </div>
              <div className="macro-chip macro-fat">
                <span className="chip-name">Chất béo (Fat)</span>
                <span className="chip-val tabular-nums">{userProfile?.target_fat_g || 55}g</span>
              </div>
            </div>
            <p className="health-card-hint">
              Tỷ lệ năng lượng: <strong>{userProfile?.macro_ratio?.protein_pct || 25}% Pro • {userProfile?.macro_ratio?.carb_pct || 50}% Carb • {userProfile?.macro_ratio?.fat_pct || 25}% Fat</strong>
            </p>
          </div>
        </div>
      </section>

      {/* 3. Form điều chỉnh thông số thể trạng & mục tiêu */}
      <form onSubmit={handleSave} className="profile-form-section">
        <h3 className="section-title">
          <Target size={18} color="var(--color-accent)" />
          Tùy chỉnh thông số cơ thể & Mục tiêu cá nhân
        </h3>

        {saveSuccess && (
          <div className="alert-badge alert-success" style={{ marginBottom: '16px' }}>
            <CheckCircle2 size={16} />
            <span>{saveSuccess}</span>
          </div>
        )}
        {saveError && (
          <div className="alert-badge alert-error" style={{ marginBottom: '16px' }}>
            <AlertCircle size={16} />
            <span>{saveError}</span>
          </div>
        )}

        <div className="form-grid-cards">
          {/* Nhóm 1: Thể trạng cơ bản */}
          <div className="form-card-group">
            <h4 className="group-heading">1. Thể trạng cơ bản</h4>
            
            <div className="form-row-2">
              <div className="form-group">
                <label className="form-label">Giới tính</label>
                <select 
                  value={formData.gender}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                  className="form-input"
                >
                  <option value="male">Nam (Mifflin +5)</option>
                  <option value="female">Nữ (Mifflin -161)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Năm sinh</label>
                <input
                  type="number"
                  min="1940"
                  max="2020"
                  value={formData.birthYear}
                  onChange={(e) => setFormData({ ...formData, birthYear: e.target.value })}
                  className="form-input"
                />
              </div>
            </div>

            <div className="form-row-2">
              <div className="form-group">
                <label className="form-label">Chiều cao (cm)</label>
                <input
                  type="number"
                  step="0.5"
                  min="100"
                  max="220"
                  value={formData.heightCm}
                  onChange={(e) => setFormData({ ...formData, heightCm: e.target.value })}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Cân nặng (kg)</label>
                <input
                  type="number"
                  step="0.5"
                  min="30"
                  max="200"
                  value={formData.weightKg}
                  onChange={(e) => setFormData({ ...formData, weightKg: e.target.value })}
                  className="form-input"
                />
              </div>
            </div>
          </div>

          {/* Nhóm 2: Lối sống & Mục tiêu */}
          <div className="form-card-group">
            <h4 className="group-heading">2. Lối sống & Mục tiêu dinh dưỡng</h4>

            <div className="form-group">
              <label className="form-label">Mức độ hoạt động / vận động thể chất</label>
              <select 
                value={formData.activityLevel}
                onChange={(e) => setFormData({ ...formData, activityLevel: Number(e.target.value) })}
                className="form-input"
              >
                <option value={1.2}>Ít vận động (Ngồi văn phòng, không tập thể dục) [x1.2]</option>
                <option value={1.375}>Vận động nhẹ (Tập 1 - 3 buổi/tuần) [x1.375]</option>
                <option value={1.55}>Vận động vừa (Tập thể thao 3 - 5 buổi/tuần) [x1.55]</option>
                <option value={1.725}>Năng động cao (Tập luyện cường độ cao 6 - 7 buổi/tuần) [x1.725]</option>
                <option value={1.9}>Cực kỳ năng động (Lao động nặng / Vận động viên) [x1.9]</option>
              </select>
            </div>

            <div className="form-row-2">
              <div className="form-group">
                <label className="form-label">Mục tiêu cân nặng</label>
                <select 
                  value={formData.goal}
                  onChange={(e) => setFormData({ ...formData, goal: e.target.value })}
                  className="form-input"
                >
                  <option value="lose_weight">Giảm cân (Thâm hụt 500 kcal)</option>
                  <option value="maintain">Duy trì cân nặng hiện tại</option>
                  <option value="gain_weight">Tăng cân / Tăng cơ (Thặng dư 450 kcal)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Chế độ ăn ưa thích</label>
                <select 
                  value={formData.dietType}
                  onChange={(e) => setFormData({ ...formData, dietType: e.target.value })}
                  className="form-input"
                >
                  <option value="normal">Bình thường (Đa dạng)</option>
                  <option value="lowcarb">Low-Carb (Ít tinh bột, giàu đạm)</option>
                  <option value="keto">Ketogenic (Rất ít carb, nhiều béo tốt)</option>
                  <option value="vegetarian">Ăn chay (Có trứng & sữa)</option>
                  <option value="vegan">Thuần chay (100% thực vật)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Nhóm 3: Dị ứng & Khẩu vị cá nhân */}
        <div className="form-card-group" style={{ marginTop: '16px' }}>
          <h4 className="group-heading">
            <ShieldAlert size={16} color="var(--color-danger)" style={{ display: 'inline', marginRight: '6px' }} />
            3. Ràng buộc an toàn thực phẩm & Khẩu vị
          </h4>

          {/* Dị ứng */}
          <div style={{ marginBottom: '14px' }}>
            <label className="form-label">Dị ứng thực phẩm (AI sẽ cảnh báo khi quét món có thành phần này):</label>
            <div className="tags-selection-container">
              {ALLERGY_OPTIONS.map(opt => {
                const isSelected = formData.allergies.includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    className={`tag-toggle-btn ${isSelected ? 'selected' : ''}`}
                    onClick={() => toggleAllergy(opt.id)}
                  >
                    <span>{isSelected ? '✓ ' : '+ '}</span>
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Món ghét / Kiêng ăn */}
          <div>
            <label className="form-label">Nguyên liệu không thích / Kiêng ăn (AI sẽ gợi ý loại trừ):</label>
            <div className="tags-selection-container">
              {DISLIKE_OPTIONS.map(item => {
                const isSelected = formData.dislikedIngredients.includes(item);
                return (
                  <button
                    key={item}
                    type="button"
                    className={`tag-toggle-btn ${isSelected ? 'selected' : ''}`}
                    onClick={() => toggleDislike(item)}
                  >
                    <span>{isSelected ? '✓ ' : '+ '}</span>
                    {item}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Nút lưu */}
        <div className="profile-save-action">
          <button
            type="submit"
            disabled={saving}
            className="btn btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 28px', fontSize: '0.95rem' }}
          >
            <Save size={18} />
            <span>{saving ? 'Đang tính toán & Lưu...' : 'Lưu hồ sơ cá nhân hóa'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
