/**
 * MỤC ĐÍCH: Header cố định phía trên của ứng dụng CaCalo.
 * ĐẦU VÀO: isOnline (boolean), totalFoods (number).
 * ĐẦU RA: Giao diện Header với logo, trạng thái server và hồ sơ người dùng.
 */
import React from 'react';
import { Salad, LogIn } from 'lucide-react';

export default function Header({ currentUser, onOpenProfile, onOpenAuthModal }) {
  return (
    <header className="app-header">
      <div className="brand-wrapper" onClick={onOpenProfile ? () => {} : undefined} style={{ cursor: 'pointer' }}>
        <div className="brand-logo-icon" aria-hidden="true">
          <Salad size={22} strokeWidth={1.75} />
        </div>
        <div>
          <span className="brand-title">CaCalo</span>
        </div>
      </div>

      <div className="header-actions">
        {/* Nút người dùng / Đăng nhập */}
        {currentUser ? (
          <button 
            className="btn btn-outline header-user-btn" 
            onClick={onOpenProfile}
            aria-label="Hồ sơ cá nhân hóa"
            title={`Tài khoản: ${currentUser.full_name} (${currentUser.email})`}
          >
            <div className="user-avatar-mini">
              {currentUser.full_name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <span className="header-user-name">{currentUser.full_name?.split(' ').slice(-1)[0] || 'User'}</span>
          </button>
        ) : (
          <button 
            className="btn btn-primary header-login-btn" 
            onClick={onOpenAuthModal}
            aria-label="Đăng nhập hoặc Đăng ký"
          >
            <LogIn size={16} strokeWidth={2} />
            <span>Đăng nhập</span>
          </button>
        )}
      </div>
    </header>
  );
}
