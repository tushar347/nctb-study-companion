import { GraduationCap, Sparkles } from "lucide-react";

type AiTeacherAvatarProps = {
  title?: string;
  subtitle?: string;
};

export default function AiTeacherAvatar({
  title = "AI Teacher",
  subtitle = "Your personalized English learning guide",
}: AiTeacherAvatarProps) {
  return (
    <div className="flex items-center gap-4">
      <div className="relative">
        <div className="grid h-16 w-16 place-items-center rounded-[26px] bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 text-white shadow-2xl">
          <GraduationCap size={34} strokeWidth={2.4} />
        </div>

        <div className="absolute -right-1 -top-1 grid h-7 w-7 place-items-center rounded-full bg-white text-purple-600 shadow-lg">
          <Sparkles size={15} />
        </div>

        <div className="absolute -bottom-1 left-3 h-2 w-10 rounded-full bg-blue-500/40 blur-md" />
      </div>

      <div>
        <p className="text-xs font-black uppercase tracking-wide text-blue-700">
          Personalized Tutor
        </p>
        <h2 className="text-2xl font-black tracking-tight">{title}</h2>
        <p className="text-sm font-semibold text-slate-500">{subtitle}</p>
      </div>
    </div>
  );
}
