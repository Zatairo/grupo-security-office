import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useImportStore } from '../store/import.store';
import { fetchListas, createLista, type ListaPayload } from '../../../../services/listas.service';
import { fetchSuppliers, type Supplier } from '../../../../services/suppliers.service';
import { getApiErrorMessage } from '../../../../lib/apiError';
import { Alert, Button } from '../../../../components/ui';
import SupplierModal from './SupplierModal';

const CURRENCIES = ['COP', 'USD', 'EUR'] as const;

const FIELD_CLASS =
  'w-full px-3 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-focus-ring)] focus:border-[var(--color-primary)] text-sm';

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function baseNameFromFile(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '').trim();
}

function buildUniqueCode(base: string): string {
  const slug = slugify(base || 'lista').slice(0, 24).toUpperCase() || 'LISTA';
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${slug}-${suffix}`;
}

export default function ImportStepDocumentar() {
  const queryClient = useQueryClient();
  const fileName = useImportStore((s) => s.fileName);
  const listaId = useImportStore((s) => s.listaId);
  const supplierId = useImportStore((s) => s.supplierId);
  const setListaId = useImportStore((s) => s.setListaId);
  const setSupplier = useImportStore((s) => s.setSupplier);
  const setListaMetadata = useImportStore((s) => s.setListaMetadata);
  const nextStep = useImportStore((s) => s.nextStep);

  const [mode, setMode] = useState<'create' | 'select'>(() => (listaId ? 'select' : 'create'));
  const [selectedListaId, setSelectedListaId] = useState<string>(listaId ?? '');
  const [form, setForm] = useState({
    name: baseNameFromFile(fileName),
    codigo: '',
    currency: 'COP' as string,
    validFrom: '',
    validUntil: '',
    notes: '',
  });
  const [supplier, setSupplierState] = useState<string>(supplierId ?? '');
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const listasQuery = useQuery({ queryKey: ['listas'], queryFn: fetchListas });
  const suppliersQuery = useQuery({ queryKey: ['suppliers'], queryFn: () => fetchSuppliers() });

  const availableListas = useMemo(
    () => (listasQuery.data ?? []).filter((l) => !l.archivedAt),
    [listasQuery.data],
  );
  const suppliers = suppliersQuery.data ?? [];

  useEffect(() => {
    if (mode === 'select' && selectedListaId) {
      const found = availableListas.find((l) => l.id === selectedListaId);
      if (found && found.supplierId && !supplier) {
        setSupplierState(found.supplierId);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, selectedListaId, availableListas]);

  const createMutation = useMutation({
    mutationFn: (payload: ListaPayload) => createLista(payload),
    onSuccess: (created) => {
      setListaId(created.id);
      setListaMetadata({ listaId: created.id, name: created.name, codigo: created.codigo ?? '', currency: created.currency });
      queryClient.invalidateQueries({ queryKey: ['listas'] });
      nextStep();
    },
    onError: (err) => setFormError(getApiErrorMessage(err, 'No se pudo crear la Lista')),
  });

  const handleContinue = () => {
    setFormError(null);

    if (mode === 'select') {
      if (!selectedListaId) {
        setFormError('Selecciona una Lista existente');
        return;
      }
      const found = availableListas.find((l) => l.id === selectedListaId);
      setListaId(selectedListaId);
      setListaMetadata({
        mode,
        listaId: selectedListaId,
        supplierId: supplier || null,
        supplierName: supplier ? suppliers.find((s) => s.id === supplier)?.name ?? null : null,
        name: found?.name ?? '',
        codigo: found?.codigo ?? '',
        currency: found?.currency ?? 'COP',
      });
      setSupplier(supplier || null, supplier ? suppliers.find((s) => s.id === supplier)?.name ?? null : null);
      nextStep();
      return;
    }

    const name = form.name.trim();
    if (name.length < 2) {
      setFormError('El nombre de la Lista debe tener al menos 2 caracteres');
      return;
    }
    if (form.validFrom && form.validUntil && form.validFrom > form.validUntil) {
      setFormError('La fecha de inicio de vigencia no puede ser posterior a la de fin');
      return;
    }
    if (supplier) {
      setSupplier(supplier, suppliers.find((s) => s.id === supplier)?.name ?? null);
    }
    createMutation.mutate({
      name,
      code: buildUniqueCode(form.codigo || name),
      codigo: form.codigo.trim() || null,
      currency: form.currency,
      supplierId: supplier || null,
      validFrom: form.validFrom || null,
      validUntil: form.validUntil || null,
      description: form.notes.trim() || null,
    });
  };

  const listasLoading = listasQuery.isLoading;
  const suppliersLoading = suppliersQuery.isLoading;
  const listasError = listasQuery.error ? getApiErrorMessage(listasQuery.error, 'No se pudieron cargar las Listas') : null;
  const suppliersError = suppliersQuery.error ? getApiErrorMessage(suppliersQuery.error, 'No se pudieron cargar los proveedores') : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-security-900">Documentar la Lista</h2>
        <p className="mt-1 text-sm text-gray-500">
          Define dónde vivirán los productos importados: crea una Lista nueva o reutiliza una
          existente, e identifica el proveedor.
        </p>
      </div>

      {formError && (
        <Alert variant="error">{formError}</Alert>
      )}

      <div className="border border-gray-200 rounded-lg p-5 space-y-4">
        <p className="text-sm font-medium text-gray-700">Lista destino</p>
        <div className="flex flex-col gap-2">
          {([
            { value: 'create' as const, label: 'Crear lista nueva', description: 'Se crea la Lista y se asocian los productos importados' },
            { value: 'select' as const, label: 'Usar lista existente', description: 'Los productos se importan a una Lista ya creada' },
          ]).map((option) => (
            <label
              key={option.value}
              className={`
                flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-colors
                ${mode === option.value
                  ? 'border-security-700 bg-security-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
                }
              `}
            >
              <input
                type="radio"
                name="lista-mode"
                value={option.value}
                checked={mode === option.value}
                onChange={() => {
                  setMode(option.value);
                  setFormError(null);
                }}
                className="mt-0.5 text-security-700 focus:ring-brand-primary/30 focus:border-brand-primary"
              />
              <div>
                <span className="text-sm font-medium text-security-900">{option.label}</span>
                <span className="block text-xs text-gray-500 mt-0.5">{option.description}</span>
              </div>
            </label>
          ))}
        </div>

        {mode === 'select' ? (
          <div>
            <label htmlFor="doc-lista-existing" className="block text-sm font-medium text-gray-700 mb-1.5">
              Lista existente
            </label>
            <select
              id="doc-lista-existing"
              value={selectedListaId}
              onChange={(e) => setSelectedListaId(e.target.value)}
              className={FIELD_CLASS}
              disabled={listasLoading}
            >
              <option value="">Selecciona una Lista...</option>
              {availableListas.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.code}) - {l.currency}
                </option>
              ))}
            </select>
            {listasLoading && <p className="text-xs text-gray-400 mt-1">Cargando Listas...</p>}
            {listasError && <p className="text-xs text-red-600 mt-1">{listasError}</p>}
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label htmlFor="doc-lista-name" className="block text-sm font-medium text-gray-700 mb-1.5">
                Nombre <span className="text-red-500">*</span>
              </label>
              <input
                id="doc-lista-name"
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={FIELD_CLASS}
                required
                minLength={2}
                placeholder="Ej: Lista Hikvision Video"
              />
            </div>
            <div>
              <label htmlFor="doc-lista-codigo" className="block text-sm font-medium text-gray-700 mb-1.5">
                Codigo de identificacion
              </label>
              <input
                id="doc-lista-codigo"
                type="text"
                value={form.codigo}
                onChange={(e) => setForm({ ...form, codigo: e.target.value })}
                className={FIELD_CLASS}
                placeholder="Ej: LISTA-HIKV-VID (opcional)"
              />
              <p className="text-xs text-gray-400 mt-1">
                Identificador de negocio opcional. Si lo dejas vacio, se genera uno automaticamente.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="doc-lista-currency" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Moneda
                </label>
                <select
                  id="doc-lista-currency"
                  value={form.currency}
                  onChange={(e) => setForm({ ...form, currency: e.target.value })}
                  className={FIELD_CLASS}
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="doc-lista-valid-from" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Vigencia desde
                </label>
                <input
                  id="doc-lista-valid-from"
                  type="date"
                  value={form.validFrom}
                  onChange={(e) => setForm({ ...form, validFrom: e.target.value })}
                  className={FIELD_CLASS}
                />
              </div>
              <div>
                <label htmlFor="doc-lista-valid-until" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Vigencia hasta
                </label>
                <input
                  id="doc-lista-valid-until"
                  type="date"
                  value={form.validUntil}
                  onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
                  className={FIELD_CLASS}
                />
              </div>
            </div>
            <div>
              <label htmlFor="doc-lista-notes" className="block text-sm font-medium text-gray-700 mb-1.5">
                Notas / descripcion
              </label>
              <textarea
                id="doc-lista-notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
                className={FIELD_CLASS}
                placeholder="Notas opcionales sobre la Lista"
              />
            </div>
          </div>
        )}
      </div>

      <div className="border border-gray-200 rounded-lg p-5 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-gray-700">Proveedor</p>
          <Button variant="secondary" onClick={() => setShowSupplierModal(true)}>
            Crear proveedor
          </Button>
        </div>
        <div>
          <label htmlFor="doc-supplier" className="block text-sm font-medium text-gray-700 mb-1.5">
            Proveedor asociado
          </label>
          <select
            id="doc-supplier"
            value={supplier}
            onChange={(e) => setSupplierState(e.target.value)}
            className={FIELD_CLASS}
            disabled={suppliersLoading}
          >
            <option value="">Sin proveedor</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} {s.nit ? `(${s.nit})` : ''}
              </option>
            ))}
          </select>
          {suppliersLoading && <p className="text-xs text-gray-400 mt-1">Cargando proveedores...</p>}
          {suppliersError && <p className="text-xs text-red-600 mt-1">{suppliersError}</p>}
        </div>
      </div>

      {showSupplierModal && (
        <SupplierModal
          onClose={() => setShowSupplierModal(false)}
          onSaved={(created: Supplier) => {
            setShowSupplierModal(false);
            setSupplierState(created.id);
            queryClient.invalidateQueries({ queryKey: ['suppliers'] });
          }}
        />
      )}

      <div className="flex justify-end">
        <Button
          disabled={createMutation.isPending}
          loading={createMutation.isPending}
          onClick={handleContinue}
        >
          Continuar
        </Button>
      </div>
    </div>
  );
}