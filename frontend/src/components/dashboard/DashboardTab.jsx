/**
 * MỤC ĐÍCH: Màn hình Dashboard tổng quan dinh dưỡng trong ngày.
 * ĐẦU VÀO: foods (danh sách món ăn từ Backend).
 * ĐẦU RA: Giao diện theo dõi Calo, Macro, BMI và nhật ký 4 bữa ăn.
 */
import React from 'react';
import { Plus, Flame, Activity, Clock, CheckCircle2 } from 'lucide-react';

export default function DashboardTab({ foods, onSwitchToScan, userProfile, onOpenProfile }) {
  // Dữ liệu dinh dưỡng cá nhân hóa lấy trực tiếp từ Hồ sơ người dùng trong PostgreSQL (làm tròn số nguyên đẹp mắt)
  const targetCal = Math.round(Number(userProfile?.target_calories || 2000));
  const userGoal = {
    currentCalories: 1450,
    targetCalories: targetCal,
    bmi: Number(userProfile?.bmi ? Number(userProfile.bmi).toFixed(1) : 22.2),
    bmiStatus: userProfile?.bmi_status || 'Bình thường (Lý tưởng)',
    tdee: Math.round(Number(userProfile?.tdee || 2255)),
    goal: userProfile?.goal || 'maintain',
    protein: { current: 110, target: Math.round(Number(userProfile?.target_protein_g || 150)) },
    carb: { current: 165, target: Math.round(Number(userProfile?.target_carb_g || 225)) },
    fat: { current: 42, target: Math.round(Number(userProfile?.target_fat_g || 55)) },
  };

  const remainingCalories = Math.max(0, Math.round(userGoal.targetCalories - userGoal.currentCalories));
  const progressPercent = Math.min(100, Math.round((userGoal.currentCalories / userGoal.targetCalories) * 100));

  const meals = [
    {
      id: 'breakfast',
      name: 'Bữa Sáng',
      time: '07:30',
      totalCal: 550,
      items: [
        { name: 'Phở bò tái chín', portion: '1 Tô vừa (500g)', cal: 550 }
      ]
    },
    {
      id: 'lunch',
      name: 'Bữa Trưa',
      time: '12:15',
      totalCal: 680,
      items: [
        { name: 'Cơm tấm sườn bì chả', portion: '1 Đĩa vừa (350g)', cal: 680 }
      ]
    },
    {
      id: 'dinner',
      name: 'Bữa Tối',
      time: '18:45',
      totalCal: 220,
      items: [
        { name: 'Canh chua cá lóc', portion: '1 Bát vừa (200g)', cal: 100 },
        { name: 'Rau muống xào tỏi', portion: '1 Đĩa nhỏ (150g)', cal: 120 }
      ]
    },
    {
      id: 'snack',
      name: 'Bữa Phụ',
      time: 'Chưa ăn',
      totalCal: 0,
      items: []
    }
  ];

  return (
    <div className="dashboard-tab">
      {/* 1. Thẻ tóm tắt Calo chính */}
      <section className="card calorie-summary-card" aria-label="Tóm tắt Calo trong ngày">
        <div className="calorie-number-box">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <Flame size={18} color="var(--color-accent)" aria-hidden="true" />
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              Năng lượng nạp vào hôm nay
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span className="calorie-big-number tabular-nums">{userGoal.currentCalories.toLocaleString()}</span>
            <span style={{ fontSize: '1.25rem', color: 'var(--text-muted)', fontWeight: 500 }}>
              / {userGoal.targetCalories.toLocaleString()} kcal
            </span>
          </div>
          <p className="calorie-target-text">
            Còn lại <strong className="tabular-nums" style={{ color: 'var(--color-accent)' }}>{remainingCalories.toLocaleString()} kcal</strong> để đạt mục tiêu {
              userGoal.goal === 'lose_weight' ? 'giảm cân' :
              userGoal.goal === 'gain_weight' ? 'tăng cân' : 'giữ cân'
            }.
          </p>
        </div>

        {/* Thanh tiến độ trực quan */}
        <div style={{ minWidth: '220px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 600 }}>
            <span>Tiến độ ngày</span>
            <span className="tabular-nums">{progressPercent}%</span>
          </div>
          <div className="macro-bar-container" style={{ height: '10px' }}>
            <div className="macro-bar-fill protein" style={{ width: `${progressPercent}%`, backgroundColor: 'var(--color-accent)' }}></div>
          </div>
          <button className="btn btn-primary" onClick={onSwitchToScan} style={{ width: '100%', marginTop: '8px' }}>
            <Plus size={18} strokeWidth={2} />
            <span>Quét món thêm vào bữa</span>
          </button>
        </div>
      </section>

      {/* 2. Chỉ số Thể trạng & 3 Nhóm chất Macro */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
        {/* Khối Chỉ số BMI & TDEE */}
        <section className="card" style={{ marginBottom: 0 }}>
          <div className="card-header">
            <div>
              <h2 className="card-title">Chỉ số cơ thể</h2>
              <span className="card-subtitle">Hồ sơ cá nhân (Mifflin-St Jeor)</span>
            </div>
            {onOpenProfile && (
              <button 
                type="button" 
                className="btn btn-outline btn-sm"
                onClick={onOpenProfile}
                style={{ fontSize: '0.75rem', padding: '4px 10px' }}
              >
                Cá nhân hóa
              </button>
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border-color)' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Chỉ số BMI:</span>
            <span className="tabular-nums" style={{ fontWeight: 600 }}>{userGoal.bmi} ({userGoal.bmiStatus})</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Tổng tiêu hao (TDEE):</span>
            <span className="tabular-nums" style={{ fontWeight: 600 }}>{userGoal.tdee.toLocaleString()} kcal/ngày</span>
          </div>
        </section>

        {/* Khối Macro (Đạm - Đường - Béo) */}
        <section className="card" style={{ marginBottom: 0 }}>
          <div className="card-header">
            <div>
              <h2 className="card-title">Chất dinh dưỡng đa lượng</h2>
              <span className="card-subtitle">Mục tiêu gram theo thể trạng</span>
            </div>
          </div>
          <div className="macro-grid" style={{ marginTop: 0 }}>
            {/* Protein */}
            <div className="macro-box">
              <span className="macro-label">Chất đạm (Pro)</span>
              <span className="macro-value tabular-nums">{userGoal.protein.current}g</span>
              <div className="macro-bar-container">
                <div className="macro-bar-fill protein" style={{ width: `${Math.round((userGoal.protein.current / userGoal.protein.target) * 100)}%` }}></div>
              </div>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Mục tiêu: {userGoal.protein.target}g</span>
            </div>

            {/* Carb */}
            <div className="macro-box">
              <span className="macro-label">Bột đường (Carb)</span>
              <span className="macro-value tabular-nums">{userGoal.carb.current}g</span>
              <div className="macro-bar-container">
                <div className="macro-bar-fill carb" style={{ width: `${Math.round((userGoal.carb.current / userGoal.carb.target) * 100)}%` }}></div>
              </div>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Mục tiêu: {userGoal.carb.target}g</span>
            </div>

            {/* Fat */}
            <div className="macro-box">
              <span className="macro-label">Chất béo (Fat)</span>
              <span className="macro-value tabular-nums">{userGoal.fat.current}g</span>
              <div className="macro-bar-container">
                <div className="macro-bar-fill fat" style={{ width: `${Math.round((userGoal.fat.current / userGoal.fat.target) * 100)}%` }}></div>
              </div>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Mục tiêu: {userGoal.fat.target}g</span>
            </div>
          </div>
        </section>
      </div>

      {/* 3. Danh sách 4 Bữa ăn trong ngày */}
      <section className="card" style={{ marginTop: '20px' }} aria-label="Nhật ký 4 bữa ăn">
        <div className="card-header">
          <div>
            <h2 className="card-title">Nhật ký bữa ăn hôm nay</h2>
            <span className="card-subtitle">Ghi nhận lượng thức ăn nạp vào thực tế</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {meals.map((meal) => (
            <div key={meal.id} style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-inner)', padding: '16px', backgroundColor: 'var(--bg-card)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock size={16} color="var(--text-muted)" />
                  <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{meal.name}</span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>({meal.time})</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="tabular-nums" style={{ fontWeight: 600, color: meal.totalCal > 0 ? 'var(--color-accent)' : 'var(--text-muted)' }}>
                    {meal.totalCal} kcal
                  </span>
                  <button className="btn btn-outline" style={{ height: '32px', minHeight: '32px', padding: '0 10px', fontSize: '0.78rem' }} onClick={onSwitchToScan}>
                    <Plus size={14} /> Thêm
                  </button>
                </div>
              </div>

              {meal.items.length > 0 ? (
                meal.items.map((item, idx) => (
                  <div key={idx} className="food-row">
                    <div>
                      <p className="food-info-name">{item.name}</p>
                      <span className="food-info-sub">{item.portion}</span>
                    </div>
                    <span className="food-calories-badge tabular-nums">+{item.cal} kcal</span>
                  </div>
                ))
              ) : (
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '8px 0' }}>
                  Chưa có món ăn nào được ghi nhận cho bữa này.
                </p>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
