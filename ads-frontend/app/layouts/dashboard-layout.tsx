import { Outlet } from "react-router";
import { TopNav } from "../components/top-nav";

export default function DashboardLayout() {
  return (
    <div className="min-h-screen w-full bg-slate-50 dark:bg-slate-950 flex flex-col">
      <TopNav />
      <main className="flex-1 w-full mx-auto">
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
