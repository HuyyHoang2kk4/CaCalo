/**
 * MỤC ĐÍCH: Thành phần gốc (Root Component) của ứng dụng CaCalo.
 * QUẢN LÝ TRẠNG THÁI: Tab đang chọn, Trạng thái người dùng (Auth), Hồ sơ cá nhân hóa (Profile), Kết nối Backend.
 * BỐ CỤC: Header cố định, Desktop Sidebar, Main Content, Mobile Bottom Navigation, AuthModal.
 */
import React, { useState, useEffect } from 'react';
import Header from './components/layout/Header';
import { BottomNav, DesktopSidebar } from './components/layout/Navigation';
import DashboardTab from './components/dashboard/DashboardTab';
import VisionTab from './components/vision/VisionTab';
import FridgeTab from './components/fridge/FridgeTab';
import ProfileTab from './components/profile/ProfileTab';
import AuthModal from './components/auth/AuthModal';
import { checkHealth, getFoods, getCurrentUser, getUserProfile } from './services/api';

export default function App() {
  // Trạng thái tab đang hoạt động: 'dashboard' | 'vision' | 'fridge' | 'profile'
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Trạng thái kết nối Backend & PostgreSQL
  const [isOnline, setIsOnline] = useState(false);
  const [totalFoods, setTotalFoods] = useState(0);
  const [foodsList, setFoodsList] = useState([]);

  // Trạng thái Người dùng & Hồ sơ cá nhân hóa
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Gọi kiểm tra kết nối Backend và tải dữ liệu người dùng khi ứng dụng khởi chạy
  useEffect(() => {
    let isMounted = true;

    async function initApp() {
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

      // Kiểm tra phiên đăng nhập hiện tại
      const token = localStorage.getItem('cacalo_token');
      if (token) {
        try {
          const authRes = await getCurrentUser();
          if (isMounted && authRes?.success && authRes.user) {
            setCurrentUser(authRes.user);
            setUserProfile(authRes.user.profile);
            return;
          }
        } catch (err) {
          console.warn('Phiên đăng nhập hết hạn hoặc không hợp lệ');
        }
      }

      // Nếu chưa đăng nhập, tải hồ sơ mẫu từ DB để hiển thị giao diện sinh động
      try {
        const profRes = await getUserProfile();
        if (isMounted && profRes?.success && profRes.user) {
          // Lưu profile demo nhưng chưa gán user đăng nhập chính thức
          setUserProfile(profRes.user.profile);
        }
      } catch (err) {
        console.error('Không thể tải profile demo:', err);
      }
    }

    initApp();
    return () => { isMounted = false; };
  }, []);

  const handleAuthSuccess = (user) => {
    setCurrentUser(user);
    setUserProfile(user.profile);
  };

  const handleProfileUpdated = (user) => {
    setCurrentUser(user);
    setUserProfile(user.profile);
  };

  return (
    <div className="app-container">
      {/* 1. Header cố định phía trên */}
      <Header 
        isOnline={isOnline} 
        totalFoods={totalFoods}
        currentUser={currentUser}
        onOpenProfile={() => setActiveTab('profile')}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
      />

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
              userProfile={userProfile}
              onOpenProfile={() => setActiveTab('profile')}
            />
          )}

          {activeTab === 'vision' && (
            <VisionTab foods={foodsList} />
          )}

          {activeTab === 'fridge' && (
            <FridgeTab />
          )}

          {activeTab === 'profile' && (
            <ProfileTab 
              currentUser={currentUser}
              userProfile={userProfile}
              onProfileUpdated={handleProfileUpdated}
              onOpenAuthModal={() => setIsAuthModalOpen(true)}
            />
          )}
        </main>
      </div>

      {/* 3. Thanh điều hướng dưới đáy màn hình trên Mobile */}
      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* 4. Hộp thoại Đăng nhập / Đăng ký */}
      <AuthModal 
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={handleAuthSuccess}
      />
    </div>
  );
}
