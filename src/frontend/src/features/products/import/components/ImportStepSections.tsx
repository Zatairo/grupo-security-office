import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useImportStore } from '../store/import.store';
import { fetchCategories } from '../../../../services/settings.service';
import { getApiErrorMessage } from '../../../../lib/apiError';
import { Alert, Button } from '../../../../components/ui';
import type { ImportSection } from '../types/import.types';
import { detectSectionValues, buildSectionsFromValues, normalizeSectionName } from '../utils/section-detection';

const FIELD_CLASS =
  'w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-focus-ring)] focus:border-[var(--color-primary)] text-sm';

export default function ImportStepSections() {
  const columnMappings = useImportStore((s) => s.columnMappings);
  const preview = useImportStore((s) => s.preview);
  const fileBuffer = useImportStore((s) => s.fileBuffer);
  const sections = useImportStore((s) => s.sections);
  const setSections = useImportStore((s) => s.setSections);
  const updateSection = useImportStore((s) => s.updateSection);
  const mergeSections = useImportStore((s) => s.mergeSections);
  const nextStep = useImportStore((s) => s.nextStep);

  const [isDetecting, setIsDetecting] = useState(false);
  const [detectedForColumn, setDetectedForColumn] = useState<string | null>(null);
  const [mergeSelected, setMergeSelected] = useState<Set<string>>(() => new Set());

  const categorySourceColumn = useMemo(
    () => columnMappings.find((m) => m.targetField === 'category')?.sourceColumn ?? null,
    [columnMappings],
  );

  const categoriesQuery = useQuery({ queryKey: ['categories'], queryFn: fetchCategories });
  const categories = categoriesQuery.data ?? [];

  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of categories) map.set(normalizeSectionName(c.name), c.id);
    return map;
  }, [categories]);

  useEffect(() => {
    if (!categorySourceColumn) return;
    if (detectedForColumn === categorySourceColumn) return;

    let cancelled = false;
    setIsDetecting(true);

    const run = async () => {
      const columnInfo = preview?.columnValues?.[categorySourceColumn];
      const values = await detectSectionValues(fileBuffer, categorySourceColumn, columnInfo);
      if (cancelled) return;
      setSections(buildSectionsFromValues(values, categories));
      setDetectedForColumn(categorySourceColumn);
      setIsDetecting(false);
    };

    run().catch(() => {
      if (!cancelled) setIsDetecting(false);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categorySourceColumn, detectedForColumn, fileBuffer, preview, categories, setSections]);

  const existsByKey = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const s of sections) map.set(s.key, categoryMap.has(normalizeSectionName(s.name)));
    return map;
  }, [sections, categoryMap]);

  const selectedCount = sections.filter((s) => s.selected).length;
  const newCount = sections.filter((s) => s.selected && !(existsByKey.get(s.key) ?? s.exists)).length;
  const existsCount = sections.filter((s) => s.selected && (existsByKey.get(s.key) ?? s.exists)).length;
  const canContinue = sections.length > 0;

  const toggleMergeSelection = (key: string) => {
    setMergeSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleMerge = () => {
    const keys = Array.from(mergeSelected);
    const targets = sections.filter((s) => keys.includes(s.key));
    if (targets.length < 2) return;
    const mergedName = targets[0]?.name ?? '';
    const norm = normalizeSectionName(mergedName);
    const matchId = categoryMap.get(norm);
    const merged: ImportSection = {
      key: `merged-${Date.now()}`,
      values: targets.flatMap((t) => t.values),
      name: mergedName,
      count: targets.reduce((acc, t) => acc + t.count, 0),
      exists: Boolean(matchId),
      existingCategoryId: matchId,
      selected: true,
      original: false,
    };
    mergeSections(keys, merged);
    setMergeSelected(new Set());
  };

  const categoriesError = categoriesQuery.error
    ? getApiErrorMessage(categoriesQuery.error, 'No se pudieron cargar las categorías')
    : null;

  if (!categorySourceColumn) {
    return (
      <div className="flex flex-col gap-5">
        <div>
          <h2 className="text-lg font-semibold text-security-900">Secciones de la importacion</h2>
          <p className="mt-1 text-sm text-gray-500">
            El paso de secciones detecta las categorías únicas que trae el archivo para confirmar,
            renombrar, fusionar o descartar.
          </p>
        </div>
        <Alert variant="warning">
          El archivo no tiene una columna mapeada a <strong>Categoría</strong>. Vuelve al paso de
          mapeo y asigna una columna al campo "Categoría" para detectar las secciones.
        </Alert>
        <div className="flex justify-end">
          <Button variant="secondary" onClick={nextStep}>Continuar sin secciones</Button>
        </div>
      </div>
    );
  }

  if (isDetecting || categoriesQuery.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="h-5 bg-neutral-100 rounded animate-pulse w-1/3"></div>
        <div className="h-4 bg-neutral-100 rounded animate-pulse w-2/3"></div>
        <div className="h-24 bg-neutral-100 rounded-lg animate-pulse"></div>
        <p className="text-sm text-gray-400">Detectando secciones del archivo...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-security-900">Secciones de la importacion</h2>
        <p className="mt-1 text-sm text-gray-500">
          Categorías únicas detectadas en la columna <strong>{categorySourceColumn}</strong> del
          archivo. Confirma cuáles se crean, renómbralas, fúndelas o descártalas. Las que ya existen
          en la web se reutilizan.
        </p>
      </div>

      {categoriesError && (
        <Alert variant="warning">
          No se pudieron cargar las categorías existentes: {categoriesError}. Las secciones se
          tratarán como nuevas.
        </Alert>
      )}

      <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
        {sections.map((section) => {
          const sectionExists = existsByKey.get(section.key) ?? section.exists;
          return (
            <div
              key={section.key}
              className="px-4 py-3 flex items-center gap-3 bg-white"
              data-testid="import-section-row"
            >
              <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700" title={section.selected ? 'Quitar de la importacion' : 'Incluir seccion'}>
                <input
                  type="checkbox"
                  checked={section.selected}
                  onChange={(e) => updateSection(section.key, { selected: e.target.checked })}
                  className="h-4 w-4 accent-[var(--color-primary)] cursor-pointer"
                />
                <span className="text-xs">{sectionExists ? 'Reutilizar' : 'Crear'}</span>
              </label>

              <input
                type="text"
                value={section.name}
                onChange={(e) => {
                  const name = e.target.value;
                  const normalized = normalizeSectionName(name);
                  updateSection(section.key, {
                    name,
                    exists: categoryMap.has(normalized),
                    existingCategoryId: categoryMap.get(normalized),
                  });
                }}
                className={`${FIELD_CLASS} flex-1`}
                aria-label={`Nombre de la seccion ${section.name}`}
              />

              <span className="text-xs text-gray-400 whitespace-nowrap">
                {section.count} fila(s)
              </span>

              {sectionExists ? (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 whitespace-nowrap">
                  ya existe (se reutiliza)
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 whitespace-nowrap">
                  nueva
                </span>
              )}

              {!section.original && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700 whitespace-nowrap">
                  fusionada
                </span>
              )}

              <label className="flex items-center gap-1.5 cursor-pointer text-xs text-gray-500 whitespace-nowrap" title="Seleccionar para fusionar">
                <input
                  type="checkbox"
                  checked={mergeSelected.has(section.key)}
                  onChange={() => toggleMergeSelection(section.key)}
                  className="h-4 w-4 accent-purple-600 cursor-pointer"
                />
                Fusionar
              </label>
            </div>
          );
        })}
      </div>

      {sections.length === 0 && (
        <Alert variant="info">
          No se detectaron secciones en la columna <strong>{categorySourceColumn}</strong>. Verifica
          que la columna mapeada contenga nombres de categorías.
        </Alert>
      )}

      <div className="flex items-center justify-between gap-4">
        <div className="text-sm text-gray-600">
          <strong className="text-gray-900">{newCount}</strong> seccion(es) nueva(s) se crearán,{' '}
          <strong className="text-gray-900">{existsCount}</strong> ya existen
          {selectedCount !== sections.length && (
            <span className="text-gray-400"> · {sections.length - selectedCount} descartada(s)</span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            disabled={mergeSelected.size < 2}
            onClick={handleMerge}
          >
            Fusionar {mergeSelected.size >= 2 ? `(${mergeSelected.size})` : ''}
          </Button>
        </div>
      </div>

      {selectedCount === 0 && sections.length > 0 && (
        <Alert variant="warning">
          No crearás ninguna sección nueva. Los productos del archivo quedarán con la categoría por
          defecto ("Sin categoría").
        </Alert>
      )}

      <div className="flex justify-end">
        <Button disabled={!canContinue} onClick={nextStep}>
          Continuar
        </Button>
      </div>
    </div>
  );
}