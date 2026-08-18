import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useImportStore } from '../store/import.store';
import { fetchListas, createLista, type ListaPayload } from '../../../../services/listas.service';
import { fetchCategories, createCategory, type CategoryPayload } from '../../../../services/settings.service';
import { fetchUsers, type UserListItem } from '../../../../services/users.service';
import { useAuthStore } from '../../../../stores/auth.store';
import { getApiErrorMessage } from '../../../../lib/apiError';
import { Button, Alert, Modal } from '../../../../components/ui';

const CURRENCIES = ['COP', 'USD', 'EUR'] as const;
const LISTA_TYPES = ['mayorista', 'detalle', 'oro', 'platino', 'instalador', 'tienda'] as const;

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

export default function ImportStepSections() {
  const queryClient = useQueryClient();
  const listaId = useImportStore((s) => s.listaId);
  const setListaId = useImportStore((s) => s.setListaId);
  const nextStep = useImportStore((s) => s.nextStep);

  const [showListaModal, setShowListaModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  const listasQuery = useQuery({ queryKey: ['listas'], queryFn: fetchListas });
  const categoriesQuery = useQuery({ queryKey: ['categories'], queryFn: fetchCategories });

  const listas = listasQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];

  const availableListas = listas.filter((l) => !l.archivedAt);
  const hasListas = availableListas.length > 0;
  const hasCategories = categories.length > 0;
  const canContinue = hasListas && hasCategories;

  useEffect(() => {
    if (availableListas.length > 0) {
      const valid = listaId && availableListas.some((l) => l.id === listaId);
      if (!valid) {
        const first = availableListas[0];
        if (first) setListaId(first.id);
      }
    }
  }, [availableListas, listaId, setListaId]);

  const isLoading = listasQuery.isLoading || categoriesQuery.isLoading;
  const loadError = listasQuery.error ? getApiErrorMessage(listasQuery.error, 'No se pudieron cargar las Listas') : null;
  const categoriesError = categoriesQuery.error ? getApiErrorMessage(categoriesQuery.error, 'No se pudieron cargar las categorías') : null;

  const handleListaCreated = () => {
    setShowListaModal(false);
    queryClient.invalidateQueries({ queryKey: ['listas'] });
  };

  const handleCategoryCreated = () => {
    setShowCategoryModal(false);
    queryClient.invalidateQueries({ queryKey: ['categories'] });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="h-5 bg-neutral-100 rounded animate-pulse w-1/3"></div>
        <div className="h-4 bg-neutral-100 rounded animate-pulse w-2/3"></div>
        <div className="h-24 bg-neutral-100 rounded-lg animate-pulse"></div>
        <p className="text-sm text-gray-400">Verificando secciones disponibles...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-security-900">
          Secciones de la importacion
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Antes de mapear el archivo, asegurate de que existan las secciones donde viviran los
          productos (Listas y Categorias).
        </p>
      </div>

      {(loadError || categoriesError) && (
        <Alert variant="error">
          <div className="flex flex-col gap-2">
            <span>{loadError ?? categoriesError}</span>
            <button
              type="button"
              onClick={() => {
                listasQuery.refetch();
                categoriesQuery.refetch();
              }}
              className="self-start text-sm font-medium underline underline-offset-2 hover:opacity-80"
            >
              Reintentar
            </button>
          </div>
        </Alert>
      )}

      {!loadError && !categoriesError && !hasListas && (
        <div className="border border-gray-200 rounded-lg p-8 text-center">
          <div className="w-14 h-14 mx-auto mb-4 flex items-center justify-center rounded-full bg-neutral-100 text-neutral-400">
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-security-900">
            Para importar necesitas primero crear una seccion
          </h3>
          <p className="mt-2 text-sm text-gray-500 max-w-md mx-auto">
            Debes crear una <strong>Lista comercial</strong>. La Lista es la seccion raiz donde
            viven los productos, los precios y los permisos.
          </p>
          <div className="mt-6 flex justify-center">
            <Button icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            } onClick={() => setShowListaModal(true)}>
              Crear Lista
            </Button>
          </div>
          {!hasCategories && (
            <p className="mt-4 text-xs text-gray-400">
              Tambien necesitaras al menos una categoria para clasificar los productos.
            </p>
          )}
        </div>
      )}

      {!loadError && !categoriesError && hasListas && (
        <>
          {!hasCategories && (
            <Alert variant="warning">
              <div className="flex flex-col gap-2">
                <span>
                  No hay categorias creadas. Crea al menos una categoria para clasificar los
                  productos; es obligatoria para crear productos.
                </span>
                <button
                  type="button"
                  onClick={() => setShowCategoryModal(true)}
                  className="self-start inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md bg-amber-100 text-amber-800 hover:bg-amber-200 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Crear categoria
                </button>
              </div>
            </Alert>
          )}

          {hasCategories && (
            <div className="border border-emerald-200 bg-emerald-50 rounded-lg p-5 flex items-start gap-3">
              <span className="flex-shrink-0 mt-0.5">
                <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
              <div>
                <p className="text-sm font-medium text-emerald-800">
                  {availableListas.length} seccion(es) (listas) y {categories.length} categoria(s) listas
                </p>
                <p className="text-xs text-emerald-700 mt-0.5">
                  Puedes continuar con la importacion.
                </p>
              </div>
            </div>
          )}

          <div className="border border-gray-200 rounded-lg p-5">
            <label htmlFor="import-lista-destino" className="block text-sm font-medium text-gray-700 mb-1.5">
              Lista destino
            </label>
            <select
              id="import-lista-destino"
              value={listaId ?? ''}
              onChange={(e) => setListaId(e.target.value || null)}
              className={FIELD_CLASS}
            >
              {availableListas.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.code}) - {l.currency}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1.5">
              Los productos importados se crearan en la Lista seleccionada.
            </p>
          </div>

          <div className="flex justify-end">
            <Button disabled={!canContinue} onClick={nextStep}>
              Continuar
            </Button>
          </div>
        </>
      )}

      {showListaModal && (
        <ListaModal onClose={() => setShowListaModal(false)} onSaved={handleListaCreated} />
      )}
      {showCategoryModal && (
        <CategoryModal onClose={() => setShowCategoryModal(false)} onSaved={handleCategoryCreated} />
      )}
    </div>
  );
}

function ListaModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const currentUser = useAuthStore((s) => s.user);
  const [form, setForm] = useState({
    name: '',
    code: '',
    type: '',
    currency: 'COP',
    defaultVisibility: false,
    responsibleId: currentUser?.id ?? '',
    validFrom: '',
    validUntil: '',
  });
  const [formError, setFormError] = useState<string | null>(null);

  const { data: users, isLoading: isLoadingUsers } = useQuery({
    queryKey: ['users'],
    queryFn: () => fetchUsers(),
  });
  const usersList = (users ?? []) as UserListItem[];

  const mutation = useMutation({
    mutationFn: (payload: ListaPayload) => createLista(payload),
    onSuccess: onSaved,
    onError: (err) => setFormError(getApiErrorMessage(err, 'No se pudo crear la Lista')),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const payload: ListaPayload = {
      name: form.name.trim(),
      code: form.code.trim(),
      currency: form.currency,
      type: form.type || null,
      defaultVisibility: form.defaultVisibility,
      responsibleId: form.responsibleId || null,
      validFrom: form.validFrom || null,
      validUntil: form.validUntil || null,
    };
    if (payload.name.length < 2 || payload.code.length < 2) {
      setFormError('Nombre y codigo deben tener al menos 2 caracteres');
      return;
    }
    if (payload.validFrom && payload.validUntil && payload.validFrom > payload.validUntil) {
      setFormError('La fecha de inicio de vigencia no puede ser posterior a la de fin');
      return;
    }
    mutation.mutate(payload);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Nueva Lista"
      size="md"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" form="create-lista-form" loading={mutation.isPending}>Crear</Button>
        </>
      }
    >
      <form id="create-lista-form" onSubmit={submit} className="space-y-4">
        {formError && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2.5 text-sm" role="alert">
            {formError}
          </div>
        )}

        <div>
          <label htmlFor="lista-name" className="block text-sm font-medium text-neutral-800 mb-1.5">Nombre</label>
          <input id="lista-name" type="text" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} className={FIELD_CLASS} required minLength={2} />
        </div>

        <div>
          <label htmlFor="lista-code" className="block text-sm font-medium text-neutral-800 mb-1.5">Codigo</label>
          <input id="lista-code" type="text" value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })} className={FIELD_CLASS} required minLength={2} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="lista-type" className="block text-sm font-medium text-neutral-800 mb-1.5">Tipo</label>
            <select id="lista-type" value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })} className={FIELD_CLASS}>
              <option value="">Sin tipo</option>
              {LISTA_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="lista-currency" className="block text-sm font-medium text-neutral-800 mb-1.5">Moneda</label>
            <select id="lista-currency" value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value })} className={FIELD_CLASS} required>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="lista-responsible" className="block text-sm font-medium text-neutral-800 mb-1.5">Responsable</label>
          <select id="lista-responsible" value={form.responsibleId}
            onChange={(e) => setForm({ ...form, responsibleId: e.target.value })} className={FIELD_CLASS}>
            <option value="">Sin responsable</option>
            {isLoadingUsers
              ? <option value="" disabled>Cargando usuarios...</option>
              : usersList.map((u) => (
                <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
              ))}
          </select>
        </div>

        <label className="flex items-center gap-2 text-sm font-medium text-neutral-800 cursor-pointer">
          <input type="checkbox" checked={form.defaultVisibility}
            onChange={(e) => setForm({ ...form, defaultVisibility: e.target.checked })}
            className="h-4 w-4 accent-[var(--color-primary)] cursor-pointer" />
          Visibilidad por defecto para productos nuevos
        </label>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="lista-valid-from" className="block text-sm font-medium text-neutral-800 mb-1.5">Vigencia desde</label>
            <input id="lista-valid-from" type="date" value={form.validFrom}
              onChange={(e) => setForm({ ...form, validFrom: e.target.value })} className={FIELD_CLASS} />
          </div>
          <div>
            <label htmlFor="lista-valid-until" className="block text-sm font-medium text-neutral-800 mb-1.5">Vigencia hasta</label>
            <input id="lista-valid-until" type="date" value={form.validUntil}
              onChange={(e) => setForm({ ...form, validUntil: e.target.value })} className={FIELD_CLASS} />
          </div>
        </div>
      </form>
    </Modal>
  );
}

function CategoryModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (payload: CategoryPayload) => createCategory(payload),
    onSuccess: onSaved,
    onError: (err) => setFormError(getApiErrorMessage(err, 'No se pudo crear la categoria')),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setFormError('El nombre debe tener al menos 2 caracteres');
      return;
    }
    mutation.mutate({ name: trimmed, slug: slugify(trimmed) });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Nueva Categoria"
      size="sm"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" form="create-category-form" loading={mutation.isPending}>Crear</Button>
        </>
      }
    >
      <form id="create-category-form" onSubmit={submit} className="space-y-4">
        {formError && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2.5 text-sm" role="alert">
            {formError}
          </div>
        )}
        <div>
          <label htmlFor="category-name" className="block text-sm font-medium text-neutral-800 mb-1.5">Nombre</label>
          <input id="category-name" type="text" value={name}
            onChange={(e) => setName(e.target.value)} className={FIELD_CLASS} required minLength={2}
            placeholder="Ej: Camaras IP" />
        </div>
        <p className="text-xs text-gray-400">
          El slug se genera automaticamente a partir del nombre.
        </p>
      </form>
    </Modal>
  );
}
