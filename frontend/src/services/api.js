/**
 * MỤC ĐÍCH: Axios Client tập trung để giao tiếp với Backend FastAPI.
 * ĐẦU VÀO: Các request cấu hình URL và body.
 * ĐẦU RA: Dữ liệu JSON hoặc xử lý lỗi bắt gọn trong interceptor.
 * LƯU Ý KỸ THUẬT: Sử dụng baseURL tương đối '/api' để tự động đi qua Vite proxy sang port 8000.
 */
import axios from 'axios';

const apiClient = axios.create({
  baseURL: '/api',
  timeout: 25000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Tự động gắn Bearer Token nếu người dùng đã đăng nhập
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('cacalo_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor bắt lỗi toàn cục
apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    console.error('[API_ERROR] Lỗi gọi Backend:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

/**
 * MỤC ĐÍCH: Kiểm tra trạng thái máy chủ Backend và kết nối Database.
 * ĐẦU RA: { status: 'healthy', database: 'connected', total_foods_in_db: 10 }
 */
export const checkHealth = async () => {
  try {
    return await apiClient.get('/health');
  } catch (error) {
    return { status: 'error', database: 'disconnected', message: 'Không thể kết nối Backend' };
  }
};

/**
 * MỤC ĐÍCH: Lấy danh sách món ăn chuẩn từ PostgreSQL qua Backend API.
 */
export const getFoods = async () => {
  try {
    return await apiClient.get('/foods');
  } catch (error) {
    console.error('Không thể lấy danh sách món ăn:', error);
    return { total: 0, data: [] };
  }
};

/**
 * MỤC ĐÍCH: Lưu bữa ăn vào PostgreSQL (bảng meal_logs & meal_log_items).
 */
export const createMealLog = async (mealData) => {
  try {
    return await apiClient.post('/meal-logs', mealData);
  } catch (error) {
    console.error('Lỗi lưu nhật ký bữa ăn:', error);
    throw error;
  }
};

/**
 * MỤC ĐÍCH: Lấy dữ liệu các bữa ăn hôm nay hiển thị lên Dashboard.
 */
export const getTodayMealLogs = async () => {
  try {
    return await apiClient.get('/meal-logs/today');
  } catch (error) {
    console.error('Lỗi lấy nhật ký hôm nay:', error);
    return { total_calories: 0, total_protein: 0, total_carb: 0, total_fat: 0, items: [] };
  }
};

/**
 * MỤC ĐÍCH: Lấy toàn bộ lịch sử bữa ăn thực tế (real) của riêng tài khoản người dùng theo ngày và giờ.
 */
export const getMealHistory = async (params = {}) => {
  try {
    return await apiClient.get('/meal-logs/history', { params });
  } catch (error) {
    console.error('Lỗi lấy lịch sử bữa ăn:', error);
    throw error;
  }
};

/**
 * MỤC ĐÍCH: Xóa một bản ghi bữa ăn khỏi nhật ký cá nhân.
 */
export const deleteMealLog = async (logId) => {
  try {
    return await apiClient.delete(`/meal-logs/${logId}`);
  } catch (error) {
    console.error('Lỗi xóa bữa ăn:', error);
    throw error;
  }
};

/**
 * MỤC ĐÍCH: Cập nhật bản ghi bữa ăn trong nhật ký cá nhân (loại bữa, danh sách món, gram, calo, macro).
 */
export const updateMealLog = async (logId, mealData) => {
  try {
    return await apiClient.put(`/meal-logs/${logId}`, mealData);
  } catch (error) {
    console.error('Lỗi cập nhật bữa ăn:', error);
    throw error;
  }
};

/**
 * MỤC ĐÍCH: Lấy thống kê dinh dưỡng cá nhân hóa tổng hợp của tài khoản.
 */
export const getMealStatistics = async () => {
  try {
    return await apiClient.get('/meal-logs/statistics');
  } catch (error) {
    console.error('Lỗi lấy thống kê dinh dưỡng:', error);
    throw error;
  }
};

/**
 * MỤC ĐÍCH: Gửi phản hồi người dùng sửa lỗi AI vào PostgreSQL (bảng ai_feedback_logs).
 */
export const submitAIFeedback = async (feedbackData) => {
  try {
    return await apiClient.post('/vision/feedback', feedbackData);
  } catch (error) {
    console.error('Lỗi gửi feedback AI:', error);
    throw error;
  }
};

/**
 * MỤC ĐÍCH: Gửi tệp ảnh món ăn lên Backend FastAPI để nhận diện AI qua Computer Vision.
 * ĐẦU VÀO: File hoặc Blob ảnh
 * ĐẦU RA: { success: true, confidence_tier: 'high'|'medium'|'low', candidates: [...] }
 */
export const predictFoodImage = async (fileOrBlob) => {
  try {
    const formData = new FormData();
    formData.append('file', fileOrBlob, 'food_capture.jpg');
    return await apiClient.post('/vision/predict', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 60000, // Tăng lên 60s cho tác vụ Vision AI nặng
    });
  } catch (error) {
    console.error('Lỗi nhận diện ảnh:', error);
    throw error;
  }
};

/**
 * MỤC ĐÍCH: Tính toán số học Calo và Macro chuẩn xác từ PostgreSQL.
 * ĐẦU VÀO: { food_id, portion_size, custom_gram, topping_ids }
 */
export const calculateNutrition = async (params) => {
  try {
    return await apiClient.post('/nutrition/calculate', params);
  } catch (error) {
    console.error('Lỗi tính toán dinh dưỡng:', error);
    throw error;
  }
};

/**
 * MỤC ĐÍCH: Tìm kiếm nhanh món ăn trong PostgreSQL theo từ khóa.
 */
export const searchFoods = async (keyword) => {
  try {
    return await apiClient.get('/foods/search', { params: { q: keyword } });
  } catch (error) {
    console.error('Lỗi tìm kiếm món ăn:', error);
    return { query: keyword, total: 0, data: [] };
  }
};

/**
 * MỤC ĐÍCH: Đăng nhập tài khoản người dùng.
 * ĐẦU VÀO: { email, password }
 */
export const loginUser = async (credentials) => {
  try {
    const res = await apiClient.post('/auth/login', credentials);
    if (res.token) {
      localStorage.setItem('cacalo_token', res.token);
    }
    return res;
  } catch (error) {
    const msg = error.response?.data?.detail || 'Đăng nhập không thành công';
    throw new Error(msg);
  }
};

/**
 * MỤC ĐÍCH: Đăng ký tài khoản người dùng mới kèm hồ sơ dinh dưỡng ban đầu.
 */
export const registerUser = async (userData) => {
  try {
    const res = await apiClient.post('/auth/register', userData);
    if (res.token) {
      localStorage.setItem('cacalo_token', res.token);
    }
    return res;
  } catch (error) {
    const msg = error.response?.data?.detail || 'Đăng ký không thành công';
    throw new Error(msg);
  }
};

/**
 * MỤC ĐÍCH: Lấy thông tin người dùng đang đăng nhập từ token.
 */
export const getCurrentUser = async () => {
  try {
    return await apiClient.get('/auth/me');
  } catch (error) {
    return null;
  }
};

/**
 * MỤC ĐÍCH: Lấy hồ sơ thể trạng và mục tiêu calo (có fallback tài khoản demo).
 */
export const getUserProfile = async () => {
  try {
    return await apiClient.get('/user/profile');
  } catch (error) {
    console.error('Lỗi lấy hồ sơ người dùng:', error);
    return null;
  }
};

/**
 * MỤC ĐÍCH: Cập nhật hồ sơ thể trạng và tự động tính lại BMI, BMR, TDEE, Calo mục tiêu.
 */
export const updateUserProfile = async (profileData) => {
  try {
    return await apiClient.put('/user/profile', profileData);
  } catch (error) {
    const msg = error.response?.data?.detail || 'Cập nhật hồ sơ thất bại';
    throw new Error(msg);
  }
};

/**
 * MỤC ĐÍCH: Đăng xuất người dùng.
 */
export const logoutUser = () => {
  localStorage.removeItem('cacalo_token');
};

/**
 * MỤC ĐÍCH: Gửi tin nhắn đến Chatbot AI (CC-3.4) theo kiến trúc RAG.
 * AI được inject context từ DB: hồ sơ người dùng, danh sách món ăn, nhật ký hôm nay.
 * AI chỉ diễn đạt — số liệu luôn từ DB (AI Guardrails).
 * ĐẦU VÀO: { message: string, history: [{role, content}] }
 * ĐẦU RA: { success, reply, intent, ai_source, data }
 */
export const chatWithAI = async (message, history = []) => {
  try {
    return await apiClient.post('/chatbot', { message, history });
  } catch (error) {
    console.error('Lỗi gọi Chatbot AI:', error);
    return {
      success: false,
      reply: 'Xin lỗi, Trợ lý AI tạm thời không phản hồi. Vui lòng thử lại sau.',
      intent: 'error',
    };
  }
};

/**
 * MỤC ĐÍCH: Đánh giá cân đối dinh dưỡng bữa ăn — hoàn toàn deterministic, không AI.
 * ĐẦU VÀO: { calories, protein_g, carb_g, fat_g, target_calories? }
 * ĐẦU RA: { success, evaluation: { pct_protein, pct_carb, pct_fat, notes, ... } }
 */
export const evaluateMeal = async (mealData) => {
  try {
    return await apiClient.post('/nutrition/evaluate', mealData);
  } catch (error) {
    console.error('Lỗi đánh giá dinh dưỡng:', error);
    return { success: false, evaluation: null };
  }
};

// ==============================================================================
// PUBLIC INGREDIENTS & RECIPES
// ==============================================================================

export const getIngredients = async (category = null, search = null) => {
  try {
    return await apiClient.get('/ingredients', { params: { category, search } });
  } catch (error) {
    console.error('Lỗi lấy danh sách nguyên liệu:', error);
    return { total: 0, data: [] };
  }
};

export const getRecipes = async (search = null) => {
  try {
    return await apiClient.get('/recipes', { params: { search } });
  } catch (error) {
    console.error('Lỗi lấy danh sách công thức nấu ăn:', error);
    return { total: 0, data: [] };
  }
};

export const getRecipeDetail = async (id) => {
  try {
    return await apiClient.get(`/recipes/${id}`);
  } catch (error) {
    console.error('Lỗi lấy chi tiết công thức nấu:', error);
    throw error;
  }
};

// ==============================================================================
// MODULE 5: QUẢN TRỊ ADMIN (CC-5.1, CC-5.2, CC-5.3)
// ==============================================================================

/**
 * Lấy số liệu thống kê KPI tổng quan hệ thống cho Admin Dashboard.
 */
export const getAdminOverview = async () => {
  try {
    return await apiClient.get('/admin/overview');
  } catch (error) {
    console.error('Lỗi lấy tổng quan Admin:', error);
    throw error;
  }
};

/**
 * Quản trị Món ăn (CC-5.1)
 */
export const getAdminFoods = async (search = '', category = 'all') => {
  try {
    return await apiClient.get('/admin/foods', { params: { search, category } });
  } catch (error) {
    console.error('Lỗi lấy danh sách món ăn cho admin:', error);
    throw error;
  }
};

export const createAdminFood = async (foodData) => {
  return await apiClient.post('/admin/foods', foodData);
};

export const updateAdminFood = async (id, foodData) => {
  return await apiClient.put(`/admin/foods/${id}`, foodData);
};

export const deleteAdminFood = async (id) => {
  return await apiClient.delete(`/admin/foods/${id}`);
};

/**
 * Quản trị Nguyên liệu (CC-5.1)
 */
export const getAdminIngredients = async (category = 'all', search = '') => {
  try {
    return await apiClient.get('/admin/ingredients', { params: { category, search } });
  } catch (error) {
    console.error('Lỗi lấy nguyên liệu cho admin:', error);
    throw error;
  }
};

export const createAdminIngredient = async (ingData) => {
  return await apiClient.post('/admin/ingredients', ingData);
};

export const updateAdminIngredient = async (id, ingData) => {
  return await apiClient.put(`/admin/ingredients/${id}`, ingData);
};

export const deleteAdminIngredient = async (id) => {
  return await apiClient.delete(`/admin/ingredients/${id}`);
};

/**
 * Quản trị Công thức nấu ăn (CC-5.2)
 */
export const getAdminRecipes = async (search = '') => {
  try {
    return await apiClient.get('/admin/recipes', { params: { search } });
  } catch (error) {
    console.error('Lỗi lấy công thức cho admin:', error);
    throw error;
  }
};

export const createAdminRecipe = async (recipeData) => {
  return await apiClient.post('/admin/recipes', recipeData);
};

export const updateAdminRecipe = async (id, recipeData) => {
  return await apiClient.put(`/admin/recipes/${id}`, recipeData);
};

export const deleteAdminRecipe = async (id) => {
  return await apiClient.delete(`/admin/recipes/${id}`);
};

/**
 * Kiểm duyệt phản hồi AI & MLOps Pipeline (CC-5.3)
 */
export const getAdminFeedbacks = async (status = 'all') => {
  try {
    return await apiClient.get('/admin/feedbacks', { params: { status } });
  } catch (error) {
    console.error('Lỗi lấy danh sách phản hồi AI:', error);
    throw error;
  }
};

export const updateAdminFeedbackStatus = async (id, status) => {
  return await apiClient.put(`/admin/feedbacks/${id}/status`, { status });
};

export const deleteAdminFeedback = async (id) => {
  return await apiClient.delete(`/admin/feedbacks/${id}`);
};

export const exportAdminFeedbacksDataset = async () => {
  return await apiClient.get('/admin/feedbacks/export');
};

export const seedAdminSampleFeedbacks = async () => {
  return await apiClient.post('/admin/seed-sample-feedbacks');
};

/**
 * Quản trị Người dùng & Phân quyền
 */
export const getAdminUsers = async () => {
  try {
    return await apiClient.get('/admin/users');
  } catch (error) {
    console.error('Lỗi lấy danh sách người dùng:', error);
    throw error;
  }
};

export const updateAdminUserRole = async (userId, role) => {
  return await apiClient.put(`/admin/users/${userId}/role`, { role });
};

export default apiClient;
