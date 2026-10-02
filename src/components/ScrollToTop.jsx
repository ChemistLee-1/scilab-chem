import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// 사이트에 들어오거나 다른 페이지로 옮길 때 항상 화면 맨 위(첫 화면)부터 보이게 함.
// - 브라우저가 새로고침·재방문 때 예전 스크롤 위치를 되살리지 않도록 끔
// - 주소에 #(예: /standards#12화학03-01)이 있으면 그 항목으로 가야 하므로 맨 위로 올리지 않음
export default function ScrollToTop() {
  // key: 링크를 누를 때마다 바뀜 (이미 첫 화면에서 로고를 다시 눌러도 맨 위로)
  const { key, hash } = useLocation();

  useEffect(() => {
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';
  }, []);

  useEffect(() => {
    if (!hash) window.scrollTo(0, 0);
  }, [key, hash]);

  return null;
}
