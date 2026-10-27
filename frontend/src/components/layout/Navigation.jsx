/**
 * MỤC ĐÍCH: Điều hướng ứng dụng gồm Sidebar cho Desktop và Bottom Navigation cho Mobile.
 * ĐẦU VÀO: activeTab (string), setActiveTab (function).
 * ĐẦU RA: Giao diện chuyển đổi tab mượt mà.
 */
import React from 'react';
import { LayoutDashboard, Camera, History, User, ShieldCheck } from 'lucide-react';

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'vision', label: 'Quét món ăn', icon: Camera },
  { id: 'history', label: 'Lịch sử & Thống kê', icon: History },
  { id: 'profile', label: 'Cá nhân hóa', icon: User },
];

export function BottomNav({ activeTab, setActiveTab, currentUser }) {
  const isAdmin = currentUser?.role === 'admin';
  const allItems = [
    ...navItems,
    ...(isAdmin ? [{ id: 'admin', label: 'Quản trị', icon: ShieldCheck }] : [])
  ];

  return (
    <nav className="bottom-nav" aria-label="Điều hướng chính trên điện thoại">
      {allItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            className={`nav-item ${isActive ? 'active' : ''}`}
            onClick={() => setActiveTab(item.id)}
            aria-label={item.label}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon size={20} strokeWidth={isActive ? 2 : 1.75} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export function DesktopSidebar({ activeTab, setActiveTab, currentUser }) {
  const isAdmin = currentUser?.role === 'admin';

  return (
    <aside className="desktop-sidebar" aria-label="Thanh điều hướng bên trái">
      <div style={{ marginBottom: '16px', paddingLeft: '8px' }}>
        <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Menu chính
        </p>
      </div>

      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            className={`sidebar-link ${isActive ? 'active' : ''}`}
            onClick={() => setActiveTab(item.id)}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon size={20} strokeWidth={isActive ? 2 : 1.75} />
            <span>{item.label}</span>
          </button>
        );
      })}

      {/* Chỉ hiển thị Phân mục Quản trị hệ thống nếu người dùng có role admin */}
      {isAdmin && (
        <>
          <div style={{ marginTop: '24px', marginBottom: '12px', paddingLeft: '8px' }}>
            <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Hệ thống
            </p>
          </div>

          <button
            id="btn-admin-sidebar"
            className={`sidebar-link ${activeTab === 'admin' ? 'active' : ''}`}
            onClick={() => setActiveTab('admin')}
            aria-current={activeTab === 'admin' ? 'page' : undefined}
            style={{
              borderLeftColor: activeTab === 'admin' ? 'var(--color-accent)' : 'transparent',
              position: 'relative'
            }}
          >
            <ShieldCheck size={20} strokeWidth={activeTab === 'admin' ? 2 : 1.75} color={activeTab === 'admin' ? 'var(--color-accent)' : undefined} />
            <span>Quản trị Admin</span>
          </button>
        </>
      )}
    </aside>
  );
}
