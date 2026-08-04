const SETTINGS_CARDS = [
  {
    title: 'Precios',
    description: 'Listas de precios, moneda y formato de visualización de valores comerciales.',
  },
  {
    title: 'Catálogos',
    description: 'Configuración de catálogos comerciales. Se habilitará en una fase futura.',
  },
  {
    title: 'Asignaciones',
    description: 'Reglas de asignación de productos a listas de precios. Se habilitará en una fase futura.',
  },
  {
    title: 'Notas',
    description: 'Esta sección es una vista preliminar. La configuración persistente se integrará con el backend en fases posteriores.',
  },
]

export default function CommercialSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-condensed font-bold text-security-800">Configuración comercial</h1>
        <p className="text-sm text-neutral-500 mt-1">Parámetros y preferencias del módulo comercial</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {SETTINGS_CARDS.map((card) => (
          <div key={card.title} className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-5">
            <h2 className="font-semibold text-[var(--color-text-primary)]">{card.title}</h2>
            <p className="text-sm text-[var(--color-text-secondary)] mt-1">{card.description}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
