import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "@/layouts/AppLayout";
import DashboardPage from "@/pages/DashboardPage";
import ProjectListPage from "@/pages/ProjectListPage";
import ProjectFormPage from "@/pages/ProjectFormPage";
import ProjectDetailPage from "@/pages/ProjectDetailPage";
import TeamMembersPage from "@/pages/TeamMembersPage";
import HolidaysPage from "@/pages/HolidaysPage";

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/projects/:divisi" element={<ProjectListPage />} />
          <Route path="/projects/:divisi/new" element={<ProjectFormPage />} />
          <Route path="/projects/:divisi/:projectId" element={<ProjectDetailPage />} />
          <Route path="/projects/:divisi/:projectId/edit" element={<ProjectFormPage />} />
          <Route path="/team-members" element={<TeamMembersPage />} />
          <Route path="/holidays" element={<HolidaysPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
