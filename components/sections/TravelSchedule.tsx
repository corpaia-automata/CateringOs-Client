import { firstArray, firstString, type SectionProps } from './types';

export default function TravelSchedule({ data }: SectionProps) {
  const travelRows = firstArray(data, ['travel_schedule', 'travelSchedule', 'logistics.travel_schedule']);
  const roomRows = firstArray(data, ['rooms_schedule', 'roomsSchedule', 'logistics.rooms_schedule']);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-5 text-2xl font-semibold text-slate-950">Travel & Rooms Schedule</h2>
      <ScheduleList title="Travel" rows={travelRows} emptyText="No travel schedule added." />
      <div className="mt-6">
        <ScheduleList title="Rooms" rows={roomRows} emptyText="No rooms schedule added." />
      </div>
    </section>
  );
}

export function RoomsSchedule(props: SectionProps) {
  const roomRows = firstArray(props.data, ['rooms_schedule', 'roomsSchedule', 'logistics.rooms_schedule']);
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <ScheduleList title="Rooms Schedule" rows={roomRows} emptyText="No rooms schedule added." />
    </section>
  );
}

function ScheduleList({ title, rows, emptyText }: { title: string; rows: unknown[]; emptyText: string }) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      {rows.length === 0 ? (
        <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">{emptyText}</p>
      ) : (
        <div className="space-y-3">
          {rows.map((row, index) => (
            <div key={index} className="rounded-xl border border-slate-200 p-4">
              <p className="font-semibold text-slate-900">
                {firstString(row, ['title', 'label', 'location', 'room', 'vehicle'], `${title} ${index + 1}`)}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {firstString(row, ['time', 'date', 'schedule', 'notes', 'description'], 'Details pending')}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
