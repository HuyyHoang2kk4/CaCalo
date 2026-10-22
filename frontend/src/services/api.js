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

export default apiClient;


