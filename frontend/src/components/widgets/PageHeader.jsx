export default function PageHeader({ title, subtitle, actions, testid }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4 flex-wrap" data-testid={testid}>
      <div>
        <div className="text-[10px] tracking-[0.28em] text-muted-app uppercase mb-1 font-mono-data">// Network Digital Twin</div>
        <h1 className="text-3xl sm:text-4xl font-semibold text-strong-app tracking-tight">{title}</h1>
        {subtitle ? <p className="mt-2 text-sm text-muted-app max-w-2xl">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2 flex-wrap">{actions}</div> : null}
    </div>
  );
}
