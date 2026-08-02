"use client";

import { CircleDollarSign } from "lucide-react";

import {
  SCORING_MESSAGES,
  type ScoringActivity,
} from "@/lib/scoring/policy";

export default function ScoringInfoCard({
  activity,
}: {
  activity: ScoringActivity;
}) {
  return (
    <div className="rounded-3xl border border-blue-200 bg-blue-50 p-4">
      <div className="flex items-start gap-3">
        <CircleDollarSign
          className="mt-0.5 shrink-0 text-blue-700"
          size={21}
        />

        <div>
          <p className="font-black text-blue-950">
            How scoring and points work
          </p>

          <p className="mt-1 text-sm font-semibold leading-6 text-blue-900">
            {SCORING_MESSAGES[activity]}
          </p>

          <p className="mt-2 text-xs font-bold text-blue-700">
            Repeating the same item awards only the improvement above your previous best.
          </p>
        </div>
      </div>
    </div>
  );
}
