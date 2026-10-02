import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './index.css';
import './chem.css';

// 새 탭·새 창으로 사이트에 처음 들어오면 항상 메인 화면(/)부터 보여 줌.
// 브라우저 주소 자동 완성이 마지막에 본 페이지 주소를 채워 넣어도 메인 화면으로 바꿈.
// sessionStorage 는 탭마다 따로 기억되므로, 같은 탭에서 새로고침하면 보던 페이지가 그대로 유지됨.
try {
  if (!sessionStorage.getItem('visited')) {
    sessionStorage.setItem('visited', '1');
    if (window.location.pathname !== '/') window.history.replaceState(null, '', '/');
  }
} catch {
  // 저장 공간을 쓸 수 없는 환경(일부 개인 정보 보호 모드)에서는 주소를 그대로 둠
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
