/**
 * MỤC ĐÍCH: Header cố định phía trên của ứng dụng CaCalo.
 * ĐẦU VÀO: isOnline (boolean), totalFoods (number).
 * ĐẦU RA: Giao diện Header với logo, trạng thái server và hồ sơ người dùng.
 */
import React from 'react';
import { Salad, User as UserIcon } from 'lucide-react';

export default function Header({ isOnline, totalFoods }) {
  return (
    <header className="app-header">
      <div className="brand-wrapper">
        <div className="brand-logo-icon" aria-hidden="true">
          <Salad size={22} strokeWidth={1.75} />
        </div>
        <div>
          <span className="brand-title">CaCalo</span>
        </div>
        <span className="brand-badge">MVP v1.0</span>
      </div>

      <div className="header-actions">
        {/* Đèn tín hiệu trạng thái kết nối Backend & PostgreSQL */}
        <div className="server-status-badge" title="Trạng thái kết nối Backend FastAPI & PostgreSQL">
          <span className={`status-dot ${isOnline ? 'online' : 'offline'}`} aria-hidden="true"></span>
          <span>{isOnline ? `PostgreSQL: ${totalFoods} món` : 'Đang kết nối...'}</span>
        </div>

        {/* Nút người dùng */}
        <button className="btn btn-outline" style={{ width: '40px', padding: 0 }} aria-label="Hồ sơ người dùng">
          <UserIcon size={18} strokeWidth={1.75} />
        </button>
      </div>
    </header>
  );
}
