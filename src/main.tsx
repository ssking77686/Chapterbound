import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { initializeApp } from './plugins/default-plugins'

// 全局异步异常兜底：未 catch 的 Promise rejection 至少被打日志
window.addEventListener('unhandledrejection', (event) => {
  console.error('[unhandledrejection]', event.reason)
})

initializeApp().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  )
}).catch((err) => {
  document.getElementById('root')!.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui,sans-serif;color:#9B8E7E;background:#F5F1EA;text-align:center;padding:2rem">
      <div>
        <p style="font-size:1.1rem;font-weight:600;color:#3C3226;margin-bottom:0.5rem">应用启动失败</p>
        <p style="font-size:0.875rem">请检查浏览器是否启用了 IndexedDB 存储，然后刷新页面重试。</p>
      </div>
    </div>`
  console.error('App initialization failed:', err)
})
