/**
 * MỤC ĐÍCH: Màn hình Quét món ăn bằng ảnh (Computer Vision Mock UI & Tra cứu Calo).
 * ĐẦU VÀO: foods (danh sách món từ PostgreSQL).
 * ĐẦU RA: Giao diện chọn ảnh, xem kết quả nhận diện AI, chọn khẩu phần S/M/L và toppings.
 */
import React, { useState } from 'react';
import { Camera, Upload, Check, Search, Info } from 'lucide-react';

export default function VisionTab({ foods }) {
  // Trạng thái kích thước khẩu phần đang chọn
  const [selectedSize, setSelectedSize] = useState('M'); // 'S', 'M', 'L'
  const [selectedToppings, setSelectedToppings] = useState([0]); // Index topping

  // Món mẫu phân tích
  const mockResult = {
    foodName: 'Phở bò tái chín',
    confidence: 94,
    category: 'Món nước',
    source: 'Viện Dinh dưỡng Quốc gia',
    baseGram: 500,
    baseCal: 550,
    baseProtein: 34,
    baseCarb: 76,
    baseFat: 12.5,
  };

  // Hệ số khẩu phần
  const sizeMultipliers = {
    S: { factor: 0.75, label: 'Nhỏ (S - 0.75x)', gram: 375 },
    M: { factor: 1.0, label: 'Vừa (M - 1.0x)', gram: 500 },
    L: { factor: 1.25, label: 'Lớn (L - 1.25x)', gram: 625 },
  };

  const currentMultiplier = sizeMultipliers[selectedSize].factor;
  const currentGram = sizeMultipliers[selectedSize].gram;

  // Tính calo món chính + toppings
  const toppingsList = [
    { name: '+1 Quẩy giòn', cal: 115, pro: 1.8 },
    { name: '+1 Trứng chần', cal: 65, pro: 5.5 },
  ];

  const toppingsCal = selectedToppings.reduce((acc, idx) => acc + (toppingsList[idx]?.cal || 0), 0);
  const totalCal = Math.round(mockResult.baseCal * currentMultiplier + toppingsCal);
  const totalPro = (mockResult.baseProtein * currentMultiplier).toFixed(1);

  const toggleTopping = (index) => {
    setSelectedToppings(prev => 
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  return (
    <div className="vision-tab">
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
          Quét Món Ăn Tính Calo
        </h1>
        <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
          Chụp ảnh hoặc tải lên hình ảnh món ăn để AI nhận diện và ước lượng dinh dưỡng tức thì.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {/* Khung Tải ảnh / Mở Camera */}
        <section className="card" style={{ marginBottom: 0 }}>
          <div className="card-header">
            <h2 className="card-title">Hình ảnh món ăn</h2>
            <span className="card-subtitle">Hỗ trợ JPG, PNG, WebP</span>
          </div>

          <div className="dropzone-box" role="button" tabIndex={0} aria-label="Kéo thả hoặc bấm để tải ảnh">
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'var(--color-accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-accent)' }}>
              <Upload size={24} strokeWidth={1.75} />
            </div>
            <div>
              <p style={{ fontWeight: 600, fontSize: '0.92rem' }}>Kéo thả ảnh món ăn vào đây</p>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>hoặc nhấp chuột để chọn tệp từ máy</p>
            </div>
            <button className="btn btn-outline" style={{ marginTop: '8px' }}>
              <Camera size={16} /> Mở Camera trực tiếp
            </button>
          </div>

          {/* Ô tìm kiếm món ăn thủ công */}
          <div style={{ marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
            <label htmlFor="food-manual-search" style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
              Không có ảnh? Tìm kiếm nhanh tên món:
            </label>
            <div style={{ position: 'relative' }}>
              <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '12px' }} />
              <input
                id="food-manual-search"
                type="text"
                placeholder="Ví dụ: pho bo, com tam, bun cha..."
                style={{ width: '100%', height: '40px', paddingLeft: '36px', paddingRight: '12px', borderRadius: 'var(--radius-inner)', border: '1px solid var(--border-strong)', fontSize: '0.88rem', outline: 'none' }}
              />
            </div>
          </div>
        </section>

        {/* Thẻ Kết quả nhận diện & Tính Calo */}
        <section className="card" style={{ marginBottom: 0 }}>
          <div className="card-header">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="brand-badge" style={{ backgroundColor: 'var(--color-accent-light)', color: 'var(--color-accent)' }}>
                  AI Nhận diện: {mockResult.confidence}%
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Ước lượng</span>
              </div>
              <h2 className="card-title" style={{ fontSize: '1.25rem', marginTop: '6px' }}>
                {mockResult.foodName}
              </h2>
            </div>
          </div>

          {/* Chọn kích thước khẩu phần */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
              Kích thước phần ăn:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              {['S', 'M', 'L'].map((size) => (
                <button
                  key={size}
                  className={`btn ${selectedSize === size ? 'btn-primary' : 'btn-outline'}`}
                  style={{ height: '36px', minHeight: '36px', fontSize: '0.82rem' }}
                  onClick={() => setSelectedSize(size)}
                >
                  {sizeMultipliers[size].label}
                </button>
              ))}
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '6px' }}>
              Khối lượng quy đổi tương đương: <strong className="tabular-nums" style={{ color: 'var(--text-primary)' }}>{currentGram}g</strong>
            </p>
          </div>

          {/* Toppings đi kèm */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
              Topping tùy chọn đi kèm:
            </label>
            {toppingsList.map((top, idx) => {
              const isChecked = selectedToppings.includes(idx);
              return (
                <div
                  key={idx}
                  onClick={() => toggleTopping(idx)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-inner)', marginBottom: '6px', cursor: 'pointer', backgroundColor: isChecked ? 'var(--color-accent-light)' : 'var(--bg-card)' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '18px', height: '18px', borderRadius: '4px', border: '1px solid var(--border-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: isChecked ? 'var(--color-accent)' : '#FFF' }}>
                      {isChecked && <Check size={12} color="#FFF" strokeWidth={3} />}
                    </div>
                    <span style={{ fontSize: '0.85rem' }}>{top.name}</span>
                  </div>
                  <span className="tabular-nums" style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                    +{top.cal} kcal
                  </span>
                </div>
              );
            })}
          </div>

          {/* Tổng Calo tính toán */}
          <div style={{ backgroundColor: 'var(--bg-surface)', padding: '16px', borderRadius: 'var(--radius-inner)', border: '1px solid var(--border-color)', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Tổng năng lượng ước tính:</span>
              <span className="tabular-nums" style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--color-accent)' }}>
                {totalCal} <span style={{ fontSize: '1rem', fontWeight: 500 }}>kcal</span>
              </span>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
              <Info size={12} /> Nguồn: {mockResult.source}
            </p>
          </div>

          <button className="btn btn-primary" style={{ width: '100%', height: '44px' }}>
            Lưu vào nhật ký bữa ăn
          </button>
        </section>
      </div>
    </div>
  );
}
