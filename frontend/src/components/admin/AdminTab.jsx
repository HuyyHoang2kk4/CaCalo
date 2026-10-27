/**
 * MỤC ĐÍCH: Trang Quản trị Hệ thống CaCalo (Admin Portal) theo chuẩn Đặc tả SRS (Module 5).
 * CHỨC NĂNG BAO GỒM:
 * - Tổng quan & KPI: Số liệu CSDL, phân bổ danh mục, ma trận nhầm lẫn AI.
 * - CC-5.1: Quản trị Cơ sở dữ liệu Món ăn (Thêm, Sửa, Xóa, Dinh dưỡng 100g, Khẩu phần S/M/L, Toppings).
 * - CC-5.1: Quản trị Nguyên liệu tủ lạnh (Thêm, Sửa, Xóa, Nhóm thực phẩm, Calo, Nhãn dị ứng).
 * - CC-5.2: Quản lý & Kiểm duyệt Công thức nấu ăn (Các bước nấu, Định lượng nguyên liệu theo gram).
 * - CC-5.3: Duyệt dữ liệu sửa lỗi AI (MLOps Human-in-the-loop), duyệt/từ chối, xuất Dataset JSON huấn luyện.
 * - Quản lý Người dùng: Danh sách tài khoản, hồ sơ BMI/TDEE, phân quyền Quản trị viên (Role-based).
 */
import React, { useState, useEffect } from 'react';
import {
  ShieldCheck, LayoutDashboard, Utensils, Carrot, BookOpen,
  Sparkles, CheckCircle2, XCircle, Trash2, Edit3, Plus, Search,
  RefreshCw, Download, Database, Users, AlertTriangle, Eye,
  Clock, Flame, Check, ChevronRight, X, ExternalLink, ArrowRight
} from 'lucide-react';
import {
  getAdminOverview,
  getAdminFoods, createAdminFood, updateAdminFood, deleteAdminFood,
  getAdminIngredients, createAdminIngredient, updateAdminIngredient, deleteAdminIngredient,
  getAdminRecipes, createAdminRecipe, updateAdminRecipe, deleteAdminRecipe,
  getAdminFeedbacks, updateAdminFeedbackStatus, deleteAdminFeedback, exportAdminFeedbacksDataset, seedAdminSampleFeedbacks,
  getAdminUsers, updateAdminUserRole
} from '../../services/api';

export default function AdminTab({ currentUser, onSwitchToApp }) {
  // Sub-tabs trong Admin: 'overview' | 'foods' | 'ingredients' | 'recipes' | 'feedbacks' | 'users'
  const [activeSubTab, setActiveSubTab] = useState('overview');
  
  // Trạng thái tải dữ liệu
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null); // { message, type: 'success' | 'error' }

  // Dữ liệu cho các tab
  const [overviewData, setOverviewData] = useState(null);
  const [foods, setFoods] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [feedbacks, setFeedbacks] = useState([]);
  const [usersList, setUsersList] = useState([]);

  // Bộ lọc & Tìm kiếm
  const [foodSearch, setFoodSearch] = useState('');
  const [foodCategory, setFoodCategory] = useState('all');
  const [ingCategory, setIngCategory] = useState('all');
  const [ingSearch, setIngSearch] = useState('');
  const [feedbackFilter, setFeedbackFilter] = useState('all');

  // Trạng thái Modal (Thêm / Sửa / Chi tiết)
  const [modalType, setModalType] = useState(null); // 'food' | 'ingredient' | 'recipe' | 'feedback_detail'
  const [editingItem, setEditingItem] = useState(null);
  const [selectedFeedback, setSelectedFeedback] = useState(null);

  // Form states cho Modal Thêm / Sửa
  const [foodFormData, setFoodFormData] = useState({
    name: '', category: 'Món chính', image_url: '', description: '', source: 'Viện Dinh dưỡng Quốc gia',
    calories: 120, protein: 8, carb: 15, fat: 3, fiber: 1, sugar: 1, sodium: 350,
    serving_m_gram: 400, serving_s_gram: 300, serving_l_gram: 500,
    toppings_str: '+1 Trứng chần (45g, 65 cal), +1 Quẩy giòn (25g, 115 cal)'
  });

  const [ingFormData, setIngFormData] = useState({
    name: '', category: 'Rau củ', calories_per_100g: 40, allergen_tag: ''
  });

  const [recipeFormData, setRecipeFormData] = useState({
    title: '', description: '', prep_time_minutes: 15, cook_time_minutes: 20,
    total_calories: 320, protein_g: 25, carb_g: 30, fat_g: 8, servings_yield: 1,
    instructions_text: 'Bước 1: Sơ chế và rửa sạch nguyên liệu.\nBước 2: Nêm gia vị vừa ăn và chế biến.\nBước 3: Trình bày ra đĩa và thưởng thức khi còn nóng.',
    selected_ingredients: [] // [{ ingredient_id, amount_gram }]
  });

  // Hiển thị thông báo Toast
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Tải dữ liệu tùy theo Sub-tab
  const loadData = async () => {
    setLoading(true);
    try {
      if (activeSubTab === 'overview') {
        const res = await getAdminOverview();
        if (res.success) setOverviewData(res);
      } else if (activeSubTab === 'foods') {
        const res = await getAdminFoods(foodSearch, foodCategory);
        if (res.success) setFoods(res.data || []);
      } else if (activeSubTab === 'ingredients') {
        const res = await getAdminIngredients(ingCategory, ingSearch);
        if (res.success) setIngredients(res.data || []);
      } else if (activeSubTab === 'recipes') {
        const res = await getAdminRecipes();
        if (res.success) setRecipes(res.data || []);
      } else if (activeSubTab === 'feedbacks') {
        const res = await getAdminFeedbacks(feedbackFilter);
        if (res.success) setFeedbacks(res.data || []);
      } else if (activeSubTab === 'users') {
        const res = await getAdminUsers();
        if (res.success) setUsersList(res.data || []);
      }
    } catch (err) {
      showToast('Không thể tải dữ liệu: ' + (err.response?.data?.detail || err.message), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeSubTab, foodCategory, ingCategory, feedbackFilter]);

  // Tìm kiếm có debounce nhẹ
  const handleFoodSearchSubmit = (e) => {
    e.preventDefault();
    getAdminFoods(foodSearch, foodCategory).then(res => {
      if (res.success) setFoods(res.data || []);
    });
  };

  const handleIngSearchSubmit = (e) => {
    e.preventDefault();
    getAdminIngredients(ingCategory, ingSearch).then(res => {
      if (res.success) setIngredients(res.data || []);
    });
  };

  // --- Handlers: Món ăn ---
  const handleOpenFoodModal = (food = null) => {
    if (food) {
      setEditingItem(food);
      const nut = food.nutrition_per_100g || {};
      const servings = food.servings || [];
      const mServ = servings.find(s => s.unit?.includes('M') || s.is_default) || servings[0];
      const sServ = servings.find(s => s.unit?.includes('S')) || {};
      const lServ = servings.find(s => s.unit?.includes('L')) || {};
      const topStr = (food.toppings || []).map(t => `${t.name} (${t.gram}g, ${t.calories} cal)`).join(', ');

      setFoodFormData({
        name: food.name || '',
        category: food.category || 'Món chính',
        image_url: food.image_url || '',
        description: food.description || '',
        source: food.source || 'Viện Dinh dưỡng Quốc gia',
        calories: nut.calories || 120,
        protein: nut.protein || 8,
        carb: nut.carb || 15,
        fat: nut.fat || 3,
        fiber: nut.fiber || 1,
        sugar: nut.sugar || 1,
        sodium: nut.sodium || 350,
        serving_m_gram: mServ ? mServ.gram : 400,
        serving_s_gram: sServ ? sServ.gram : 300,
        serving_l_gram: lServ ? lServ.gram : 500,
        toppings_str: topStr
      });
    } else {
      setEditingItem(null);
      setFoodFormData({
        name: '', category: 'Món chính', image_url: '', description: '', source: 'Viện Dinh dưỡng Quốc gia',
        calories: 120, protein: 8, carb: 15, fat: 3, fiber: 1, sugar: 1, sodium: 350,
        serving_m_gram: 400, serving_s_gram: 300, serving_l_gram: 500,
        toppings_str: '+1 Trứng chần (45g, 65 cal), +1 Quẩy giòn (25g, 115 cal)'
      });
    }
    setModalType('food');
  };

  const handleSaveFood = async (e) => {
    e.preventDefault();
    if (!foodFormData.name.trim()) {
      showToast('Vui lòng nhập tên món ăn', 'error');
      return;
    }

    // Parse toppings từ chuỗi người dùng nhập
    const parsedToppings = [];
    if (foodFormData.toppings_str.trim()) {
      const items = foodFormData.toppings_str.split(',').map(s => s.trim()).filter(Boolean);
      items.forEach(item => {
        parsedToppings.push({
          name: item.split('(')[0].trim(),
          gram: 30,
          calories: 50,
          protein: 2,
          carb: 5,
          fat: 2
        });
      });
    }

    const payload = {
      name: foodFormData.name.trim(),
      category: foodFormData.category,
      image_url: foodFormData.image_url.trim(),
      description: foodFormData.description.trim(),
      source: foodFormData.source.trim(),
      nutrition: {
        calories: Number(foodFormData.calories),
        protein: Number(foodFormData.protein),
        carb: Number(foodFormData.carb),
        fat: Number(foodFormData.fat),
        fiber: Number(foodFormData.fiber),
        sugar: Number(foodFormData.sugar),
        sodium: Number(foodFormData.sodium),
      },
      servings: [
        { unit: 'Phần nhỏ (S - 0.75x)', gram: Number(foodFormData.serving_s_gram), is_default: false },
        { unit: 'Phần vừa tiêu chuẩn (M - 1.0x)', gram: Number(foodFormData.serving_m_gram), is_default: true },
        { unit: 'Phần lớn (L - 1.25x)', gram: Number(foodFormData.serving_l_gram), is_default: false },
      ],
      toppings: parsedToppings
    };

    try {
      if (editingItem) {
        await updateAdminFood(editingItem.id, payload);
        showToast('Cập nhật món ăn thành công!');
      } else {
        await createAdminFood(payload);
        showToast('Đã thêm món ăn mới vào CSDL chuẩn!');
      }
      setModalType(null);
      loadData();
    } catch (err) {
      showToast('Lỗi lưu món ăn: ' + (err.response?.data?.detail || err.message), 'error');
    }
  };

  const handleDeleteFood = async (id, name) => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa món "${name}" khỏi cơ sở dữ liệu?`)) {
      try {
        await deleteAdminFood(id);
        showToast(`Đã xóa món "${name}"`);
        loadData();
      } catch (err) {
        showToast('Lỗi xóa món: ' + (err.response?.data?.detail || err.message), 'error');
      }
    }
  };

  // --- Handlers: Nguyên liệu ---
  const handleOpenIngModal = (ing = null) => {
    if (ing) {
      setEditingItem(ing);
      setIngFormData({
        name: ing.name || '',
        category: ing.category || 'Rau củ',
        calories_per_100g: ing.calories_per_100g || 40,
        allergen_tag: ing.allergen_tag || ''
      });
    } else {
      setEditingItem(null);
      setIngFormData({
        name: '', category: 'Rau củ', calories_per_100g: 40, allergen_tag: ''
      });
    }
    setModalType('ingredient');
  };

  const handleSaveIng = async (e) => {
    e.preventDefault();
    if (!ingFormData.name.trim()) {
      showToast('Vui lòng nhập tên nguyên liệu', 'error');
      return;
    }
    const payload = {
      name: ingFormData.name.trim(),
      category: ingFormData.category,
      calories_per_100g: Number(ingFormData.calories_per_100g),
      allergen_tag: ingFormData.allergen_tag.trim() || null
    };

    try {
      if (editingItem) {
        await updateAdminIngredient(editingItem.id, payload);
        showToast('Cập nhật nguyên liệu thành công!');
      } else {
        await createAdminIngredient(payload);
        showToast('Đã thêm nguyên liệu mới vào CSDL!');
      }
      setModalType(null);
      loadData();
    } catch (err) {
      showToast('Lỗi lưu nguyên liệu: ' + (err.response?.data?.detail || err.message), 'error');
    }
  };

  const handleDeleteIng = async (id, name) => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa nguyên liệu "${name}"?`)) {
      try {
        await deleteAdminIngredient(id);
        showToast(`Đã xóa nguyên liệu "${name}"`);
        loadData();
      } catch (err) {
        showToast('Lỗi xóa nguyên liệu: ' + (err.response?.data?.detail || err.message), 'error');
      }
    }
  };

  // --- Handlers: Công thức nấu ăn ---
  const handleOpenRecipeModal = (recipe = null) => {
    if (recipe) {
      setEditingItem(recipe);
      setRecipeFormData({
        title: recipe.title || '',
        description: recipe.description || '',
        prep_time_minutes: recipe.prep_time_minutes || 15,
        cook_time_minutes: recipe.cook_time_minutes || 20,
        total_calories: recipe.total_calories || 300,
        protein_g: recipe.protein_g || 20,
        carb_g: recipe.carb_g || 30,
        fat_g: recipe.fat_g || 10,
        servings_yield: recipe.servings_yield || 1,
        instructions_text: (recipe.instructions || []).join('\n'),
        selected_ingredients: recipe.ingredients || []
      });
    } else {
      setEditingItem(null);
      setRecipeFormData({
        title: '', description: '', prep_time_minutes: 15, cook_time_minutes: 20,
        total_calories: 300, protein_g: 20, carb_g: 30, fat_g: 10, servings_yield: 1,
        instructions_text: 'Bước 1: Sơ chế và rửa sạch nguyên liệu.\nBước 2: Đun sôi nước dùng và nêm gia vị.\nBước 3: Thả nguyên liệu vào nấu chín và múc ra bát.',
        selected_ingredients: []
      });
    }
    // Tải danh sách nguyên liệu để chọn
    getAdminIngredients().then(res => {
      if (res.success) setIngredients(res.data || []);
    });
    setModalType('recipe');
  };

  const handleSaveRecipe = async (e) => {
    e.preventDefault();
    if (!recipeFormData.title.trim()) {
      showToast('Vui lòng nhập tên công thức', 'error');
      return;
    }
    const steps = recipeFormData.instructions_text.split('\n').map(s => s.trim()).filter(Boolean);

    const payload = {
      title: recipeFormData.title.trim(),
      description: recipeFormData.description.trim(),
      prep_time_minutes: Number(recipeFormData.prep_time_minutes),
      cook_time_minutes: Number(recipeFormData.cook_time_minutes),
      total_calories: Number(recipeFormData.total_calories),
      protein_g: Number(recipeFormData.protein_g),
      carb_g: Number(recipeFormData.carb_g),
      fat_g: Number(recipeFormData.fat_g),
      servings_yield: Number(recipeFormData.servings_yield),
      instructions: steps,
      ingredients: recipeFormData.selected_ingredients
    };

    try {
      if (editingItem) {
        await updateAdminRecipe(editingItem.id, payload);
        showToast('Cập nhật công thức nấu ăn thành công!');
      } else {
        await createAdminRecipe(payload);
        showToast('Tạo công thức mới thành công!');
      }
      setModalType(null);
      loadData();
    } catch (err) {
      showToast('Lỗi lưu công thức: ' + (err.response?.data?.detail || err.message), 'error');
    }
  };

  const handleDeleteRecipe = async (id, title) => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa công thức "${title}"?`)) {
      try {
        await deleteAdminRecipe(id);
        showToast(`Đã xóa công thức "${title}"`);
        loadData();
      } catch (err) {
        showToast('Lỗi xóa công thức: ' + (err.response?.data?.detail || err.message), 'error');
      }
    }
  };

  // --- Handlers: Duyệt phản hồi AI (CC-5.3) ---
  const handleUpdateFeedbackStatus = async (id, status) => {
    try {
      await updateAdminFeedbackStatus(id, status);
      showToast(`Đã cập nhật trạng thái phản hồi sang '${status === 'approved_for_training' ? 'Duyệt vào tập Train' : 'Từ chối'}'`);
      loadData();
    } catch (err) {
      showToast('Lỗi cập nhật trạng thái: ' + (err.response?.data?.detail || err.message), 'error');
    }
  };

  const handleDeleteFeedback = async (id) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa bản ghi phản hồi này?')) {
      try {
        await deleteAdminFeedback(id);
        showToast('Đã xóa bản ghi phản hồi');
        loadData();
      } catch (err) {
        showToast('Lỗi xóa: ' + (err.response?.data?.detail || err.message), 'error');
      }
    }
  };

  const handleExportDataset = async () => {
    try {
      const res = await exportAdminFeedbacksDataset();
      const jsonStr = JSON.stringify(res, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cacalo_retraining_dataset_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(`Đã xuất ${res.total_approved_samples || 0} mẫu huấn luyện MLOps!`);
    } catch (err) {
      showToast('Lỗi xuất tập dữ liệu: ' + (err.response?.data?.detail || err.message), 'error');
    }
  };

  const handleSeedSampleFeedbacks = async () => {
    try {
      const res = await seedAdminSampleFeedbacks();
      showToast(res.message || 'Đã nạp mẫu phản hồi AI!');
      loadData();
    } catch (err) {
      showToast('Lỗi nạp mẫu: ' + (err.response?.data?.detail || err.message), 'error');
    }
  };

  // --- Handlers: Quản lý Người dùng & Phân quyền ---
  const handleToggleUserRole = async (user) => {
    const newRole = user.role === 'admin' ? 'user' : 'admin';
    const actionName = newRole === 'admin' ? 'nâng lên Quản trị viên' : 'hạ xuống Người dùng thường';
    if (window.confirm(`Bạn có chắc muốn ${actionName} cho tài khoản ${user.email}?`)) {
      try {
        await updateAdminUserRole(user.id, newRole);
        showToast(`Đã đổi vai trò của ${user.full_name} thành '${newRole}'`);
        loadData();
      } catch (err) {
        showToast('Lỗi đổi vai trò: ' + (err.response?.data?.detail || err.message), 'error');
      }
    }
  };

  return (
    <div className="admin-portal-container">
      {/* 1. Header Trang Quản Trị */}
      <div className="admin-header-card">
        <div className="admin-header-main">
          <div className="admin-badge-icon">
            <ShieldCheck size={28} strokeWidth={2} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 className="admin-page-title">Trang Quản Trị CaCalo</h1>
              <span className="badge-admin-role">Admin Control Panel</span>
            </div>
            <p className="admin-page-subtitle">
              Quản lý CSDL dinh dưỡng chuẩn (CC-5.1), Kiểm duyệt công thức (CC-5.2), Phê duyệt phản hồi MLOps AI (CC-5.3)
            </p>
          </div>
        </div>

        <div className="admin-header-actions">
          <button 
            className="btn btn-outline" 
            onClick={loadData} 
            disabled={loading}
            title="Làm mới dữ liệu từ PostgreSQL"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            <span>Làm mới</span>
          </button>
          <button 
            className="btn btn-outline"
            onClick={onSwitchToApp}
            title="Quay lại giao diện người dùng"
          >
            <span>Về ứng dụng</span>
            <ExternalLink size={15} />
          </button>
        </div>
      </div>

      {/* Thông báo Toast */}
      {toast && (
        <div className={`admin-toast ${toast.type}`}>
          {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* 2. Thanh điều hướng Sub-tabs trong Admin */}
      <div className="admin-tabs-nav">
        {[
          { id: 'overview', label: 'Tổng Quan & KPIs', icon: LayoutDashboard },
          { id: 'foods', label: 'Quản Lý Món Ăn (CC-5.1)', icon: Utensils },
          { id: 'ingredients', label: 'Nguyên Liệu Tủ Lạnh (CC-5.1)', icon: Carrot },
          { id: 'recipes', label: 'Công Thức Nấu (CC-5.2)', icon: BookOpen },
          { id: 'feedbacks', label: 'Duyệt Phản Hồi AI (CC-5.3)', icon: Sparkles },
          { id: 'users', label: 'Quản Lý Người Dùng', icon: Users },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              className={`admin-tab-btn ${isActive ? 'active' : ''}`}
              onClick={() => setActiveSubTab(tab.id)}
            >
              <Icon size={18} strokeWidth={isActive ? 2 : 1.75} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 3. Nội dung chi tiết từng Sub-tab */}

      {/* TAB 1: TỔNG QUAN & KPIS */}
      {activeSubTab === 'overview' && overviewData && (
        <div className="admin-tab-content">
          {/* Lưới Thẻ KPI */}
          <div className="admin-kpi-grid">
            <div className="admin-kpi-card">
              <div className="kpi-icon-wrap" style={{ backgroundColor: 'var(--color-accent-light)', color: 'var(--color-accent)' }}>
                <Utensils size={22} />
              </div>
              <div>
                <p className="kpi-label">Tổng Món Ăn CSDL</p>
                <h3 className="kpi-value tabular-nums">{overviewData.kpis?.total_foods || 0}</h3>
                <span className="kpi-subtext">Món ăn chuẩn hóa</span>
              </div>
            </div>

            <div className="admin-kpi-card">
              <div className="kpi-icon-wrap" style={{ backgroundColor: '#FEF3C7', color: '#D97706' }}>
                <Carrot size={22} />
              </div>
              <div>
                <p className="kpi-label">Nguyên Liệu Tủ Lạnh</p>
                <h3 className="kpi-value tabular-nums">{overviewData.kpis?.total_ingredients || 0}</h3>
                <span className="kpi-subtext">5 nhóm thực phẩm</span>
              </div>
            </div>

            <div className="admin-kpi-card">
              <div className="kpi-icon-wrap" style={{ backgroundColor: '#EFF6FF', color: '#2563EB' }}>
                <BookOpen size={22} />
              </div>
              <div>
                <p className="kpi-label">Công Thức Nấu Ăn</p>
                <h3 className="kpi-value tabular-nums">{overviewData.kpis?.total_recipes || 0}</h3>
                <span className="kpi-subtext">Gợi ý thông minh</span>
              </div>
            </div>

            <div className="admin-kpi-card">
              <div className="kpi-icon-wrap" style={{ backgroundColor: '#F3E8FF', color: '#7E22CE' }}>
                <Users size={22} />
              </div>
              <div>
                <p className="kpi-label">Tài Khoản Người Dùng</p>
                <h3 className="kpi-value tabular-nums">{overviewData.kpis?.total_users || 0}</h3>
                <span className="kpi-subtext">BMI TB: {overviewData.kpis?.avg_bmi || 22.0}</span>
              </div>
            </div>

            <div className="admin-kpi-card">
              <div className="kpi-icon-wrap" style={{ backgroundColor: '#FCE7F3', color: '#DB2777' }}>
                <Sparkles size={22} />
              </div>
              <div>
                <p className="kpi-label">Feedbacks Chờ Duyệt</p>
                <h3 className="kpi-value tabular-nums" style={{ color: 'var(--color-danger)' }}>
                  {overviewData.kpis?.pending_feedbacks || 0}
                </h3>
                <span className="kpi-subtext">Đã duyệt: {overviewData.kpis?.approved_feedbacks || 0} ca</span>
              </div>
            </div>

            <div className="admin-kpi-card">
              <div className="kpi-icon-wrap" style={{ backgroundColor: '#E0F2FE', color: '#0284C7' }}>
                <Database size={22} />
              </div>
              <div>
                <p className="kpi-label">Nhật Ký Bữa Ăn</p>
                <h3 className="kpi-value tabular-nums">{overviewData.kpis?.total_meal_logs || 0}</h3>
                <span className="kpi-subtext">{overviewData.kpis?.total_log_items || 0} món đã ghi</span>
              </div>
            </div>
          </div>

          {/* Khối Biểu Đồ & Ma Trận Nhầm Lẫn AI */}
          <div className="admin-two-cols">
            {/* Cột 1: Phân bổ danh mục món ăn */}
            <div className="admin-panel-card">
              <div className="panel-card-header">
                <h3 className="panel-card-title">Phân Bổ Danh Mục Món Ăn</h3>
                <span className="badge-light">{overviewData.categories_distribution?.length || 0} danh mục</span>
              </div>
              <div className="category-bars-list">
                {overviewData.categories_distribution?.map((item, idx) => {
                  const maxCount = Math.max(...overviewData.categories_distribution.map(d => d.count), 1);
                  const pct = Math.round((item.count / maxCount) * 100);
                  return (
                    <div key={idx} className="category-bar-row">
                      <div className="category-bar-label">
                        <span>{item.category}</span>
                        <strong className="tabular-nums">{item.count} món</strong>
                      </div>
                      <div className="progress-track" style={{ height: '8px' }}>
                        <div 
                          className="progress-fill" 
                          style={{ width: `${pct}%`, backgroundColor: 'var(--color-accent)' }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Cột 2: Ma trận nhầm lẫn AI (Confusion Pairs - CC-5.3) */}
            <div className="admin-panel-card">
              <div className="panel-card-header">
                <div>
                  <h3 className="panel-card-title">Ma Trận Nhầm Lẫn AI (Top Confusion Pairs)</h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Các cặp món ăn AI hay dự đoán sai nhất cần đưa vào tập huấn luyện lại
                  </p>
                </div>
                <button className="btn btn-outline btn-sm" onClick={handleExportDataset}>
                  <Download size={14} />
                  <span>Xuất JSON</span>
                </button>
              </div>

              {overviewData.confusion_pairs?.length > 0 ? (
                <div className="confusion-pairs-list">
                  {overviewData.confusion_pairs.map((pair, idx) => (
                    <div key={idx} className="confusion-pair-item">
                      <div className="pair-names">
                        <span className="pair-predicted" title="Nhãn AI nhận diện">{pair.predicted}</span>
                        <ArrowRight size={14} className="pair-arrow" />
                        <span className="pair-corrected" title="Người dùng sửa thành">{pair.corrected}</span>
                      </div>
                      <span className="pair-frequency tabular-nums">
                        {pair.count} lượt sửa
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="admin-empty-box">
                  <p>Chưa có đủ dữ liệu nhầm lẫn từ phản hồi người dùng.</p>
                  <button className="btn btn-outline btn-sm" onClick={handleSeedSampleFeedbacks} style={{ marginTop: '10px' }}>
                    <Plus size={14} />
                    <span>Nạp mẫu phản hồi AI để kiểm thử</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: QUẢN LÝ MÓN ĂN (CC-5.1) */}
      {activeSubTab === 'foods' && (
        <div className="admin-tab-content">
          {/* Thanh công cụ: Tìm kiếm, lọc category, nút Thêm */}
          <div className="admin-toolbar">
            <form onSubmit={handleFoodSearchSubmit} className="admin-search-form">
              <Search size={16} className="search-icon" />
              <input
                type="text"
                placeholder="Tìm món ăn (có dấu hoặc không dấu: pho bo, bun cha)..."
                value={foodSearch}
                onChange={(e) => setFoodSearch(e.target.value)}
                className="admin-search-input"
              />
              <button type="submit" className="btn btn-primary btn-sm">Tìm</button>
            </form>

            <div className="admin-toolbar-right">
              <select 
                value={foodCategory} 
                onChange={(e) => setFoodCategory(e.target.value)}
                className="admin-select"
              >
                <option value="all">Tất cả danh mục</option>
                <option value="Món chính">Món chính</option>
                <option value="Món nước">Món nước</option>
                <option value="Món xào">Món xào</option>
                <option value="Đồ ăn vặt">Đồ ăn vặt</option>
                <option value="Đồ uống">Đồ uống</option>
              </select>

              <button className="btn btn-primary" onClick={() => handleOpenFoodModal(null)}>
                <Plus size={16} />
                <span>Thêm Món Ăn Mới</span>
              </button>
            </div>
          </div>

          {/* Bảng Dữ Liệu Món Ăn */}
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ width: '60px' }}>ID</th>
                  <th style={{ width: '220px' }}>Tên Món Ăn</th>
                  <th style={{ width: '110px' }}>Danh Mục</th>
                  <th style={{ width: '130px' }}>Calo / 100g</th>
                  <th style={{ width: '180px' }}>Macro (P / C / F)</th>
                  <th style={{ width: '140px' }}>Khẩu Phần Chuẩn</th>
                  <th style={{ width: '130px' }}>Nguồn</th>
                  <th style={{ width: '110px', textAlign: 'center' }}>Thao Tác</th>
                </tr>
              </thead>
              <tbody>
                {foods.length > 0 ? (
                  foods.map((food) => {
                    const nut = food.nutrition_per_100g || {};
                    const defaultServing = food.servings?.find(s => s.is_default) || food.servings?.[0];
                    return (
                      <tr key={food.id}>
                        <td className="tabular-nums text-muted">#{food.id}</td>
                        <td>
                          <div className="food-cell">
                            {food.image_url ? (
                              <img src={food.image_url} alt={food.name} className="food-cell-thumb" />
                            ) : (
                              <div className="food-cell-thumb-placeholder">🍲</div>
                            )}
                            <div>
                              <strong className="food-cell-name">{food.name}</strong>
                              <span className="food-cell-sub">{food.name_unsigned}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="category-chip">{food.category}</span>
                        </td>
                        <td>
                          <strong className="tabular-nums" style={{ color: 'var(--color-accent)' }}>
                            {nut.calories || 0} kcal
                          </strong>
                        </td>
                        <td>
                          <div className="macro-inline tabular-nums">
                            <span style={{ color: 'var(--color-protein)' }}>P: {nut.protein || 0}g</span>
                            <span style={{ color: 'var(--color-carb)' }}>C: {nut.carb || 0}g</span>
                            <span style={{ color: 'var(--color-fat)' }}>F: {nut.fat || 0}g</span>
                          </div>
                        </td>
                        <td>
                          <span className="tabular-nums" style={{ fontSize: '0.85rem' }}>
                            {defaultServing ? `${defaultServing.unit} (${defaultServing.gram}g)` : '400g'}
                          </span>
                        </td>
                        <td>
                          <span className="source-label" title={food.source}>{food.source || 'Viện Dinh dưỡng'}</span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div className="action-buttons-cell">
                            <button 
                              className="action-icon-btn edit" 
                              onClick={() => handleOpenFoodModal(food)}
                              title="Chỉnh sửa món"
                            >
                              <Edit3 size={15} />
                            </button>
                            <button 
                              className="action-icon-btn delete" 
                              onClick={() => handleDeleteFood(food.id, food.name)}
                              title="Xóa món ăn"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                      Không tìm thấy món ăn nào phù hợp với bộ lọc.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: QUẢN LÝ NGUYÊN LIỆU (CC-5.1) */}
      {activeSubTab === 'ingredients' && (
        <div className="admin-tab-content">
          <div className="admin-toolbar">
            <form onSubmit={handleIngSearchSubmit} className="admin-search-form">
              <Search size={16} className="search-icon" />
              <input
                type="text"
                placeholder="Tìm nguyên liệu tủ lạnh..."
                value={ingSearch}
                onChange={(e) => setIngSearch(e.target.value)}
                className="admin-search-input"
              />
              <button type="submit" className="btn btn-primary btn-sm">Tìm</button>
            </form>

            <div className="admin-toolbar-right">
              <select 
                value={ingCategory} 
                onChange={(e) => setIngCategory(e.target.value)}
                className="admin-select"
              >
                <option value="all">Tất cả nhóm</option>
                <option value="Thịt cá">Thịt cá</option>
                <option value="Rau củ">Rau củ</option>
                <option value="Trứng sữa">Trứng sữa</option>
                <option value="Gia vị">Gia vị</option>
                <option value="Tinh bột">Tinh bột</option>
              </select>

              <button className="btn btn-primary" onClick={() => handleOpenIngModal(null)}>
                <Plus size={16} />
                <span>Thêm Nguyên Liệu Mới</span>
              </button>
            </div>
          </div>

          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ width: '60px' }}>ID</th>
                  <th>Tên Nguyên Liệu</th>
                  <th>Tên Không Dấu</th>
                  <th>Nhóm Thực Phẩm</th>
                  <th>Calo / 100g</th>
                  <th>Nhãn Dị Ứng (Allergen)</th>
                  <th style={{ width: '110px', textAlign: 'center' }}>Thao Tác</th>
                </tr>
              </thead>
              <tbody>
                {ingredients.length > 0 ? (
                  ingredients.map((ing) => (
                    <tr key={ing.id}>
                      <td className="tabular-nums text-muted">#{ing.id}</td>
                      <td><strong>{ing.name}</strong></td>
                      <td className="text-muted">{ing.name_unsigned}</td>
                      <td><span className="category-chip">{ing.category}</span></td>
                      <td><strong className="tabular-nums">{ing.calories_per_100g} kcal</strong></td>
                      <td>
                        {ing.allergen_tag ? (
                          <span className="allergen-badge" title="Ràng buộc cứng dị ứng">{ing.allergen_tag}</span>
                        ) : (
                          <span className="text-muted" style={{ fontSize: '0.8rem' }}>Không</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div className="action-buttons-cell">
                          <button 
                            className="action-icon-btn edit" 
                            onClick={() => handleOpenIngModal(ing)}
                            title="Sửa nguyên liệu"
                          >
                            <Edit3 size={15} />
                          </button>
                          <button 
                            className="action-icon-btn delete" 
                            onClick={() => handleDeleteIng(ing.id, ing.name)}
                            title="Xóa nguyên liệu"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                      Không có nguyên liệu nào.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: QUẢN LÝ CÔNG THỨC NẤU ĂN (CC-5.2) */}
      {activeSubTab === 'recipes' && (
        <div className="admin-tab-content">
          <div className="admin-toolbar" style={{ justifyContent: 'space-between' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Danh mục công thức nấu ăn do Admin kiểm duyệt phục vụ gợi ý món ăn từ nguyên liệu tủ lạnh (`CC-3.2`).
            </p>
            <button className="btn btn-primary" onClick={() => handleOpenRecipeModal(null)}>
              <Plus size={16} />
              <span>Tạo Công Thức Mới</span>
            </button>
          </div>

          <div className="recipes-admin-grid">
            {recipes.length > 0 ? (
              recipes.map((r) => (
                <div key={r.id} className="recipe-admin-card">
                  <div className="recipe-card-top">
                    <div>
                      <span className="recipe-id-badge">Công thức #{r.id}</span>
                      <h3 className="recipe-card-title">{r.title}</h3>
                    </div>
                    <div className="action-buttons-cell">
                      <button className="action-icon-btn edit" onClick={() => handleOpenRecipeModal(r)} title="Sửa">
                        <Edit3 size={15} />
                      </button>
                      <button className="action-icon-btn delete" onClick={() => handleDeleteRecipe(r.id, r.title)} title="Xóa">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  <p className="recipe-card-desc">{r.description || 'Chưa có mô tả chi tiết.'}</p>

                  <div className="recipe-meta-row tabular-nums">
                    <span><Clock size={14} /> {r.prep_time_minutes + r.cook_time_minutes} phút</span>
                    <span><Flame size={14} /> {r.total_calories} kcal</span>
                    <span>P: {r.protein_g}g | C: {r.carb_g}g | F: {r.fat_g}g</span>
                  </div>

                  <div className="recipe-steps-preview">
                    <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                      Các bước thực hiện ({r.instructions?.length || 0} bước):
                    </p>
                    <ol className="recipe-steps-list">
                      {(r.instructions || []).slice(0, 3).map((step, idx) => (
                        <li key={idx} style={{ fontSize: '0.82rem', marginBottom: '2px' }}>{step}</li>
                      ))}
                      {(r.instructions?.length || 0) > 3 && (
                        <li style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          ...và {(r.instructions.length - 3)} bước khác
                        </li>
                      )}
                    </ol>
                  </div>
                </div>
              ))
            ) : (
              <div className="admin-empty-box" style={{ gridColumn: '1 / -1' }}>
                <p>Chưa có công thức nấu ăn nào trong cơ sở dữ liệu.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: DUYỆT PHẢN HỒI SỬA LỖI AI & MLOPS (CC-5.3) */}
      {activeSubTab === 'feedbacks' && (
        <div className="admin-tab-content">
          <div className="admin-toolbar">
            <div style={{ display: 'flex', gap: '8px' }}>
              {[
                { id: 'all', label: 'Tất cả phản hồi' },
                { id: 'pending', label: 'Chờ duyệt (Pending)' },
                { id: 'approved_for_training', label: 'Đã duyệt Train' },
                { id: 'rejected', label: 'Đã từ chối' }
              ].map(f => (
                <button
                  key={f.id}
                  className={`btn btn-sm ${feedbackFilter === f.id ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setFeedbackFilter(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-outline btn-sm" onClick={handleSeedSampleFeedbacks}>
                <Plus size={14} />
                <span>Nạp mẫu test AI</span>
              </button>
              <button className="btn btn-primary btn-sm" onClick={handleExportDataset}>
                <Download size={14} />
                <span>Xuất Dataset MLOps (JSON)</span>
              </button>
            </div>
          </div>

          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ width: '60px' }}>ID</th>
                  <th style={{ width: '80px' }}>Ảnh</th>
                  <th>Nhãn AI Dự Đoán</th>
                  <th>Độ Tin Cậy</th>
                  <th>Nhãn Người Dùng Sửa</th>
                  <th>Trạng Thái</th>
                  <th>Thời Gian</th>
                  <th style={{ width: '140px', textAlign: 'center' }}>Kiểm Duyệt</th>
                </tr>
              </thead>
              <tbody>
                {feedbacks.length > 0 ? (
                  feedbacks.map((fb) => (
                    <tr key={fb.id}>
                      <td className="tabular-nums text-muted">#{fb.id}</td>
                      <td>
                        {fb.original_image_url ? (
                          <img 
                            src={fb.original_image_url} 
                            alt="Ảnh món ăn" 
                            className="food-cell-thumb" 
                            style={{ cursor: 'pointer' }}
                            onClick={() => { setSelectedFeedback(fb); setModalType('feedback_detail'); }}
                          />
                        ) : (
                          <div className="food-cell-thumb-placeholder">📷</div>
                        )}
                      </td>
                      <td>
                        <strong style={{ color: 'var(--color-danger)' }}>{fb.predicted_label}</strong>
                        <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {fb.model_version}
                        </span>
                      </td>
                      <td>
                        <span className="confidence-pill tabular-nums">
                          {Math.round((fb.confidence_score || 0.7) * 100)}%
                        </span>
                      </td>
                      <td>
                        <strong style={{ color: 'var(--color-success)' }}>{fb.user_corrected_label}</strong>
                      </td>
                      <td>
                        {fb.status === 'approved_for_training' && (
                          <span className="status-badge approved">Đã Duyệt Train</span>
                        )}
                        {fb.status === 'pending' && (
                          <span className="status-badge pending">Chờ Duyệt</span>
                        )}
                        {fb.status === 'rejected' && (
                          <span className="status-badge rejected">Từ Chối</span>
                        )}
                      </td>
                      <td>
                        <span className="tabular-nums" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {fb.created_at ? new Date(fb.created_at).toLocaleDateString('vi-VN') : 'Mới đây'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div className="action-buttons-cell" style={{ justifyContent: 'center' }}>
                          <button
                            className="btn btn-sm"
                            style={{ backgroundColor: 'var(--color-accent)', color: 'white', padding: '4px 8px', fontSize: '0.75rem' }}
                            onClick={() => handleUpdateFeedbackStatus(fb.id, 'approved_for_training')}
                            title="Phê duyệt đưa vào tập dữ liệu huấn luyện MLOps"
                          >
                            <Check size={14} /> Duyệt
                          </button>
                          <button
                            className="btn btn-sm btn-outline"
                            style={{ padding: '4px 8px', fontSize: '0.75rem', color: 'var(--color-danger)' }}
                            onClick={() => handleUpdateFeedbackStatus(fb.id, 'rejected')}
                            title="Từ chối mẫu này"
                          >
                            <X size={14} />
                          </button>
                          <button
                            className="action-icon-btn delete"
                            onClick={() => handleDeleteFeedback(fb.id)}
                            title="Xóa log"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                      Không có bản ghi phản hồi nào phù hợp.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 6: QUẢN LÝ NGƯỜI DÙNG */}
      {activeSubTab === 'users' && (
        <div className="admin-tab-content">
          <div className="admin-toolbar" style={{ justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Danh Sách Tài Khoản Hệ Thống</h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Quản trị phân quyền Admin và xem chỉ số thể trạng cơ thể ({usersList.length} tài khoản)
              </p>
            </div>
          </div>

          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Tài Khoản</th>
                  <th>Họ Và Tên</th>
                  <th>Vai Trò (Role)</th>
                  <th>BMI / Thể Trạng</th>
                  <th>Calo Mục Tiêu</th>
                  <th>Ngày Đăng Ký</th>
                  <th style={{ width: '160px', textAlign: 'center' }}>Phân Quyền</th>
                </tr>
              </thead>
              <tbody>
                {usersList.map((u) => {
                  const prof = u.profile || {};
                  return (
                    <tr key={u.id}>
                      <td>
                        <strong>{u.email}</strong>
                      </td>
                      <td>{u.full_name}</td>
                      <td>
                        <span className={`user-role-badge ${u.role === 'admin' ? 'admin' : 'user'}`}>
                          {u.role === 'admin' ? 'Quản Trị Viên' : 'Người Dùng'}
                        </span>
                      </td>
                      <td>
                        <span className="tabular-nums">
                          {prof.bmi ? `BMI: ${prof.bmi}` : 'Chưa nhập'}
                        </span>
                      </td>
                      <td>
                        <span className="tabular-nums">
                          {prof.target_calories ? `${prof.target_calories} kcal` : '2000 kcal'}
                        </span>
                      </td>
                      <td className="tabular-nums text-muted" style={{ fontSize: '0.8rem' }}>
                        {u.created_at ? new Date(u.created_at).toLocaleDateString('vi-VN') : 'Ban đầu'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          className={`btn btn-sm ${u.role === 'admin' ? 'btn-outline' : 'btn-primary'}`}
                          style={{ fontSize: '0.78rem' }}
                          onClick={() => handleToggleUserRole(u)}
                        >
                          {u.role === 'admin' ? 'Hạ quyền User' : 'Nâng cấp Admin'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 4. MODALS (THÊM / SỬA MÓN ĂN, NGUYÊN LIỆU, CÔNG THỨC) */}
      {/* ==================================================================== */}

      {/* MODAL MÓN ĂN */}
      {modalType === 'food' && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-dialog">
            <div className="modal-header">
              <h3>{editingItem ? 'Chỉnh Sửa Món Ăn' : 'Thêm Món Ăn Mới'}</h3>
              <button className="modal-close-btn" onClick={() => setModalType(null)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveFood} className="modal-body-form">
              <div className="form-group-grid">
                <div className="form-field">
                  <label>Tên món ăn (Tiếng Việt có dấu)*</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: Phở bò tái chín"
                    value={foodFormData.name}
                    onChange={(e) => setFoodFormData({ ...foodFormData, name: e.target.value })}
                  />
                </div>
                <div className="form-field">
                  <label>Danh mục món*</label>
                  <select
                    value={foodFormData.category}
                    onChange={(e) => setFoodFormData({ ...foodFormData, category: e.target.value })}
                  >
                    <option value="Món chính">Món chính</option>
                    <option value="Món nước">Món nước</option>
                    <option value="Món xào">Món xào</option>
                    <option value="Đồ ăn vặt">Đồ ăn vặt</option>
                    <option value="Đồ uống">Đồ uống</option>
                  </select>
                </div>
              </div>

              <div className="form-field">
                <label>Link ảnh món ăn (URL)</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={foodFormData.image_url}
                  onChange={(e) => setFoodFormData({ ...foodFormData, image_url: e.target.value })}
                />
              </div>

              <div className="form-group-grid">
                <div className="form-field">
                  <label>Nguồn tham chiếu dữ liệu</label>
                  <input
                    type="text"
                    value={foodFormData.source}
                    onChange={(e) => setFoodFormData({ ...foodFormData, source: e.target.value })}
                  />
                </div>
                <div className="form-field">
                  <label>Mô tả ngắn</label>
                  <input
                    type="text"
                    value={foodFormData.description}
                    onChange={(e) => setFoodFormData({ ...foodFormData, description: e.target.value })}
                  />
                </div>
              </div>

              {/* Phần thông số Dinh dưỡng trên 100g */}
              <div className="modal-section-title">Bảng Thành Phần Dinh Dưỡng Chuẩn Trên 100g:</div>
              <div className="form-nutrition-grid">
                <div className="form-field">
                  <label>Calories (kcal)*</label>
                  <input
                    type="number" step="0.1" required
                    value={foodFormData.calories}
                    onChange={(e) => setFoodFormData({ ...foodFormData, calories: e.target.value })}
                  />
                </div>
                <div className="form-field">
                  <label>Đạm (Protein - g)*</label>
                  <input
                    type="number" step="0.1" required
                    value={foodFormData.protein}
                    onChange={(e) => setFoodFormData({ ...foodFormData, protein: e.target.value })}
                  />
                </div>
                <div className="form-field">
                  <label>Bột đường (Carb - g)*</label>
                  <input
                    type="number" step="0.1" required
                    value={foodFormData.carb}
                    onChange={(e) => setFoodFormData({ ...foodFormData, carb: e.target.value })}
                  />
                </div>
                <div className="form-field">
                  <label>Chất béo (Fat - g)*</label>
                  <input
                    type="number" step="0.1" required
                    value={foodFormData.fat}
                    onChange={(e) => setFoodFormData({ ...foodFormData, fat: e.target.value })}
                  />
                </div>
              </div>

              {/* Phần Khẩu phần chuẩn */}
              <div className="modal-section-title">Quy Đổi Khẩu Phần Chuẩn Sang Gram:</div>
              <div className="form-nutrition-grid">
                <div className="form-field">
                  <label>Size Nhỏ (S - gram)</label>
                  <input
                    type="number"
                    value={foodFormData.serving_s_gram}
                    onChange={(e) => setFoodFormData({ ...foodFormData, serving_s_gram: e.target.value })}
                  />
                </div>
                <div className="form-field">
                  <label>Size Vừa (M - gram Mặc định)</label>
                  <input
                    type="number"
                    value={foodFormData.serving_m_gram}
                    onChange={(e) => setFoodFormData({ ...foodFormData, serving_m_gram: e.target.value })}
                  />
                </div>
                <div className="form-field">
                  <label>Size Lớn (L - gram)</label>
                  <input
                    type="number"
                    value={foodFormData.serving_l_gram}
                    onChange={(e) => setFoodFormData({ ...foodFormData, serving_l_gram: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-field">
                <label>Topping ăn kèm (cách nhau bằng dấu phẩy)</label>
                <input
                  type="text"
                  placeholder="+1 Trứng chần, +1 Quẩy giòn, Bỏ nước béo"
                  value={foodFormData.toppings_str}
                  onChange={(e) => setFoodFormData({ ...foodFormData, toppings_str: e.target.value })}
                />
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setModalType(null)}>Hủy</button>
                <button type="submit" className="btn btn-primary">Lưu Món Ăn</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL NGUYÊN LIỆU */}
      {modalType === 'ingredient' && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-dialog" style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h3>{editingItem ? 'Chỉnh Sửa Nguyên Liệu' : 'Thêm Nguyên Liệu Mới'}</h3>
              <button className="modal-close-btn" onClick={() => setModalType(null)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveIng} className="modal-body-form">
              <div className="form-field">
                <label>Tên nguyên liệu*</label>
                <input
                  type="text"
                  required
                  placeholder="VD: Ức gà, Cà chua, Nấm đùi gà..."
                  value={ingFormData.name}
                  onChange={(e) => setIngFormData({ ...ingFormData, name: e.target.value })}
                />
              </div>

              <div className="form-field">
                <label>Nhóm thực phẩm*</label>
                <select
                  value={ingFormData.category}
                  onChange={(e) => setIngFormData({ ...ingFormData, category: e.target.value })}
                >
                  <option value="Thịt cá">Thịt cá</option>
                  <option value="Rau củ">Rau củ</option>
                  <option value="Trứng sữa">Trứng sữa</option>
                  <option value="Gia vị">Gia vị</option>
                  <option value="Tinh bột">Tinh bột</option>
                </select>
              </div>

              <div className="form-field">
                <label>Calo trên 100g (kcal)*</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={ingFormData.calories_per_100g}
                  onChange={(e) => setIngFormData({ ...ingFormData, calories_per_100g: e.target.value })}
                />
              </div>

              <div className="form-field">
                <label>Nhãn cảnh báo dị ứng (nếu có)</label>
                <select
                  value={ingFormData.allergen_tag}
                  onChange={(e) => setIngFormData({ ...ingFormData, allergen_tag: e.target.value })}
                >
                  <option value="">Không chứa dị ứng</option>
                  <option value="seafood">Hải sản (seafood)</option>
                  <option value="peanut">Đậu phộng (peanut)</option>
                  <option value="milk">Sữa / Lactose (milk)</option>
                  <option value="gluten">Gluten / Lúa mì (gluten)</option>
                  <option value="soy">Đậu nành (soy)</option>
                </select>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setModalType(null)}>Hủy</button>
                <button type="submit" className="btn btn-primary">Lưu Nguyên Liệu</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CÔNG THỨC NẤU ĂN */}
      {modalType === 'recipe' && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-dialog">
            <div className="modal-header">
              <h3>{editingItem ? 'Chỉnh Sửa Công Thức' : 'Tạo Công Thức Nấu Ăn Mới'}</h3>
              <button className="modal-close-btn" onClick={() => setModalType(null)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveRecipe} className="modal-body-form">
              <div className="form-field">
                <label>Tiêu đề món ăn*</label>
                <input
                  type="text"
                  required
                  placeholder="VD: Ức gà áp chảo sốt cà chua"
                  value={recipeFormData.title}
                  onChange={(e) => setRecipeFormData({ ...recipeFormData, title: e.target.value })}
                />
              </div>

              <div className="form-field">
                <label>Mô tả công thức</label>
                <textarea
                  rows="2"
                  value={recipeFormData.description}
                  onChange={(e) => setRecipeFormData({ ...recipeFormData, description: e.target.value })}
                />
              </div>

              <div className="form-nutrition-grid">
                <div className="form-field">
                  <label>Chuẩn bị (phút)</label>
                  <input
                    type="number"
                    value={recipeFormData.prep_time_minutes}
                    onChange={(e) => setRecipeFormData({ ...recipeFormData, prep_time_minutes: e.target.value })}
                  />
                </div>
                <div className="form-field">
                  <label>Nấu (phút)</label>
                  <input
                    type="number"
                    value={recipeFormData.cook_time_minutes}
                    onChange={(e) => setRecipeFormData({ ...recipeFormData, cook_time_minutes: e.target.value })}
                  />
                </div>
                <div className="form-field">
                  <label>Tổng Calo (kcal)</label>
                  <input
                    type="number"
                    value={recipeFormData.total_calories}
                    onChange={(e) => setRecipeFormData({ ...recipeFormData, total_calories: e.target.value })}
                  />
                </div>
                <div className="form-field">
                  <label>Khẩu phần (người)</label>
                  <input
                    type="number"
                    value={recipeFormData.servings_yield}
                    onChange={(e) => setRecipeFormData({ ...recipeFormData, servings_yield: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-field">
                <label>Các bước hướng dẫn nấu (Mỗi bước trên 1 dòng)*</label>
                <textarea
                  rows="4"
                  required
                  value={recipeFormData.instructions_text}
                  onChange={(e) => setRecipeFormData({ ...recipeFormData, instructions_text: e.target.value })}
                />
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setModalType(null)}>Hủy</button>
                <button type="submit" className="btn btn-primary">Lưu Công Thức</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CHI TIẾT PHẢN HỒI AI */}
      {modalType === 'feedback_detail' && selectedFeedback && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-dialog" style={{ maxWidth: '560px' }}>
            <div className="modal-header">
              <h3>Chi Tiết Ca Nhận Diện AI #{selectedFeedback.id}</h3>
              <button className="modal-close-btn" onClick={() => setModalType(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body-form">
              {selectedFeedback.original_image_url && (
                <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                  <img 
                    src={selectedFeedback.original_image_url} 
                    alt="Ảnh phản hồi" 
                    style={{ maxHeight: '240px', borderRadius: 'var(--radius-inner)', objectFit: 'cover' }} 
                  />
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div className="admin-kpi-card" style={{ padding: '12px' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>AI Nhận diện:</span>
                  <strong style={{ color: 'var(--color-danger)', fontSize: '1.05rem' }}>{selectedFeedback.predicted_label}</strong>
                  <span style={{ fontSize: '0.75rem' }}>Tin cậy: {Math.round((selectedFeedback.confidence_score || 0.7) * 100)}%</span>
                </div>
                <div className="admin-kpi-card" style={{ padding: '12px' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Người dùng sửa thành:</span>
                  <strong style={{ color: 'var(--color-success)', fontSize: '1.05rem' }}>{selectedFeedback.user_corrected_label}</strong>
                  <span style={{ fontSize: '0.75rem' }}>Ground Truth</span>
                </div>
              </div>

              {selectedFeedback.raw_predictions?.length > 0 && (
                <div>
                  <p style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Top-K AI Predictions:
                  </p>
                  <ul style={{ listStyle: 'none', padding: 0 }}>
                    {selectedFeedback.raw_predictions.map((p, i) => (
                      <li key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', padding: '4px 0', borderBottom: '1px solid var(--border-color)' }}>
                        <span>#{i + 1}. {p.label}</span>
                        <strong className="tabular-nums">{Math.round((p.score || 0) * 100)}%</strong>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="modal-footer" style={{ marginTop: '20px' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => handleUpdateFeedbackStatus(selectedFeedback.id, 'rejected')}
                >
                  Từ chối
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    handleUpdateFeedbackStatus(selectedFeedback.id, 'approved_for_training');
                    setModalType(null);
                  }}
                >
                  <Check size={16} /> Phê Duyệt Train
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
