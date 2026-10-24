import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { applyStoredTheme } from './features/shell/theme-storage'

applyStoredTheme();

createRoot(document.getElementById("root")!).render(<App />);
