import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { ImportWizardState, ImportStep, ImportPreviewResult, ImportExecutionResult, SystemField } from '../types/import.types';

export const IMPORT_WIZARD_STORAGE_KEY = 'gs-import-wizard';

export function hasPersistedImportState(): boolean {
  try {
    const raw = sessionStorage.getItem(IMPORT_WIZARD_STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    const step = parsed?.state?.currentStep;
    return typeof step === 'string' && step !== 'upload' && step !== 'execution' && step !== 'result';
  } catch {
    return false;
  }
}

interface ImportStore extends ImportWizardState {
  setStep: (step: ImportStep) => void;
  nextStep: () => void;
  prevStep: () => void;
  setFile: (file: File, buffer: ArrayBuffer) => void;
  clearFile: () => void;
  setPreview: (preview: ImportPreviewResult) => void;
  setExecutionResult: (result: ImportExecutionResult) => void;
  setColumnMappings: (mappings: Array<{ sourceColumn: string; targetField: SystemField }>) => void;
  updateMapping: (sourceColumn: string, targetField: SystemField) => void;
  setIvaMode: (mode: 'with_iva' | 'without_iva' | 'mixed') => void;
  setListaId: (listaId: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
  isRestored: boolean;
  dismissRestored: () => void;
}

const STEPS: ImportStep[] = ['upload', 'headers', 'mapping', 'validation', 'confirm', 'execution', 'result'];

const initialState: ImportWizardState = {
  currentStep: 'upload',
  file: null,
  fileBuffer: null,
  fileName: '',
  preview: null,
  executionResult: null,
  columnMappings: [],
  ivaMode: 'with_iva',
  listaId: null,
  isLoading: false,
  error: null,
};

export const useImportStore = create<ImportStore>()(
  persist(
    (set, get) => ({
      ...initialState,
      isRestored: false,

      setStep: (step) => set({ currentStep: step }),

      nextStep: () => {
        const { currentStep } = get();
        const idx = STEPS.indexOf(currentStep);
        if (idx < STEPS.length - 1) set({ currentStep: STEPS[idx + 1] });
      },

      prevStep: () => {
        const { currentStep } = get();
        const idx = STEPS.indexOf(currentStep);
        if (idx > 0) set({ currentStep: STEPS[idx - 1] });
      },

      setFile: (file, buffer) => set({ file, fileBuffer: buffer, fileName: file.name }),
      clearFile: () => set({ file: null, fileBuffer: null, fileName: '', preview: null, executionResult: null }),

      setPreview: (preview) => set({ preview }),
      setExecutionResult: (result) => set({ executionResult: result }),

      setColumnMappings: (mappings) => set({ columnMappings: mappings }),
      updateMapping: (sourceColumn, targetField) => {
        const { columnMappings } = get();
        const existing = columnMappings.find(m => m.sourceColumn === sourceColumn);
        if (existing) {
          set({ columnMappings: columnMappings.map(m => m.sourceColumn === sourceColumn ? { ...m, targetField } : m) });
        } else {
          set({ columnMappings: [...columnMappings, { sourceColumn, targetField }] });
        }
      },
      setIvaMode: (mode) => set({ ivaMode: mode }),
      setListaId: (listaId) => set({ listaId }),

      setLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error }),

      reset: () => set({ ...initialState, isRestored: false }),

      dismissRestored: () => set({ isRestored: false }),
    }),
    {
      name: 'gs-import-wizard',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        currentStep: state.currentStep,
        fileName: state.fileName,
        columnMappings: state.columnMappings,
        ivaMode: state.ivaMode,
        preview: state.preview,
      }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Record<string, unknown> | undefined;
        if (!persisted) return currentState;
        if (persisted.currentStep === 'execution' || persisted.currentStep === 'result') {
          return currentState;
        }
        if (persisted.currentStep === 'upload' && !persisted.fileName) {
          return currentState;
        }
        return { ...currentState, ...persisted, isRestored: true };
      },
    },
  ),
);
