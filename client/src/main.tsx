import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "@fontsource/vt323";
import "@fontsource/share-tech-mono";
import "@fontsource/orbitron/700.css";
import "@fontsource/orbitron/900.css";
import "./styles.css";
import { SignupPage } from "./pages/Signup";
import { ScreenPage } from "./pages/Screen";
import { AdminPage } from "./pages/Admin";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SignupPage />} />
        <Route path="/screen" element={<ScreenPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<SignupPage />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
