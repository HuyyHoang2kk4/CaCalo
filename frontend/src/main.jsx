/**
 * Điểm khởi chạy chính của ứng dụng Frontend CaCalo.
 * Mount React App vào thẻ #root trong index.html.
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
