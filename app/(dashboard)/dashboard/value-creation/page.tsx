"use client";

import { ValueCreationPanel } from "@/components/dashboard/DashboardWorkspace";
import { SlidersHorizontal } from "lucide-react";

export default function ValueCreationPage() {
  return (
    <div className="p-4 sm:p-6">
      {/* Page header */}
      <div className="mb-6 flex items-center gap-3">
        <div className="rounded-lg bg-teal-100 p-2.5">
          <SlidersHorizontal className="h-5 w-5 text-teal-700" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Value Creation Estimation</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Adjust team parameters to see live ROI calculations.
          </p>
        </div>
      </div>

      {/* Panel rendered as a full page (no slide-over overlay) */}
      <ValueCreationPanel mode="page" />
    </div>
  );
}
