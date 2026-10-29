export type Kind = 'bill' | 'chore' | 'food';
export type Recurrence = 'none' | 'daily' | 'every2days' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly';
export type Event = { id: string; title: string; kind: Kind; date: string; recurrence: Recurrence; until: string; reminder: string; completed: string[]; excluded: string[]; presetId?: string };

export function dateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function parseDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split('-').map(Number);
  const result = new Date(y, m - 1, d, 12);
  return dateString(result) === value ? result : null;
}
export function validate(event: Event): string | null {
  if (!event.title.trim()) return '제목을 입력해 주세요.';
  if (!['bill', 'chore', 'food'].includes(event.kind)) return '유형을 선택해 주세요.';
  if (!parseDate(event.date)) return '올바른 날짜를 입력해 주세요.';
  if (!['none', 'daily', 'every2days', 'weekly', 'biweekly', 'monthly', 'quarterly'].includes(event.recurrence)) return '반복 설정을 확인해 주세요.';
  if (event.recurrence !== 'none' && event.until && (!parseDate(event.until) || event.until < event.date)) return '반복 종료일은 시작일 이후여야 합니다.';
  if (event.reminder && !/^([01]\d|2[0-3]):[0-5]\d$/.test(event.reminder)) return '알림 시간을 확인해 주세요.';
  return null;
}
export function occurs(event: Event, value: string): boolean {
  const start = parseDate(event.date), date = parseDate(value);
  if (!start || !date || value < event.date || (event.recurrence !== 'none' && event.until !== '' && value > event.until) || event.excluded.includes(value)) return false;
  if (event.recurrence === 'none') return value === event.date;
  if (['daily', 'every2days', 'weekly', 'biweekly'].includes(event.recurrence)) {
    const day = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
    const interval = { daily: 1, every2days: 2, weekly: 7, biweekly: 14 }[event.recurrence as 'daily' | 'every2days' | 'weekly' | 'biweekly'];
    return (day(date) - day(start)) % (interval * 86400000) === 0;
  }
  if (event.recurrence === 'quarterly' && ((date.getFullYear() - start.getFullYear()) * 12 + date.getMonth() - start.getMonth()) % 3 !== 0) return false;
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  return date.getDate() === Math.min(start.getDate(), last);
}
export function setCompleted(event: Event, date: string, completed: boolean): Event {
  if (!occurs(event, date)) throw new Error('해당 날짜에 일정이 없습니다.');
  return { ...event, completed: completed ? [...new Set([...event.completed, date])] : event.completed.filter(d => d !== date) };
}
