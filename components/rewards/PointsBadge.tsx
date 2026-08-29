"use client";

import { useEffect, useState } from "react";
import { getStoredStudentKey } from "@/lib/studentSession";
import { Star } from "lucide-react";

export default function PointsBadge() {
  const [points, setPoints] = useState(0);

  useEffect(() => {
    async function loadPoints() {
      try {
        const res = await fetch(
          "/api/rewards/wallet?studentKey=demo-student"
        );

        const data = await res.json();

        if (data.success) {
          setPoints(data.wallet.learningPoints);
        }
      } catch {
        console.log("Points loading failed");
      }
    }

    loadPoints();
  }, []);

  const nextReward = Math.max(0, 60 - points);

  return (
    <div
      className="
        flex
        items-center
        gap-3
        rounded-2xl
        bg-gradient-to-r
        from-yellow-100
        to-orange-100
        px-4
        py-3
        shadow-lg
        border
        border-yellow-300
      "
    >
      <div
        className="
          grid
          h-10
          w-10
          place-items-center
          rounded-full
          bg-yellow-400
        "
      >
        <Star size={22} className="text-white" />
      </div>

      <div>
        <p className="text-xs font-bold text-slate-600">
          Learning Points
        </p>

        <p className="text-xl font-black text-slate-900">
          {points} pts
        </p>

        <p className="text-xs font-bold text-slate-500">
          {nextReward > 0
            ? `${nextReward} pts to Violet Theme`
            : "ðŸŽ‰ Reward unlocked"}
        </p>
      </div>
    </div>
  );
}