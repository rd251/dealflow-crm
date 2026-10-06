import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/dm-sans/700.css";

const rootElement = document.getElementById("root");
if (rootElement) createRoot(rootElement).render(<App />);
