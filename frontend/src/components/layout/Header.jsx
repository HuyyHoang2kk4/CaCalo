/**
 * MỤC ĐÍCH: Header cố định phía trên của ứng dụng CaCalo.
 * TÍNH NĂNG MỚI:
 * - Logo CaCalo thanh lịch, không rườm rà.
 * - Avatar góc phải mở Menu Dropdown thông minh:
 *   + Thông tin tài khoản & Vai trò (Admin / Thành viên / Khách)
 *   + Nút Đăng nhập / Đăng ký (nếu chưa đăng nhập)
 *   + Cài đặt giao diện: Chuyển đổi Sáng (Light) / Tối (Dark mode)
 *   + Nút Đăng xuất (nếu đã đăng nhập)
 */
import React, { useState, useRef, useEffect } from 'react';
import { 
  Salad, User as UserIcon, LogIn, LogOut, ShieldCheck, 
  Sun, Moon, ChevronDown, Check, Settings 
} from 'lucide-react';

export default function Header({ 
  currentUser, 
  onOpenProfile, 
  onOpenAuthModal, 
  onOpenAdmin, 
  onLogout,
  theme = 'light',
  onToggleTheme 
}) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const isAdmin = currentUser?.role === 'admin';

  // Tự động đóng dropdown khi bấm ra ngoài
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleDropdownSelect = (action) => {
    setIsDropdownOpen(false);
    if (action) action();
  };

  return (
    <header className="app-header">
      {/* Brand logo */}
      <div 
        className="brand-wrapper" 
        onClick={onOpenProfile ? () => {} : undefined} 
        style={{ cursor: 'pointer' }}
      >
        <div className="brand-logo-icon" aria-hidden="true">
          <Salad size={22} strokeWidth={1.75} />
        </div>
        <div>
          <span className="brand-title">CaCalo</span>
        </div>
      </div>

      {/* Header Actions: Avatar Menu Dropdown */}
      <div className="header-actions" ref={dropdownRef}>
        <div className="user-dropdown-container">
          <button
            id="btn-header-avatar"
            className={`header-user-btn ${isDropdownOpen ? 'active' : ''}`}
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            aria-expanded={isDropdownOpen}
            aria-label="Menu tài khoản và cài đặt"
          >
            {currentUser ? (
              <>
                <div className="user-avatar-mini">
                  {currentUser.full_name?.charAt(0)?.toUpperCase() || 'U'}
                </div>
                <span className="header-user-name">
                  {currentUser.full_name?.split(' ').slice(-1)[0] || 'User'}
                </span>
              </>
            ) : (
              <>
                <div className="user-avatar-mini" style={{ background: 'var(--text-muted)' }}>
                  <UserIcon size={14} />
                </div>
                <span className="header-user-name" style={{ color: 'var(--text-secondary)' }}>
                  Khách
                </span>
              </>
            )}
            <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
          </button>

          {/* Hộp Dropdown Menu khi bấm vào Avatar */}
          {isDropdownOpen && (
            <div className="user-dropdown-menu" role="menu">
              {/* Header của Dropdown */}
              <div className="dropdown-user-header">
                <div 
                  className="user-avatar-mini" 
                  style={{ 
                    width: '36px', 
                    height: '36px', 
                    fontSize: '1rem',
                    background: currentUser ? 'linear-gradient(135deg, #059669, #10B981)' : 'var(--text-muted)'
                  }}
                >
                  {currentUser ? (currentUser.full_name?.charAt(0)?.toUpperCase() || 'U') : <UserIcon size={18} />}
                </div>
                <div className="dropdown-user-info">
                  <span className="dropdown-user-name">
                    {currentUser ? currentUser.full_name : 'Khách trải nghiệm'}
                  </span>
                  <span className="dropdown-user-email">
                    {currentUser ? currentUser.email : 'Chưa đăng nhập'}
                  </span>
                  <span style={{ marginTop: '2px' }}>
                    <span 
                      style={{ 
                        fontSize: '0.68rem', 
                        fontWeight: 700, 
                        padding: '1px 6px', 
                        borderRadius: '4px',
                        backgroundColor: isAdmin ? 'var(--color-accent-light)' : 'var(--bg-surface-hover)',
                        color: isAdmin ? 'var(--color-accent)' : 'var(--text-secondary)'
                      }}
                    >
                      {isAdmin ? 'Quản trị viên' : (currentUser ? 'Thành viên' : 'Dùng thử')}
                    </span>
                  </span>
                </div>
              </div>

              {/* Nhóm Menu Chức năng */}
              {currentUser ? (
                <>
                  <button 
                    type="button" 
                    className="dropdown-item" 
                    onClick={() => handleDropdownSelect(onOpenProfile)}
                  >
                    <UserIcon size={16} />
                    <span>Hồ sơ cá nhân hóa</span>
                  </button>

                  {isAdmin && (
                    <button 
                      type="button" 
                      className="dropdown-item" 
                      onClick={() => handleDropdownSelect(onOpenAdmin)}
                    >
                      <ShieldCheck size={16} color="var(--color-accent)" />
                      <span>Bảng Quản trị Admin</span>
                    </button>
                  )}
                </>
              ) : (
                <button 
                  type="button" 
                  className="dropdown-item" 
                  style={{ color: 'var(--color-accent)', fontWeight: 600 }}
                  onClick={() => handleDropdownSelect(onOpenAuthModal)}
                >
                  <LogIn size={16} />
                  <span>Đăng nhập / Đăng ký ngay</span>
                </button>
              )}

              <div className="dropdown-divider"></div>

              {/* Cài đặt Giao diện Sáng / Tối (Theme Mode) */}
              <div className="dropdown-theme-section">
                <span style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Settings size={14} />
                  <span>Giao diện</span>
                </span>
                <div className="theme-toggle-pill">
                  <button
                    type="button"
                    className={`theme-btn ${theme === 'light' ? 'active' : ''}`}
                    onClick={() => onToggleTheme && onToggleTheme('light')}
                    title="Chế độ Sáng"
                  >
                    <Sun size={13} />
                    <span>Sáng</span>
                  </button>
                  <button
                    type="button"
                    className={`theme-btn ${theme === 'dark' ? 'active' : ''}`}
                    onClick={() => onToggleTheme && onToggleTheme('dark')}
                    title="Chế độ Tối"
                  >
                    <Moon size={13} />
                    <span>Tối</span>
                  </button>
                </div>
              </div>

              {/* Nút Đăng xuất (chỉ hiện khi đã đăng nhập) */}
              {currentUser && (
                <>
                  <div className="dropdown-divider"></div>
                  <button 
                    type="button" 
                    className="dropdown-item danger" 
                    onClick={() => handleDropdownSelect(onLogout)}
                  >
                    <LogOut size={16} />
                    <span>Đăng xuất tài khoản</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
