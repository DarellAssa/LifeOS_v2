import { createRoot } from "react-dom/client";
import '@/hooks/useTheme'; // Side-effect: ensure light/dark class is set before render
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
