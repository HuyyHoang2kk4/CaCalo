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

export default apiClient;
