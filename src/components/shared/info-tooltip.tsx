type InfoTooltipProps = {
  content: string;
  label: string;
};

export function InfoTooltip({ content, label }: InfoTooltipProps) {
  return (
    <span className="group relative inline-flex align-middle">
      <span
        aria-label={label}
        className="inline-flex h-5 w-5 cursor-help items-center justify-center rounded-full border border-line bg-white text-[11px] font-semibold text-slate-500 transition group-hover:border-sea group-hover:text-sea group-focus-within:border-sea group-focus-within:text-sea"
        role="img"
        tabIndex={0}
        title={content}
      >
        i
      </span>
      <span className="pointer-events-none absolute left-0 top-full z-20 mt-2 w-72 rounded-2xl border border-line bg-white px-3 py-3 text-xs font-medium leading-6 text-slate-600 opacity-0 shadow-lg transition group-hover:opacity-100 group-focus-within:opacity-100">
        {content}
      </span>
    </span>
  );
}
