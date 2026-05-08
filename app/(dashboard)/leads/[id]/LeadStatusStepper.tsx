'use client';

interface LeadStatusStepperProps {
  status: string;
  isQuotationLocked?: boolean;
  convertedEventId?: string | null;
  convertedEventStatus?: string | null;
}

function OrbitNode({
  state,
  style,
  isFinal,
  isLost,
}: {
  state: 'done' | 'active' | 'pending';
  style: { border: string; color: string };
  isFinal?: boolean;
  isLost: boolean;
}) {
  const symbol =
    isFinal && isLost ? '×' : state === 'done' ? '✓' : state === 'active' ? '•' : '◌';
  return (
    <span
      className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 bg-white text-[11px] font-bold"
      style={{ borderColor: style.border, color: style.color }}
    >
      <span
        className="absolute inset-[5px] rounded-full border"
        style={{
          borderColor: style.border,
          opacity: state === 'pending' ? 0.5 : 0.9,
        }}
      />
      {state === 'active' && (
        <span
          className="absolute inset-[2px] rounded-full border border-dashed animate-spin"
          style={{
            borderColor: style.border,
            opacity: 0.9,
            animationDuration: '2.2s',
          }}
        />
      )}
      <span className="relative z-10">{symbol}</span>
    </span>
  );
}

export default function LeadStatusStepper({
  status,
  isQuotationLocked = false,
  convertedEventId,
  convertedEventStatus,
}: LeadStatusStepperProps) {
  const normalized = String(status).toUpperCase();
  const isLost = normalized === 'LOST';
  const isSuccess =
    !isLost &&
    (normalized === 'SUCCESS' ||
      String(convertedEventStatus ?? '').toUpperCase() === 'CONFIRMED' ||
      Boolean(convertedEventId));

  const isQuotedStage = !isSuccess && !isLost && isQuotationLocked;
  const isCreatedStage = !isSuccess && !isLost && !isQuotationLocked;

  const createdState: 'done' | 'active' | 'pending' = isCreatedStage ? 'active' : 'done';
  const quotedState: 'done' | 'active' | 'pending' = isQuotedStage
    ? 'active'
    : isSuccess || isLost
      ? 'done'
      : 'pending';
  const finalState: 'done' | 'active' | 'pending' = isSuccess || isLost ? 'done' : 'pending';

  const finalLabel = isSuccess ? 'WON' : isLost ? 'LOST' : 'DECISION';

  function stepStyles(stepState: 'done' | 'active' | 'pending', isFinal = false) {
    if (stepState === 'done') {
      if (isFinal && isLost) return { border: '#EF4444', color: '#EF4444', text: '#DC2626' };
      return { border: '#10B981', color: '#10B981', text: '#0F172A' };
    }
    if (stepState === 'active') {
      return { border: '#3B82F6', color: '#3B82F6', text: '#0F172A' };
    }
    return { border: '#CBD5E1', color: '#CBD5E1', text: '#94A3B8' };
  }

  const s1 = stepStyles(createdState);
  const s2 = stepStyles(quotedState);
  const s3 = stepStyles(finalState, true);
  const connector12 = isQuotedStage || isSuccess || isLost ? '#10B981' : '#CBD5E1';
  const connector23 = isSuccess ? '#10B981' : isLost ? '#9CA3AF' : '#CBD5E1';

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 sm:px-6">
      <div className="mx-auto grid w-full max-w-2xl grid-cols-[auto_1fr_auto_1fr_auto] items-start gap-x-1 gap-y-2">
        <div className="flex flex-col items-center gap-2">
          <OrbitNode state={createdState} style={s1} isLost={isLost} />
          <span className="text-center text-[11px] font-semibold uppercase tracking-wide" style={{ color: s1.text }}>
            CREATED
          </span>
        </div>
        <div className="h-0.5 min-w-[12px] rounded-full" style={{ marginTop: 14, backgroundColor: connector12 }} />
        <div className="flex flex-col items-center gap-2">
          <OrbitNode state={quotedState} style={s2} isLost={isLost} />
          <span className="text-center text-[11px] font-semibold uppercase tracking-wide" style={{ color: s2.text }}>
            QUOTED
          </span>
        </div>
        <div className="h-0.5 min-w-[12px] rounded-full" style={{ marginTop: 14, backgroundColor: connector23 }} />
        <div className="flex flex-col items-center gap-2">
          <OrbitNode state={finalState} style={s3} isFinal isLost={isLost} />
          <span className="text-center text-[11px] font-semibold uppercase tracking-wide" style={{ color: s3.text }}>
            {finalLabel}
          </span>
        </div>
      </div>
    </div>
  );
}
