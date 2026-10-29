import { dateString, type Event, type Recurrence } from './calendar';

export type Category = '주방' | '욕실' | '방/거실' | '세탁/의류' | '가전/점검';
export type Package = '전체' | '초보 자취러' | '꼼꼼 자취러' | '최소주의';
type Preset = { id: string; category: Category; title: string; recurrence: Recurrence; frequency: string; time: string; weekend?: boolean; packages: Package[] };
export const presets: Preset[] = [
  { id: 'KITCHEN_DAILY_DISHES', category: '주방', title: '설거지 하기', recurrence: 'daily', frequency: '매일', time: '20:00', packages: ['초보 자취러', '꼼꼼 자취러', '최소주의'] },
  { id: 'KITCHEN_DAILY_FOOD_WASTE', category: '주방', title: '음식물 쓰레기 비우기', recurrence: 'every2days', frequency: '2일마다', time: '21:00', packages: ['초보 자취러', '꼼꼼 자취러', '최소주의'] },
  { id: 'KITCHEN_MONTHLY_HOOD', category: '주방', title: '주방 후드 필터 청소', recurrence: 'monthly', frequency: '매월', time: '14:00', weekend: true, packages: ['꼼꼼 자취러'] },
  { id: 'BATHROOM_WEEKLY_BASIC', category: '욕실', title: '세면대 & 변기 닦기', recurrence: 'weekly', frequency: '매주', time: '11:00', weekend: true, packages: ['초보 자취러', '꼼꼼 자취러'] },
  { id: 'BATHROOM_WEEKLY_DRAIN', category: '욕실', title: '배수구 머리카락 제거', recurrence: 'weekly', frequency: '매주', time: '11:30', weekend: true, packages: ['꼼꼼 자취러'] },
  { id: 'LIVING_DAILY_VENTILATION', category: '방/거실', title: '창문 환기하기', recurrence: 'daily', frequency: '매일', time: '09:00', packages: ['꼼꼼 자취러'] },
  { id: 'LIVING_WEEKLY_VACUUM', category: '방/거실', title: '바닥 청소기 & 물걸레질', recurrence: 'weekly', frequency: '매주', time: '10:00', weekend: true, packages: ['초보 자취러', '꼼꼼 자취러'] },
  { id: 'LAUNDRY_WEEKLY_WASH', category: '세탁/의류', title: '수건 & 의류 빨래하기', recurrence: 'weekly', frequency: '매주', time: '14:00', weekend: true, packages: ['초보 자취러', '꼼꼼 자취러', '최소주의'] },
  { id: 'LAUNDRY_BIWEEKLY_BEDDING', category: '세탁/의류', title: '침구류 (베개/이불) 세탁', recurrence: 'biweekly', frequency: '2주마다', time: '12:00', weekend: true, packages: ['꼼꼼 자취러'] },
  { id: 'MAINT_MONTHLY_WASHER', category: '가전/점검', title: '세탁기 세탁조 통세척', recurrence: 'monthly', frequency: '매월', time: '16:00', weekend: true, packages: ['꼼꼼 자취러'] },
  { id: 'LIVING_DAILY_TIDY', category: '방/거실', title: '바닥 먼지 간단히 정리하기', recurrence: 'daily', frequency: '매일', time: '20:00', packages: ['꼼꼼 자취러'] },
  { id: 'LIVING_DAILY_TRASH', category: '방/거실', title: '일반 쓰레기 관리', recurrence: 'daily', frequency: '매일', time: '21:00', packages: ['꼼꼼 자취러', '최소주의'] },
  { id: 'LIVING_WEEKLY_RECYCLING', category: '방/거실', title: '분리수거 하기', recurrence: 'weekly', frequency: '매주', time: '10:30', weekend: true, packages: ['꼼꼼 자취러', '최소주의'] },
  { id: 'BATHROOM_MONTHLY_DEEP', category: '욕실', title: '욕실 딥클리닝', recurrence: 'monthly', frequency: '매월', time: '11:00', weekend: true, packages: ['꼼꼼 자취러'] },
  { id: 'KITCHEN_MONTHLY_DRAIN', category: '주방', title: '주방 기름때 & 배수구 청소', recurrence: 'monthly', frequency: '매월', time: '14:00', weekend: true, packages: ['꼼꼼 자취러'] },
  { id: 'KITCHEN_MONTHLY_FRIDGE', category: '주방', title: '냉장고 정리', recurrence: 'monthly', frequency: '매월', time: '15:00', weekend: true, packages: ['꼼꼼 자취러'] },
  { id: 'LIVING_MONTHLY_DUST', category: '방/거실', title: '창틀 & 묵은 먼지 닦기', recurrence: 'monthly', frequency: '매월', time: '10:00', weekend: true, packages: ['꼼꼼 자취러'] },
  { id: 'MAINT_SEASONAL_AC', category: '가전/점검', title: '에어컨 필터 청소', recurrence: 'quarterly', frequency: '3개월마다', time: '14:00', weekend: true, packages: ['꼼꼼 자취러'] },
  { id: 'LAUNDRY_SEASONAL_CLOSET', category: '세탁/의류', title: '옷장 정리 & 제습제 교체', recurrence: 'quarterly', frequency: '3개월마다', time: '14:00', weekend: true, packages: ['꼼꼼 자취러'] },
];
export function presetEvent(preset: Preset, start: Date, reminders: boolean): Event {
  const date = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 12);
  if (preset.weekend) date.setDate(date.getDate() + (6 - date.getDay() + 7) % 7);
  return { id: crypto.randomUUID(), presetId: preset.id, title: preset.title, kind: 'chore', date: dateString(date), recurrence: preset.recurrence, until: '', reminder: reminders ? preset.time : '', completed: [], excluded: [] };
}
