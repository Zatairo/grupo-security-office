export default function CatalogsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-condensed font-bold text-security-800">Catálogos</h1>
        <p className="text-sm text-neutral-500 mt-1">Gestión de catálogos comerciales</p>
      </div>
      <div className="flex flex-col items-center justify-center py-24 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl text-center">
        <svg className="w-16 h-16 text-[var(--color-text-tertiary)] mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M6 18L18 6M6 6l12 12" />
        </svg>
        <p className="text-lg font-semibold text-[var(--color-text-primary)]">Próximamente</p>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">Este módulo estará disponible en una fase futura.</p>
      </div>
    </div>
  )
}
