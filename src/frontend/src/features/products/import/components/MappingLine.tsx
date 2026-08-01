import type { SystemField } from '../types/import.types';

interface MappingLineProps {
  sourceColumn: string;
  targetField: string;
  confidence: number;
  isRequired: boolean;
  onChange: (sourceColumn: string, targetField: SystemField) => void;
}

const SYSTEM_FIELD_LABELS: Record<SystemField, string> = {
  sku: 'SKU',
  name: 'Nombre',
  description: 'Descripcion',
  category: 'Categoria',
  brand: 'Marca',
  technicalSpecs: 'Especificaciones Tecnicas',
  price_instalador_iva: 'Precio Instalador (IVA)',
  price_tienda_iva: 'Precio Tienda (IVA)',
  price_dpp_oro_iva: 'Precio DPP Oro (IVA)',
  price_dpp_platino_iva: 'Precio DPP Platino (IVA)',
  price_cliente_final_iva: 'Precio Cliente Final (IVA)',
  price_oro_sin_iva: 'Oro sin IVA',
  price_installer_sin_iva: 'Installer sin IVA',
  __skip: 'No importar',
  __extra: 'Atributo adicional',
};

const ALL_FIELDS: SystemField[] = Object.keys(SYSTEM_FIELD_LABELS) as SystemField[];

function ConfidenceBadge({ confidence }: { confidence: number }) {
  if (confidence >= 0.9) {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-800">
        Alta
      </span>
    );
  }
  if (confidence >= 0.7) {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-yellow-100 text-yellow-800">
        Media
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-100 text-orange-800">
      Baja
    </span>
  );
}

export default function MappingLine({
  sourceColumn,
  targetField,
  confidence,
  isRequired,
  onChange,
}: MappingLineProps) {
  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(sourceColumn, e.target.value as SystemField);
  };

  return (
    <div className={`flex items-center gap-4 px-4 py-3 ${targetField === '__extra' ? 'bg-purple-50' : targetField === '__skip' ? 'bg-gray-50' : ''}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-security-900 truncate">
            {sourceColumn}
          </span>
          {isRequired && (
            <span className="text-security-500 text-xs font-bold">*</span>
          )}
          {targetField === '__extra' && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-800">
              Extra
            </span>
          )}
          {confidence > 0 && confidence < 1 && (
            <ConfidenceBadge confidence={confidence} />
          )}
        </div>
      </div>

      <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
      </svg>

      <div className="w-64 shrink-0">
        <select
          value={targetField}
          onChange={handleSelectChange}
          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary focus:border-security-500"
        >
          {ALL_FIELDS.map((field) => (
            <option key={field} value={field}>
              {SYSTEM_FIELD_LABELS[field]}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
