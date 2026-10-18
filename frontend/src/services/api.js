/**
 * MỤC ĐÍCH: Axios Client tập trung để giao tiếp với Backend FastAPI.
 * ĐẦU VÀO: Các request cấu hình URL và body.
 * ĐẦU RA: Dữ liệu JSON hoặc xử lý lỗi bắt gọn trong interceptor.
 * LƯU Ý KỸ THUẬT: Sử dụng baseURL tương đối '/api' để tự động đi qua Vite proxy sang port 8000.
 */
import axios from 'axios';

const apiClient = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
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
    return await apiClient.post('/feedback/ai', feedbackData);
  } catch (error) {
    console.error('Lỗi gửi feedback AI:', error);
    throw error;
  }
};

export default apiClient;

