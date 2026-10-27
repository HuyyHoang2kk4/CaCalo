/**
 * MỤC ĐÍCH: Thành phần gốc (Root Component) của ứng dụng CaCalo.
 * QUẢN LÝ TRẠNG THÁI: Tab đang chọn, Trạng thái người dùng (Auth), Hồ sơ cá nhân hóa (Profile), Kết nối Backend.
 * BỐ CỤC: Header cố định, Desktop Sidebar, Main Content, Mobile Bottom Navigation, AuthModal.
 */
import React, { useState, useEffect } from 'react';
import { Salad } from 'lucide-react';
import Header from './components/layout/Header';
import { BottomNav, DesktopSidebar } from './components/layout/Navigation';
import DashboardTab from './components/dashboard/DashboardTab';
import VisionTab from './components/vision/VisionTab';
import FridgeTab from './components/fridge/FridgeTab';
import ProfileTab from './components/profile/ProfileTab';
import AdminTab from './components/admin/AdminTab';
import AuthModal from './components/auth/AuthModal';
import LoginPage from './components/auth/LoginPage';
import { checkHealth, getFoods, getCurrentUser } from './services/api';

export default function App() {
  // Hỗ trợ khởi tạo tab từ URL hash (#admin) hoặc tham số truy vấn (?tab=admin)
  const getInitialTab = () => {
    const hash = window.location.hash.replace('#', '');
    if (['dashboard', 'vision', 'fridge', 'profile', 'admin'].includes(hash)) return hash;
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    if (['dashboard', 'vision', 'fridge', 'profile', 'admin'].includes(tabParam)) return tabParam;
    return 'dashboard';
  };

  const [activeTab, setActiveTabState] = useState(getInitialTab);
  
  const setActiveTab = (tab) => {
    setActiveTabState(tab);
    window.location.hash = tab;
  };
  
  // Trạng thái kết nối Backend & PostgreSQL
  const [isOnline, setIsOnline] = useState(false);
  const [totalFoods, setTotalFoods] = useState(0);
  const [foodsList, setFoodsList] = useState([]);

  // Trạng thái Người dùng & Hồ sơ cá nhân hóa (Auth Gate)
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Gọi kiểm tra kết nối Backend và xác thực người dùng khi ứng dụng khởi chạy
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
            setIsAuthChecking(false);
            return;
          }
        } catch (err) {
          console.warn('Phiên đăng nhập hết hạn hoặc không hợp lệ');
          localStorage.removeItem('cacalo_token');
        }
      }

      if (isMounted) {
        setCurrentUser(null);
        setIsAuthChecking(false);
      }
    }

    initApp();
    return () => { isMounted = false; };
  }, []);

  const handleAuthSuccess = async (user) => {
    setCurrentUser(user);
    setUserProfile(user.profile);
    setIsAuthModalOpen(false);

    // Tải danh sách món ăn nếu chưa có
    if (foodsList.length === 0) {
      try {
        const foodsRes = await getFoods();
        if (foodsRes?.data) setFoodsList(foodsRes.data);
      } catch (err) {
        console.error('Lỗi nạp danh sách món ăn:', err);
      }
    }
  };

  const handleProfileUpdated = (user) => {
    setCurrentUser(user);
    setUserProfile(user.profile);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setUserProfile(null);
    setActiveTabState('dashboard');
    window.location.hash = '';
  };

  // Màn hình tải ban đầu
  if (isAuthChecking) {
    return (
      <div className="login-screen-wrapper">
        <div style={{ textAlign: 'center' }}>
          <div className="login-brand-logo">
            <Salad size={32} />
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '12px' }}>
            CaCalo
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Đang khởi tạo ứng dụng...
          </div>
        </div>
      </div>
    );
  }

  // YÊU CẦU 1: Bắt đầu vào phải hiện trang login trước, chỉ sau khi đăng nhập mới vào app
  if (!currentUser) {
    return <LoginPage onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <div className="app-container">
      {/* 1. Header cố định phía trên */}
      <Header 
        currentUser={currentUser}
        onOpenProfile={() => setActiveTab('profile')}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
      />

      {/* 2. Khung thân chính */}
      <div className="main-wrapper">
        {/* Sidebar bên trái trên máy tính */}
        <DesktopSidebar 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          currentUser={currentUser}
        />

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
            <FridgeTab userProfile={userProfile} />
          )}

          {activeTab === 'profile' && (
            <ProfileTab 
              currentUser={currentUser}
              userProfile={userProfile}
              onProfileUpdated={handleProfileUpdated}
              onOpenAuthModal={() => setIsAuthModalOpen(true)}
              onLogout={handleLogout}
            />
          )}

          {activeTab === 'admin' && (
            currentUser?.role === 'admin' ? (
              <AdminTab 
                currentUser={currentUser}
                onSwitchToApp={() => setActiveTab('dashboard')}
              />
            ) : (
              <div className="card" style={{ padding: '48px 24px', textAlign: 'center', maxWidth: '520px', margin: '40px auto' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '8px' }}>Không có quyền truy cập</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '16px' }}>
                  Khu vực Quản trị chỉ dành riêng cho tài khoản Quản trị viên (Admin).
                </p>
                <button className="btn btn-primary" onClick={() => setActiveTab('dashboard')}>
                  Quay lại Dashboard
                </button>
              </div>
            )
          )}
        </main>
      </div>

      {/* 3. Thanh điều hướng dưới đáy màn hình trên Mobile */}
      <BottomNav 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        currentUser={currentUser}
      />

      {/* 4. Hộp thoại Đăng nhập / Đăng ký bổ trợ */}
      <AuthModal 
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={handleAuthSuccess}
      />
    </div>
  );
}
