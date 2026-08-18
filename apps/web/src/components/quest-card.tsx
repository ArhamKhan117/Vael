import React from "react";

type StatRow = {
  label: string;
  value: string;
  dotClassName?: string;
};

type QuestCardProps = {
  code: string;
  codeBgClassName: string;
  codeTextClassName: string;
  id: string;
  title: string;
  description: string;
  stats: StatRow[];
  buttonLabel: string;
};

export default function QuestCard({
  code,
  codeBgClassName,
  codeTextClassName,
  id,
  title,
  description,
  stats,
  buttonLabel,
}: QuestCardProps) {
  return (
    <article className="flex h-full flex-col justify-between border-r border-b border-[#1A1A1A] p-10">
      <div className="space-y-4">
        <div className="flex items-center justify-between text-[10px] text-zinc-500">
          <div className="inline-flex items-center gap-2">
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs ${codeBgClassName} ${codeTextClassName}`}
            >
              {code}
            </span>
          </div>
          <span className="rounded-full border border-zinc-700 px-2 py-0.5">
            ID: {id}
          </span>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <p className="text-xs leading-relaxed text-zinc-400">{description}</p>
        </div>

        <div className="mt-4 space-y-2 text-[11px]">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="flex items-center justify-between text-zinc-500"
            >
              <span>{stat.label}</span>
              <span className="inline-flex items-center gap-1 text-xs text-white">
                {stat.dotClassName && (
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${stat.dotClassName}`}
                  />
                )}
                {stat.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      <button className="mt-5 inline-flex h-9 w-full items-center justify-center rounded-full bg-white text-[11px] font-semibold tracking-[0.16em] text-black hover:bg-zinc-200">
        {buttonLabel}
      </button>
    </article>
  );
}

