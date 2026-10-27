/**
 * MỤC ĐÍCH: Màn hình Tủ lạnh thông minh & Trợ lý AI Dinh dưỡng.
 * TABS: [Tủ lạnh & Gợi ý] | [Trợ lý AI]
 * ĐẦU VÀO: userProfile (truyền xuống ChatbotTab để cá nhân hóa tư vấn)
 */
import React, { useState, useEffect } from 'react';
import { ChefHat, Clock, Sparkles, Check, CheckCircle2, Bot, Refrigerator } from 'lucide-react';
import ChatbotTab from './ChatbotTab';
import { getIngredients, getRecipes } from '../../services/api';

export default function FridgeTab({ userProfile }) {
  // Sub-tab: 'fridge' | 'chatbot'
  const [activeSubTab, setActiveSubTab] = useState('fridge');

  // Danh sách nguyên liệu mặc định
  const defaultIngredients = [
    { id: 1, name: 'Ức gà', category: 'Thịt cá' },
    { id: 2, name: 'Trứng gà', category: 'Trứng sữa' },
    { id: 3, name: 'Cà chua', category: 'Rau củ' },
    { id: 4, name: 'Bắp cải', category: 'Rau củ' },
    { id: 5, name: 'Hành tây', category: 'Rau củ' },
    { id: 6, name: 'Nấm đùi gà', category: 'Rau củ' },
    { id: 7, name: 'Đậu phụ', category: 'Trứng sữa' },
    { id: 8, name: 'Cà rốt', category: 'Rau củ' },
  ];

  const defaultRecipes = [
    {
      id: 1,
      title: 'Ức gà áp chảo sốt cà chua',
      desc: 'Món ăn giàu đạm, ít béo, vị chua ngọt thanh mát cực kỳ thích hợp cho người kiểm soát cân nặng.',
      cal: 280,
      prepTime: 15,
      protein: 35,
      matchedCount: 2,
      totalCount: 2,
      steps: [
        'Ức gà rửa sạch, khía nhẹ trên bề mặt, ướp chút muối tiêu 10 phút.',
        'Cà chua thái hạt lựu, phi thơm với tỏi băm trên chảo nóng cùng 1 thìa dầu oliu.',
        'Áp chảo ức gà vàng 2 mặt, đun cùng sốt cà chua đến khi chín đều.'
      ]
    },
    {
      id: 2,
      title: 'Canh đậu phụ nấm cà chua thanh đạm',
      desc: 'Món canh chay thanh mát, bổ dưỡng, cung cấp chất xơ và đạm thực vật lành mạnh.',
      cal: 140,
      prepTime: 12,
      protein: 9.5,
      matchedCount: 1,
      totalCount: 3,
      steps: [
        'Đậu phụ cắt miếng vuông vừa ăn. Nấm đùi gà ngâm nước muối rửa sạch thái lát.',
        'Cà chua xào tạo màu, thêm 400ml nước đun sôi.',
        'Thả đậu phụ và nấm vào đun sôi 5 phút, nêm gia vị vừa miệng.'
      ]
    }
  ];

  const [ingredientsList, setIngredientsList] = useState(defaultIngredients);
  const [recipesList, setRecipesList] = useState(defaultRecipes);

  // Tải dữ liệu nguyên liệu và công thức thực tế từ PostgreSQL
  useEffect(() => {
    getIngredients().then(res => {
      if (res?.data?.length > 0) setIngredientsList(res.data);
    }).catch(() => {});

    getRecipes().then(res => {
      if (res?.data?.length > 0) {
        const formatted = res.data.map(r => ({
          id: r.id,
          title: r.title,
          desc: r.description,
          cal: r.total_calories,
          prepTime: r.prep_time_minutes + r.cook_time_minutes,
          protein: r.protein_g,
          matchedCount: 2,
          totalCount: (r.ingredients || []).length || 2,
          steps: r.instructions || []
        }));
        setRecipesList(formatted);
      }
    }).catch(() => {});
  }, []);

  // Trạng thái các nguyên liệu được tick chọn
  const [selectedIngs, setSelectedIngs] = useState(['Ức gà', 'Cà chua']);

  const toggleIng = (name) => {
    setSelectedIngs(prev =>
      prev.includes(name) ? prev.filter(item => item !== name) : [...prev, name]
    );
  };

  return (
    <div className="fridge-tab">
      {/* Tab switcher: Tủ lạnh | Trợ lý AI */}
      <div style={{
        display: 'flex', gap: '4px', marginBottom: '20px',
        backgroundColor: 'var(--bg-surface)', padding: '4px',
        borderRadius: 'var(--radius-inner)', border: '1px solid var(--border-color)',
        width: 'fit-content',
      }}>
        {[
          { id: 'fridge', label: 'Tủ Lạnh & Gợi Ý', icon: <ChefHat size={15} /> },
          { id: 'chatbot', label: 'Trợ Lý AI', icon: <Bot size={15} /> },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className="btn"
            style={{
              height: '34px', minHeight: '34px', gap: '6px',
              fontSize: '0.82rem', fontWeight: activeSubTab === tab.id ? 600 : 500,
              borderRadius: 'calc(var(--radius-inner) - 2px)',
              backgroundColor: activeSubTab === tab.id ? 'var(--color-accent)' : 'transparent',
              color: activeSubTab === tab.id ? 'white' : 'var(--text-secondary)',
              border: 'none', transition: 'all 0.2s ease',
            }}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.id === 'chatbot' && (
              <span style={{
                fontSize: '0.62rem', fontWeight: 700, padding: '1px 5px',
                borderRadius: '4px',
                backgroundColor: activeSubTab === 'chatbot' ? 'rgba(255,255,255,0.25)' : 'var(--color-accent-light)',
                color: activeSubTab === 'chatbot' ? 'white' : 'var(--color-accent)',
              }}>RAG</span>
            )}
          </button>
        ))}
      </div>

      {/* Chatbot AI Tab */}
      {activeSubTab === 'chatbot' && (
        <ChatbotTab userProfile={userProfile} />
      )}

      {/* Fridge & Recipe Tab */}
      {activeSubTab === 'fridge' && (<>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
          Gợi Ý Nấu Ăn Từ Đồ Trong Tủ
        </h1>
        <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
          Tick chọn những gì bạn đang có trong bếp, hệ thống sẽ đề xuất món ăn phù hợp với Calo còn lại hôm nay.
        </p>
      </div>

      {/* 1. Khung chọn nguyên liệu */}
      <section className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Trong tủ lạnh của bạn có gì?</h2>
            <span className="card-subtitle">Đã chọn: {selectedIngs.length} nguyên liệu</span>
          </div>
          <ChefHat size={20} color="var(--color-accent)" />
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {ingredientsList.map((ing) => {
            const isSelected = selectedIngs.includes(ing.name);
            return (
              <button
                key={ing.id}
                onClick={() => toggleIng(ing.name)}
                className="btn"
                style={{
                  height: '36px',
                  minHeight: '36px',
                  borderRadius: 'var(--radius-pill)',
                  border: isSelected ? '1px solid var(--color-accent)' : '1px solid var(--border-color)',
                  backgroundColor: isSelected ? 'var(--color-accent-light)' : 'var(--bg-surface)',
                  color: isSelected ? 'var(--color-accent)' : 'var(--text-primary)',
                  fontWeight: isSelected ? 600 : 500,
                  fontSize: '0.82rem'
                }}
              >
                {isSelected && <Check size={14} strokeWidth={3} />}
                <span>{ing.name}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* 2. Danh sách món ăn gợi ý */}
      <section className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Món ăn đề xuất cho bạn</h2>
            <span className="card-subtitle">Thỏa mãn ngân sách Calo còn lại (550 kcal)</span>
          </div>
          <span className="brand-badge" style={{ backgroundColor: 'var(--color-accent-light)', color: 'var(--color-accent)' }}>
            Khớp nguyên liệu cao
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {recipesList.map((rec) => (
            <div key={rec.id} style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-inner)', padding: '16px', backgroundColor: 'var(--bg-card)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)' }}>{rec.title}</h3>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '4px' }}>{rec.desc}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className="tabular-nums" style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-accent)' }}>
                    {rec.cal} kcal
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--text-muted)', justifyContent: 'flex-end', marginTop: '2px' }}>
                    <Clock size={12} /> {rec.prepTime} phút
                  </div>
                </div>
              </div>

              {/* Tag nguyên liệu khớp */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '12px 0' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--color-success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <CheckCircle2 size={14} /> Có sẵn {rec.matchedCount}/{rec.totalCount} nguyên liệu
                </span>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>| {rec.protein}g Protein</span>
              </div>

              {/* Các bước nấu tóm tắt */}
              <div style={{ backgroundColor: 'var(--bg-surface)', padding: '12px', borderRadius: 'var(--radius-inner)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>Các bước thực hiện nhanh:</strong>
                <ol style={{ paddingLeft: '16px', lineHeight: 1.6 }}>
                  {rec.steps.map((st, i) => (
                    <li key={i}>{st}</li>
                  ))}
                </ol>
              </div>

              <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn-primary" style={{ height: '36px', minHeight: '36px', fontSize: '0.82rem' }}>
                  Tôi đã nấu món này (+{rec.cal} kcal)
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
      </>)}
    </div>
  );
}
