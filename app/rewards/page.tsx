"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Flame,
  Gift,
  Loader2,
  Sparkles,
  Target,
  Trophy,
  WalletCards,
} from "lucide-react";

import AppShell from "@/components/study/AppShell";
import LiquidCard from "@/components/study/LiquidCard";
import { getStoredStudentKey } from "@/lib/studentSession";

type Overview = {
  wallet: {
    learningPoints: number;
    lifetimePointsEarned: number;
  };

  goal: {
    setting: {
      targetPoints: number;
      targetActivityTypes: number;
    };

    progress: {
      pointsEarned: number;
      distinctActivityTypes: number;
      activityTypes: string[];
      completedAt: string | null;
    };

    streak: number;
  };

  catalog: Array<{
    id: string;
    code: string;
    name: string;
    description: string;
    rewardType: string;
    costPoints: number;
  }>;

  inventory: Array<{
    id: string;
    quantity: number;
    rewardItem: {
      name: string;
    };
  }>;
};

type ApiResponse<T> = {
  success?: boolean;
  error?: string;
} & T;

function progressWidth(
  value: number,
  target: number,
) {
  return `${Math.min(
    100,
    Math.round(
      (value /
        Math.max(
          1,
          target,
        )) *
        100,
    ),
  )}%`;
}

export default function RewardsPage() {
  const [
    overview,
    setOverview,
  ] = useState<Overview | null>(
    null,
  );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    actionCode,
    setActionCode,
  ] = useState("");

  const [
    message,
    setMessage,
  ] = useState("");

  const [
    error,
    setError,
  ] = useState("");

  async function loadOverview() {
    setLoading(true);
    setError("");

    try {
      const response =
        await fetch(
          `/api/rewards/overview?studentKey=${encodeURIComponent(
            getStoredStudentKey(),
          )}`,
          {
            cache:
              "no-store",
          },
        );

      const data =
        (await response.json()) as ApiResponse<Overview>;

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ??
            "Rewards could not be loaded.",
        );
      }

      setOverview(
        data,
      );
    } catch (
      requestError
    ) {
      setError(
        requestError instanceof
          Error
          ? requestError.message
          : "Rewards could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadOverview();
  }, []);

  async function redeem(
    code: string,
  ) {
    setActionCode(code);
    setMessage("");
    setError("");

    try {
      const response =
        await fetch(
          "/api/rewards/redeem-item",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                studentKey:
                  getStoredStudentKey(),
                code,
              }),
          },
        );

      const data =
        (await response.json()) as ApiResponse<{
          reward?: {
            rewardItem: {
              name: string;
            };
          };
        }>;

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ??
            "Reward redemption failed.",
        );
      }

      setMessage(
        `${
          data.reward
            ?.rewardItem
            .name ??
          "Reward"
        } redeemed successfully.`,
      );

      await loadOverview();
    } catch (
      requestError
    ) {
      setError(
        requestError instanceof
          Error
          ? requestError.message
          : "Reward redemption failed.",
      );
    } finally {
      setActionCode("");
    }
  }

  async function updateGoal(
    targetPoints: number,
  ) {
    setActionCode(
      `GOAL:${targetPoints}`,
    );

    setMessage("");
    setError("");

    try {
      const response =
        await fetch(
          "/api/rewards/goals",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                studentKey:
                  getStoredStudentKey(),
                targetPoints,
              }),
          },
        );

      const data =
        (await response.json()) as ApiResponse<{
          setting?: unknown;
        }>;

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ??
            "Daily goal update failed.",
        );
      }

      setMessage(
        `Daily goal changed to ${targetPoints} points.`,
      );

      await loadOverview();
    } catch (
      requestError
    ) {
      setError(
        requestError instanceof
          Error
          ? requestError.message
          : "Daily goal update failed.",
      );
    } finally {
      setActionCode("");
    }
  }

  /*
   * Apply the violet profile theme.
   */
  async function useVioletTheme() {
    setActionCode(
      "THEME:violet",
    );

    setMessage("");
    setError("");

    try {
      const studentKey =
        localStorage.getItem(
          "studentKey",
        );

      if (!studentKey) {
        throw new Error(
          "Student session not found. Please log in again.",
        );
      }

      const response =
        await fetch(
          "/api/rewards/apply-theme",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                studentKey,
                theme: "violet",
              }),
          },
        );

      const data =
        (await response.json()) as ApiResponse<unknown>;

      if (
        !response.ok ||
        data.success === false
      ) {
        throw new Error(
          data.error ??
            "Could not apply the violet theme.",
        );
      }

      /*
       * Reload so AppShell reads the
       * newly applied theme.
       */
      window.location.reload();
    } catch (
      requestError
    ) {
      setError(
        requestError instanceof
          Error
          ? requestError.message
          : "Could not apply the violet theme.",
      );

      setActionCode("");
    }
  }

  if (
    loading &&
    !overview
  ) {
    return (
      <AppShell>
        <LiquidCard className="grid min-h-96 place-items-center">
          <Loader2
            className="animate-spin text-blue-700"
            size={36}
          />
        </LiquidCard>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-6 pb-12">

        {/* Header */}

        <LiquidCard className="overflow-hidden p-0">
          <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-rose-600 p-6 text-white sm:p-8">
            <div className="flex items-start gap-4">

              <div className="grid h-16 w-16 place-items-center rounded-3xl bg-white/15">
                <Gift size={32} />
              </div>

              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-100">
                  Learning rewards
                </p>

                <h1 className="mt-1 text-4xl font-black">
                  Points, Goals & Rewards
                </h1>

                <p className="mt-3 max-w-3xl text-sm font-semibold leading-7 text-orange-50">
                  Earn learning points from real practice improvement, complete daily goals, and redeem rewards.
                </p>
              </div>

            </div>
          </div>
        </LiquidCard>

        {/* Success message */}

        {message ? (
          <LiquidCard className="border border-emerald-200 bg-emerald-50 p-4 font-black text-emerald-800">
            {message}
          </LiquidCard>
        ) : null}

        {/* Error message */}

        {error ? (
          <LiquidCard className="border border-red-200 bg-red-50 p-4 font-black text-red-800">
            {error}
          </LiquidCard>
        ) : null}

        {overview ? (
          <>

            {/* Stats */}

            <div className="grid gap-5 md:grid-cols-3">

              <LiquidCard className="p-5">
                <WalletCards
                  className="text-blue-700"
                  size={27}
                />

                <p className="mt-4 text-xs font-black uppercase text-slate-500">
                  Available points
                </p>

                <p className="mt-1 text-4xl font-black">
                  {
                    overview
                      .wallet
                      .learningPoints
                  }
                </p>

                <p className="mt-2 text-sm font-semibold text-slate-500">
                  Lifetime earned:{" "}
                  {
                    overview
                      .wallet
                      .lifetimePointsEarned
                  }
                </p>
              </LiquidCard>

              <LiquidCard className="p-5">
                <Target
                  className="text-emerald-700"
                  size={27}
                />

                <p className="mt-4 text-xs font-black uppercase text-slate-500">
                  Today&apos;s points
                </p>

                <p className="mt-1 text-3xl font-black">
                  {
                    overview
                      .goal
                      .progress
                      .pointsEarned
                  }{" "}
                  /{" "}
                  {
                    overview
                      .goal
                      .setting
                      .targetPoints
                  }
                </p>

                <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-emerald-600"
                    style={{
                      width:
                        progressWidth(
                          overview
                            .goal
                            .progress
                            .pointsEarned,
                          overview
                            .goal
                            .setting
                            .targetPoints,
                        ),
                    }}
                  />
                </div>
              </LiquidCard>

              <LiquidCard className="p-5">
                <Flame
                  className="text-orange-600"
                  size={27}
                />

                <p className="mt-4 text-xs font-black uppercase text-slate-500">
                  Goal streak
                </p>

                <p className="mt-1 text-4xl font-black">
                  {
                    overview
                      .goal
                      .streak
                  }
                </p>

                <p className="mt-2 text-sm font-semibold text-slate-500">
                  completed day(s) in a row
                </p>
              </LiquidCard>

            </div>

            {/* Daily Goal */}

            <LiquidCard className="p-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

                <div>
                  <h2 className="text-2xl font-black">
                    Daily Goal
                  </h2>

                  <p className="mt-2 text-sm font-semibold text-slate-600">
                    Complete{" "}
                    {
                      overview
                        .goal
                        .setting
                        .targetPoints
                    }{" "}
                    points and{" "}
                    {
                      overview
                        .goal
                        .setting
                        .targetActivityTypes
                    }{" "}
                    different activity types today.
                  </p>

                  <p className="mt-2 text-sm font-black text-blue-700">
                    Activity types completed:{" "}
                    {
                      overview
                        .goal
                        .progress
                        .distinctActivityTypes
                    }{" "}
                    /{" "}
                    {
                      overview
                        .goal
                        .setting
                        .targetActivityTypes
                    }
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {[
                    ["Light", 40],
                    ["Standard", 60],
                    ["Challenge", 100],
                  ].map(
                    ([
                      label,
                      value,
                    ]) => (
                      <button
                        key={
                          value
                        }
                        type="button"
                        onClick={() =>
                          void updateGoal(
                            Number(
                              value,
                            ),
                          )
                        }
                        disabled={
                          actionCode ===
                          `GOAL:${value}`
                        }
                        className={`rounded-2xl px-4 py-3 text-sm font-black ${
                          overview
                            .goal
                            .setting
                            .targetPoints ===
                          Number(
                            value,
                          )
                            ? "bg-slate-950 text-white"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {
                          label
                        }{" "}
                        {
                          value
                        }
                      </button>
                    ),
                  )}
                </div>

              </div>

              {overview.goal.progress.completedAt ? (
                <div className="mt-5 flex items-center gap-3 rounded-2xl bg-emerald-50 p-4 font-black text-emerald-800">
                  <CheckCircle2 size={22} />
                  Today&apos;s goal is complete.
                </div>
              ) : (
                <div className="mt-5 rounded-2xl bg-blue-50 p-4 text-sm font-semibold text-blue-900">
                  Earn{" "}
                  {Math.max(
                    0,
                    overview
                      .goal
                      .setting
                      .targetPoints -
                      overview
                        .goal
                        .progress
                        .pointsEarned,
                  )}{" "}
                  more point(s) and complete{" "}
                  {Math.max(
                    0,
                    overview
                      .goal
                      .setting
                      .targetActivityTypes -
                      overview
                        .goal
                        .progress
                        .distinctActivityTypes,
                  )}{" "}
                  more activity type(s).
                </div>
              )}
            </LiquidCard>

            {/* Reward Store */}

            <section>
              <div className="flex items-center gap-3">
                <Sparkles
                  className="text-orange-600"
                  size={27}
                />

                <div>
                  <h2 className="text-2xl font-black">
                    Reward Store
                  </h2>

                  <p className="text-sm font-semibold text-slate-500">
                    Rewards never change academic scores.
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {overview.catalog.map(
                  (item) => (
                    <LiquidCard
                      key={item.id}
                      className="flex flex-col p-5"
                    >
                      <Trophy
                        className="text-amber-600"
                        size={27}
                      />

                      <h3 className="mt-4 text-xl font-black">
                        {
                          item.name
                        }
                      </h3>

                      <p className="mt-2 flex-1 text-sm font-semibold leading-6 text-slate-600">
                        {
                          item.description
                        }
                      </p>

                      <div className="mt-5 flex items-center justify-between gap-3">
                        <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-black text-amber-800">
                          {
                            item.costPoints
                          }{" "}
                          points
                        </span>

                        <button
                          type="button"
                          onClick={() =>
                            void redeem(
                              item.code,
                            )
                          }
                          disabled={
                            actionCode ===
                              item.code ||
                            overview
                              .wallet
                              .learningPoints <
                              item.costPoints
                          }
                          className="rounded-2xl bg-orange-700 px-4 py-3 text-sm font-black text-white disabled:opacity-40"
                        >
                          {actionCode ===
                          item.code
                            ? "Redeeming..."
                            : "Redeem"}
                        </button>
                      </div>
                    </LiquidCard>
                  ),
                )}
              </div>
            </section>

            {/* Inventory */}

            <LiquidCard className="p-6">
              <h2 className="text-2xl font-black">
                My Reward Inventory
              </h2>

              <div className="mt-4 grid gap-3 md:grid-cols-2">

                {overview.inventory.length ? (
                  overview.inventory.map(
                    (item) => (
                      <div
                        key={
                          item.id
                        }
                        className="rounded-2xl bg-white p-4"
                      >
                        <p className="font-black">
                          {
                            item
                              .rewardItem
                              .name
                          }
                        </p>

                        <p className="mt-1 text-sm font-semibold text-slate-500">
                          Quantity:{" "}
                          {
                            item.quantity
                          }
                        </p>

                        {/* Violet Theme Button */}

                        <button
                          type="button"
                          onClick={() =>
                            void useVioletTheme()
                          }
                          disabled={
                            actionCode ===
                            "THEME:violet"
                          }
                          className="
                            mt-3
                            rounded-xl
                            bg-purple-600
                            px-4
                            py-2
                            text-xs
                            font-black
                            text-white
                            transition
                            hover:bg-purple-700
                            disabled:opacity-40
                          "
                        >
                          {actionCode ===
                          "THEME:violet"
                            ? "Applying..."
                            : "Use Violet Theme"}
                        </button>
                      </div>
                    ),
                  )
                ) : (
                  <p className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">
                    Redeemed rewards will appear here.
                  </p>
                )}

              </div>
            </LiquidCard>

          </>
        ) : null}
      </div>
    </AppShell>
  );
}