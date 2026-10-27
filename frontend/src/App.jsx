/**
 * MỤC ĐÍCH: Thành phần gốc (Root Component) của ứng dụng CaCalo.
 * QUẢN LÝ TRẠNG THÁI: Tab đang chọn, Trạng thái người dùng (Auth), Giao diện Sáng/Tối (Theme), Kết nối Backend.
 * CHẾ ĐỘ TRẢI NGHIỆM:
 * - Khách chưa đăng nhập: Được tự do sử dụng tính năng "Quét món ăn AI" để trải nghiệm.
 * - Các tính năng cá nhân hóa (Dashboard, Tủ lạnh, Hồ sơ cá nhân): Khóa và yêu cầu đăng nhập.
 * - Header thông minh: Avatar dropdown hỗ trợ Đăng nhập, Đăng xuất và đổi giao diện Sáng / Tối.
 */
import React, { useState, useEffect } from 'react';
import { Salad, Flame, History, User as UserIcon } from 'lucide-react';
import Header from './components/layout/Header';
import { BottomNav, DesktopSidebar } from './components/layout/Navigation';
import DashboardTab from './components/dashboard/DashboardTab';
import VisionTab from './components/vision/VisionTab';
import HistoryTab from './components/history/HistoryTab';
import ProfileTab from './components/profile/ProfileTab';
import AdminTab from './components/admin/AdminTab';
import AuthModal from './components/auth/AuthModal';
import LockedFeatureView from './components/common/LockedFeatureView';
import { checkHealth, getFoods, getCurrentUser } from './services/api';

export default function App() {
  // 1. Quản lý Theme Sáng / Tối (Light / Dark mode)
  const [theme, setTheme] = useState(() => localStorage.getItem('cacalo_theme') || 'light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('cacalo_theme', theme);
  }, [theme]);

  // 2. Trạng thái Người dùng & Hồ sơ cá nhân hóa
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // 3. Tab đang chọn: Khách chưa đăng nhập mặc định vào tab 'vision' (Quét món ăn)
  const getInitialTab = () => {
    const hash = window.location.hash.replace('#', '');
    if (['dashboard', 'vision', 'history', 'profile', 'admin'].includes(hash)) return hash;
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    if (['dashboard', 'vision', 'history', 'profile', 'admin'].includes(tabParam)) return tabParam;
    return 'vision'; // Mặc định mở Quét món ăn để khách trải nghiệm ngay
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
            // Nếu người dùng đã đăng nhập và chưa chọn tab qua hash, chuyển sang Dashboard
            if (!window.location.hash) {
              setActiveTabState('dashboard');
            }
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
    localStorage.removeItem('cacalo_token');
    setCurrentUser(null);
    setUserProfile(null);
    setActiveTabState('vision');
    window.location.hash = 'vision';
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

  return (
    <div className="app-container">
      {/* 1. Header cố định phía trên: chứa Logo và Menu Avatar (Đăng nhập, Sáng/Tối, Đăng xuất) */}
      <Header 
        currentUser={currentUser}
        theme={theme}
        onToggleTheme={(newTheme) => setTheme(newTheme)}
        onOpenProfile={() => setActiveTab('profile')}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onOpenAdmin={() => setActiveTab('admin')}
        onLogout={handleLogout}
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
          {/* TAB 1: DASHBOARD (Yêu cầu đăng nhập để xem số liệu cá nhân) */}
          {activeTab === 'dashboard' && (
            currentUser ? (
              <DashboardTab 
                foods={foodsList} 
                onSwitchToScan={() => setActiveTab('vision')}
                userProfile={userProfile}
                onOpenProfile={() => setActiveTab('profile')}
              />
            ) : (
              <LockedFeatureView 
                featureName="Dashboard Dinh Dưỡng Cá Nhân"
                description="Đăng nhập tài khoản để tự động theo dõi lượng calo nạp vào hàng ngày, tỉ lệ Đạm / Đường / Chất béo và lưu lại lịch sử các bữa ăn của bạn."
                icon={Flame}
                onOpenAuth={() => setIsAuthModalOpen(true)}
                onSwitchToVision={() => setActiveTab('vision')}
              />
            )
          )}

          {/* TAB 2: QUÉT MÓN ĂN (Miễn phí & Tự do sử dụng không cần đăng nhập) */}
          {activeTab === 'vision' && (
            <VisionTab 
              foods={foodsList} 
              currentUser={currentUser}
              onOpenAuthModal={() => setIsAuthModalOpen(true)}
            />
          )}

          {/* TAB 3: LỊCH SỬ BỮA ĂN & THỐNG KÊ DINH DƯỠNG (Dành riêng cho từng tài khoản) */}
          {activeTab === 'history' && (
            currentUser ? (
              <HistoryTab 
                currentUser={currentUser} 
                userProfile={userProfile} 
                onSwitchToVision={() => setActiveTab('vision')}
              />
            ) : (
              <LockedFeatureView 
                featureName="Lịch Sử Bữa Ăn & Thống Kê Dinh Dưỡng"
                description="Đăng nhập để theo dõi lịch sử bữa ăn thực tế theo ngày & giờ, kèm bảng thống kê calo và dinh dưỡng cá nhân hóa của riêng bạn."
                icon={History}
                onOpenAuth={() => setIsAuthModalOpen(true)}
                onSwitchToVision={() => setActiveTab('vision')}
              />
            )
          )}

          {/* TAB 4: HỒ SƠ & CÁ NHÂN HÓA (Yêu cầu đăng nhập) */}
          {activeTab === 'profile' && (
            currentUser ? (
              <ProfileTab 
                currentUser={currentUser}
                userProfile={userProfile}
                onProfileUpdated={handleProfileUpdated}
                onOpenAuthModal={() => setIsAuthModalOpen(true)}
                onLogout={handleLogout}
              />
            ) : (
              <LockedFeatureView 
                featureName="Hồ Sơ & Cá Nhân Hóa Dinh Dưỡng"
                description="Đăng nhập để tính toán chỉ số thể trạng chuẩn Mifflin-St Jeor (BMI, BMR, TDEE), đặt mục tiêu giảm/tăng cân và lưu danh sách dị ứng thực phẩm."
                icon={UserIcon}
                onOpenAuth={() => setIsAuthModalOpen(true)}
                onSwitchToVision={() => setActiveTab('vision')}
              />
            )
          )}

          {/* TAB 5: QUẢN TRỊ ADMIN (Chỉ dành riêng cho tài khoản role admin) */}
          {activeTab === 'admin' && (
            currentUser?.role === 'admin' ? (
              <AdminTab 
                currentUser={currentUser}
                onSwitchToApp={() => setActiveTab('dashboard')}
              />
            ) : (
              <LockedFeatureView 
                featureName="Khu Vực Quản Trị Hệ Thống"
                description="Khu vực này chỉ dành riêng cho tài khoản Quản trị viên (Admin) để kiểm duyệt dữ liệu món ăn, công thức nấu ăn và MLOps AI."
                icon={Salad}
                onOpenAuth={() => setIsAuthModalOpen(true)}
                onSwitchToVision={() => setActiveTab('vision')}
              />
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

      {/* 4. Hộp thoại Đăng nhập / Đăng ký tiêu chuẩn */}
      <AuthModal 
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={handleAuthSuccess}
      />
    </div>
  );
}
