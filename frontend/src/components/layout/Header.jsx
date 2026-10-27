/**
 * MỤC ĐÍCH: Header cố định phía trên của ứng dụng CaCalo.
 * ĐẦU VÀO: isOnline (boolean), totalFoods (number).
 * ĐẦU RA: Giao diện Header với logo, trạng thái server và hồ sơ người dùng.
 */
import React from 'react';
import { Salad, User as UserIcon, LogIn, ShieldCheck } from 'lucide-react';

export default function Header({ isOnline, totalFoods, currentUser, onOpenProfile, onOpenAuthModal, onOpenAdmin }) {
  const isAdmin = currentUser?.role === 'admin';

  return (
    <header className="app-header">
      <div className="brand-wrapper" onClick={onOpenProfile ? () => {} : undefined} style={{ cursor: 'pointer' }}>
        <div className="brand-logo-icon" aria-hidden="true">
          <Salad size={22} strokeWidth={1.75} />
        </div>
        <div>
          <span className="brand-title">CaCalo</span>
        </div>
        <span className="brand-badge">MVP v1.0</span>
      </div>

      <div className="header-actions">
        {/* Nút truy cập nhanh Quản trị Admin */}
        <button
          id="btn-admin-header"
          className="btn btn-outline"
          onClick={onOpenAdmin}
          title="Mở Bảng Quản Trị Hệ Thống (Module 5)"
          style={{
            borderColor: isAdmin ? 'var(--color-accent)' : 'var(--border-color)',
            backgroundColor: isAdmin ? 'var(--color-accent-light)' : 'transparent',
            color: isAdmin ? 'var(--color-accent)' : 'var(--text-secondary)',
            height: '36px',
            padding: '0 12px',
            fontSize: '0.82rem',
            fontWeight: 600,
            gap: '6px'
          }}
        >
          <ShieldCheck size={16} />
          <span>Quản trị {isAdmin && '⭐'}</span>
        </button>

        {/* Đèn tín hiệu trạng thái kết nối Backend & PostgreSQL */}
        <div className="server-status-badge" title="Trạng thái kết nối Backend FastAPI & PostgreSQL">
          <span className={`status-dot ${isOnline ? 'online' : 'offline'}`} aria-hidden="true"></span>
          <span>{isOnline ? `PostgreSQL: ${totalFoods} món` : 'Đang kết nối...'}</span>
        </div>

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
