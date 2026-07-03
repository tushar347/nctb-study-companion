import React from "react";

type LiquidCardProps = {
  children: React.ReactNode;
  className?: string;
};

export default function LiquidCard({
  children,
  className = "",
}: LiquidCardProps) {
  return (
    <div
      className={`rounded-[32px] border border-white/60 bg-white/45 shadow-[0_24px_70px_rgba(15,23,42,0.14)] backdrop-blur-2xl ${className}`}
    >
      {children}
    </div>
  );
}
