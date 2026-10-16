/**
 * MỤC ĐÍCH: Thành phần gốc (Root Component) của ứng dụng CaCalo.
 * QUẢN LÝ TRẠNG THÁI: Tab đang chọn, trạng thái kết nối Backend, dữ liệu món ăn.
 * BỐ CỤC: Header cố định, Desktop Sidebar, Main Content, Mobile Bottom Navigation.
 */
import React, { useState, useEffect } from 'react';
import Header from './components/layout/Header';
import { BottomNav, DesktopSidebar } from './components/layout/Navigation';
import DashboardTab from './components/dashboard/DashboardTab';
import VisionTab from './components/vision/VisionTab';
import FridgeTab from './components/fridge/FridgeTab';
import { checkHealth, getFoods } from './services/api';

export default function App() {
  // Trạng thái tab đang hoạt động: 'dashboard' | 'vision' | 'fridge'
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Trạng thái kết nối Backend & PostgreSQL
  const [isOnline, setIsOnline] = useState(false);
  const [totalFoods, setTotalFoods] = useState(0);
  const [foodsList, setFoodsList] = useState([]);

  // Gọi kiểm tra kết nối Backend khi ứng dụng khởi chạy
  useEffect(() => {
    let isMounted = true;

    async function verifyBackendConnection() {
      try {
        const healthRes = await checkHealth();
        if (isMounted && healthRes.status === 'healthy') {
          setIsOnline(true);
          setTotalFoods(healthRes.total_foods_in_db || 0);
          
          // Lấy danh sách món ăn từ PostgreSQL
          const foodsRes = await getFoods();
          if (isMounted && foodsRes.data) {
            setFoodsList(foodsRes.data);
          }
        }
      } catch (err) {
        if (isMounted) setIsOnline(false);
      }
    }

    verifyBackendConnection();
    return () => { isMounted = false; };
  }, []);

  return (
    <div className="app-container">
      {/* 1. Header cố định phía trên */}
      <Header isOnline={isOnline} totalFoods={totalFoods} />

      {/* 2. Khung thân chính */}
      <div className="main-wrapper">
        {/* Sidebar bên trái trên máy tính */}
        <DesktopSidebar activeTab={activeTab} setActiveTab={setActiveTab} />

        {/* Nội dung trang theo từng tab */}
        <main className="main-content" id="main-content">
          {activeTab === 'dashboard' && (
            <DashboardTab 
              foods={foodsList} 
              onSwitchToScan={() => setActiveTab('vision')} 
            />
          )}

          {activeTab === 'vision' && (
            <VisionTab foods={foodsList} />
          )}

          {activeTab === 'fridge' && (
            <FridgeTab />
          )}
        </main>
      </div>

      {/* 3. Thanh điều hướng dưới đáy màn hình trên Mobile */}
      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}
