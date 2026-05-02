import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./Layout";
import { AdminPage } from "./pages/AdminPage";
import { ChatPage } from "./pages/ChatPage";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<ChatPage />} />
          <Route path="admin" element={<AdminPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
