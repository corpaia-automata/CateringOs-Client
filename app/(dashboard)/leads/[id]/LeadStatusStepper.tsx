'use client';

interface LeadStatusStepperProps {
  status: string;
}

const STEPS = ['PLANNING', 'QUOTED', 'CONFIRMED'] as const;

const STEP_LABELS: Record<(typeof STEPS)[number], string> = {
  PLANNING: 'Planning',
  QUOTED: 'Quoted',
  CONFIRMED: 'Confirmed',
};

const STATUS_TO_INDEX: Record<string, number> = {
  PLANNING: 0,
  QUOTED: 1,
  CONFIRMED: 2,
};

export default function LeadStatusStepper({ status }: LeadStatusStepperProps) {
  const currentIndex = STATUS_TO_INDEX[String(status).toUpperCase()] ?? 0;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 sm:px-6">
      <div className="flex items-start">
        {STEPS.map((step, idx) => {
          const isCompleted = idx < currentIndex;
          const isCurrent = idx === currentIndex;
          const isFuture = idx > currentIndex;

          return (
            <div key={step} className="flex flex-1 items-center">
              <div className="flex min-w-0 flex-col items-center">
                <div
                  className={[
                    'flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition-all',
                    isCompleted ? 'bg-blue-600 text-white' : '',
                    isCurrent ? 'border-2 border-blue-600 bg-blue-600 text-white shadow-[0_0_0_4px_rgba(37,99,235,0.16)]' : '',
                    isFuture ? 'bg-slate-100 text-slate-500' : '',
                  ].join(' ')}
                >
                  {idx + 1}
                </div>
                <span
                  className={[
                    'mt-2 text-xs sm:text-sm',
                    isCompleted || isCurrent ? 'font-semibold text-slate-900' : 'font-medium text-slate-500',
                  ].join(' ')}
                >
                  {STEP_LABELS[step]}
                </span>
              </div>

              {idx < STEPS.length - 1 && (
                <div className="mx-2 mt-4 h-[2px] flex-1 rounded-full bg-slate-200 sm:mx-3">
                  <div
                    className={[
                      'h-full rounded-full transition-all',
                      idx < currentIndex ? 'w-full bg-blue-600' : 'w-0',
                    ].join(' ')}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

