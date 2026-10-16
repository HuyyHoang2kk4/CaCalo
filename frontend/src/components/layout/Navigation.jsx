/**
 * MỤC ĐÍCH: Điều hướng ứng dụng gồm Sidebar cho Desktop và Bottom Navigation cho Mobile.
 * ĐẦU VÀO: activeTab (string), setActiveTab (function).
 * ĐẦU RA: Giao diện chuyển đổi tab mượt mà.
 */
import React from 'react';
import { LayoutDashboard, Camera, Refrigerator } from 'lucide-react';

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'vision', label: 'Quét món ăn', icon: Camera },
  { id: 'fridge', label: 'Tủ lạnh & Gợi ý', icon: Refrigerator },
];

export function BottomNav({ activeTab, setActiveTab }) {
  return (
    <nav className="bottom-nav" aria-label="Điều hướng chính trên điện thoại">
      {navItems.map((item) => {
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

export function DesktopSidebar({ activeTab, setActiveTab }) {
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
    </aside>
  );
}
