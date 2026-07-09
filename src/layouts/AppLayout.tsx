import { Outlet } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import ToastContainer from "@/components/ToastContainer";

export default function AppLayout() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <Outlet />
      </main>
      <ToastContainer />
    </div>
  );
}
