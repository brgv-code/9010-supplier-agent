import { ConvexProvider, ConvexReactClient } from "convex/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const url = import.meta.env.VITE_CONVEX_URL as string | undefined;
if (!url) {
  throw new Error("Set VITE_CONVEX_URL in .env.local (your *.convex.cloud deployment URL).");
}

const convex = new ConvexReactClient(url);

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("#root element not found");

createRoot(rootEl).render(
  <StrictMode>
    <ConvexProvider client={convex}>
      <App />
    </ConvexProvider>
  </StrictMode>,
);
