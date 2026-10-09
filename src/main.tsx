import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Seeders and console debug helpers exist only in development builds (plan 3.1 step 7): the dynamic
// import sits behind a compile-time constant, so production bundles do not contain them.
if (import.meta.env.DEV) {
  void import('./dev/register-debug-globals').then(({ registerDebugGlobals }) => registerDebugGlobals());
}

if (typeof document !== 'undefined') {
  document.body.classList.add('dark');
}

createRoot(document.getElementById("root")!).render(<App />);
