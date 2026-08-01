import type { ImportStep } from '../types/import.types';

interface ImportStepperProps {
  currentStep: ImportStep;
}

const STEPS: { key: ImportStep; label: string; number: number }[] = [
  { key: 'upload', label: 'Subir', number: 1 },
  { key: 'headers', label: 'Encabezados', number: 2 },
  { key: 'mapping', label: 'Mapeo', number: 3 },
  { key: 'validation', label: 'Validacion', number: 4 },
  { key: 'confirm', label: 'Confirmar', number: 5 },
  { key: 'execution', label: 'Ejecutando', number: 6 },
  { key: 'result', label: 'Resultado', number: 7 },
];

const STEP_ORDER: ImportStep[] = STEPS.map((s) => s.key);

function getStepState(stepKey: ImportStep, currentStep: ImportStep): 'completed' | 'current' | 'pending' {
  const currentIndex = STEP_ORDER.indexOf(currentStep);
  const stepIndex = STEP_ORDER.indexOf(stepKey);

  if (stepIndex < currentIndex) return 'completed';
  if (stepIndex === currentIndex) return 'current';
  return 'pending';
}

export default function ImportStepper({ currentStep }: ImportStepperProps) {
  return (
    <nav aria-label="Progreso de importacion">
      <ol className="flex items-center">
        {STEPS.map((step, index) => {
          const state = getStepState(step.key, currentStep);
          const isLast = index === STEPS.length - 1;

          return (
            <li key={step.key} className="flex items-center flex-1 last:flex-none">
              <div className="flex items-center gap-2">
                <span
                  className={`
                    flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium border-2 transition-colors
                    ${state === 'completed'
                      ? 'bg-emerald-500 border-emerald-500 text-white'
                      : state === 'current'
                        ? 'bg-brand-primary border-brand-primary text-white'
                        : 'bg-white border-neutral-300 text-neutral-400'
                    }
                  `}
                >
                  {state === 'completed' ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    step.number
                  )}
                </span>
                <span
                  className={`
                    text-xs font-medium whitespace-nowrap
                    ${state === 'completed'
                      ? 'text-emerald-600'
                      : state === 'current'
                        ? 'text-brand-primary'
                        : 'text-neutral-400'
                    }
                  `}
                >
                  {step.label}
                </span>
              </div>

              {!isLast && (
                <div
                  className={`
                    flex-1 h-0.5 mx-2 rounded
                    ${state === 'completed' ? 'bg-emerald-500' : 'bg-neutral-200'}
                  `}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
