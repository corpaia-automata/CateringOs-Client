export const EVENT_TYPES = [
  'Wedding Reception',
  'Nikkah',
  'Salkaram',
  'Family Meet',
  'Meeting',
  'Engagement',
  'Corporate Event',
  'Get-Together',
  'Birthday Party',
  'Conference',
  'Other',
] as const;

export const SERVICE_TYPES = [
  'BUFFET',
  'BOX_COUNTER',
  'TABLE_SERVICE',
  'OTHER',
] as const;

export const STATUS_COLORS: Record<string, string> = {
  NEW: 'blue',
  QUALIFIED: 'purple',
  FOLLOW_UP: 'orange',
  REJECTED: 'red',
};

export const EVENT_STATUS_COLORS: Record<string, string> = {
  DRAFT: 'gray',
  CONFIRMED: 'teal',
  IN_PROGRESS: 'orange',
  COMPLETED: 'green',
  CANCELLED: 'red',
};
