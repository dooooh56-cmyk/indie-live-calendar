import React, { useEffect, useRef, useState } from 'react';
import { dateString, occurs, setCompleted, validate, type Event, type Kind, type Recurrence } from './calendar';
import { reminderStatus } from './reminders';
import { presets, presetEvent, type Package, type Category } from './presets';

const labels: Record<Kind, string> = { bill: '납부', chore: '집안일', food: '식재료' };
const today = () => dateString(new Date());
const blank = (date: string): Event => ({ id: '', title: '', kind: 'chore', date, recurrence: 'none', until: '', reminder: '', completed: [], excluded: [] });
const storageKey = 'honjasallim-events-v1';
function load(): Event[] {
  const raw = localStorage.getItem(storageKey);
  if (!raw) return [];
  const data: unknown = JSON.parse(raw);
  if (!Array.isArray(data) || data.some(e => !e || typeof e.id !== 'string' || !Array.isArray(e.completed) || !Array.isArray(e.excluded) || validate(e))) throw new Error('저장된 일정을 읽을 수 없습니다.');
  return data as Event[];
}
export function App() {
  const [events, setEvents] = useState<Event[]>([]);
  const [view, setView] = useState<'calendar' | 'presets'>('calendar');
  const [presetPackage, setPresetPackage] = useState<Package>('전체');
  const [category, setCategory] = useState<Category | '전체'>('전체');
  const [selectedPresets, setSelectedPresets] = useState<string[]>([]);
  const [presetReminders, setPresetReminders] = useState(false);
  const [currentDate, setCurrentDate] = useState(today);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const notificationFailed = useRef(false);
  const [selected, setSelected] = useState(today);
  const [month, setMonth] = useState(() => today().slice(0, 7));
  const [form, setForm] = useState<Event | null>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  function openForm(event: Event) { previousFocus.current = document.activeElement as HTMLElement; setError(''); setForm(event); }
  useEffect(() => { if (form) return () => previousFocus.current?.focus(); }, [!!form]);
  function dialogKeys(e: React.KeyboardEvent<HTMLElement>) {
    if (e.key === 'Escape') { e.preventDefault(); setForm(null); return; }
    if (e.key !== 'Tab') return;
    const elements = e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled)');
    const first = elements[0], last = elements[elements.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
  }
  useEffect(() => { try { setEvents(load()); setReady(true); } catch { setError('저장된 일정을 읽을 수 없습니다. 브라우저 저장 공간을 확인해 주세요.'); } }, []);
  function save(next: Event[]): boolean {
    try { localStorage.setItem(storageKey, JSON.stringify(next)); setEvents(next); setError(''); return true; }
    catch { setError('저장하지 못했습니다. 브라우저 저장 공간을 확인해 주세요.'); return false; }
  }
  useEffect(() => {
    // 브라우저가 열려 있는 동안에만 알림을 확인한다.
    const check = () => {
      const now = new Date(), date = dateString(now);
      setCurrentDate(date);
      if (!('Notification' in window) || Notification.permission !== 'granted') return;
      const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      for (const event of events) {
        if (!event.reminder || event.reminder !== time || !occurs(event, date) || event.completed.includes(date)) continue;
        const key = `honjasallim-notified:${event.id}:${date}:${time}`;
        try { if (!sessionStorage.getItem(key)) { new Notification(event.title, { body: `${labels[event.kind]} 일정이 있어요.` }); sessionStorage.setItem(key, '1'); } }
        catch { notificationFailed.current = true; setNotice('알림을 표시하지 못했습니다. 일정은 달력에서 확인할 수 있습니다.'); }
      }
    };
    check(); const timer = window.setInterval(check, 15000); return () => window.clearInterval(timer);
  }, [events]);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (!form) return;
    const message = validate(form); if (message) { setError(message); return; }
    const updated = { ...form, title: form.title.trim(), until: form.recurrence === 'none' ? '' : form.until, id: form.id || crypto.randomUUID() };
    const next = form.id ? events.map(item => item.id === form.id ? updated : item) : [...events, updated];
    notificationFailed.current = false;
    if (!save(next)) return;
    setForm(null); setSelected(updated.date); setMonth(updated.date.slice(0, 7));
    if (updated.reminder) {
      const status = await reminderStatus('Notification' in window ? Notification : undefined);
      if (!notificationFailed.current) setNotice(status);
    } else setNotice('일정을 저장했습니다.');
  }
  async function addPresets() {
    const existing = new Set(events.map(event => event.presetId));
    const chosen = presets.filter(preset => selectedPresets.includes(preset.id) && !existing.has(preset.id));
    if (!chosen.length) return;
    const next = [...events, ...chosen.map(preset => presetEvent(preset, new Date(), presetReminders))];
    notificationFailed.current = false;
    if (!save(next)) return;
    setSelectedPresets([]); setView('calendar');
    if (presetReminders) {
      const status = await reminderStatus('Notification' in window ? Notification : undefined);
      if (!notificationFailed.current) setNotice(`${chosen.length}개 일정을 추가했습니다. ${status}`);
    } else setNotice(`${chosen.length}개 집안일을 추가했습니다.`);
  }
  function remove(event: Event, date: string, single: boolean) {
    if (!window.confirm(single ? '이 날짜의 일정만 삭제할까요?' : '이 일정을 모두 삭제할까요?')) return;
    save(single ? events.map(item => item.id === event.id ? { ...item, excluded: [...new Set([...item.excluded, date])], completed: item.completed.filter(d => d !== date) } : item) : events.filter(item => item.id !== event.id));
  }
  const [year, monthNumber] = month.split('-').map(Number);
  const first = new Date(year, monthNumber - 1, 1), days = new Date(year, monthNumber, 0).getDate();
  const selectedEvents = events.filter(e => occurs(e, selected));
  const todayEvents = events.filter(e => occurs(e, currentDate) && !e.completed.includes(currentDate));
  function changeMonth(offset: number) { const date = dateString(new Date(year, monthNumber - 1 + offset, 1)); setMonth(date.slice(0, 7)); setSelected(date); }
  function list(items: Event[], date: string) {
    if (!items.length) return <p className="empty">예정된 일정이 없어요.</p>;
    return <ul className="event-list">{items.map(event => <li key={event.id}>
      <label className="check"><input type="checkbox" checked={event.completed.includes(date)} onChange={e => save(events.map(item => item.id === event.id ? setCompleted(item, date, e.target.checked) : item))} /><span className={event.completed.includes(date) ? 'done' : ''}>{event.title}</span></label>
      <span className={`badge ${event.kind}`}>{labels[event.kind]}</span>
      <div className="actions"><button onClick={() => openForm(event)}>수정</button><button onClick={() => remove(event, date, false)}>전체 삭제</button>{event.recurrence !== 'none' && <button onClick={() => remove(event, date, true)}>이날만 삭제</button>}</div>
    </li>)}</ul>;
  }
  return <main className="shell"><header><div><p className="eyebrow">나의 생활을 가볍게</p><h1>혼자살림 <span>달력</span></h1><p className="subtitle">놓치기 쉬운 일들을 한곳에 모아두세요.</p></div><button className="primary" disabled={!ready} onClick={() => openForm(blank(selected))}>+ 일정 추가</button></header>
    {error && <p className="message error" role="alert">{error}</p>}{notice && <p className="message" role="status">{notice} <button onClick={() => setNotice('')} aria-label="알림 닫기">×</button></p>}
    <nav className="view-tabs" aria-label="화면 선택"><button type="button" className={view === 'calendar' ? 'active' : ''} aria-current={view === 'calendar' ? 'page' : undefined} onClick={() => setView('calendar')}>달력</button><button type="button" className={view === 'presets' ? 'active' : ''} aria-current={view === 'presets' ? 'page' : undefined} onClick={() => setView('presets')}>집안일 프리셋</button></nav>
    {view === 'presets' ? <section className="preset-panel"><div className="preset-heading"><div><p className="eyebrow">CHORE PRESETS</p><h2>나에게 맞는 집안일을 골라보세요</h2><p className="subtitle">필요한 일만 선택하면 추천 주기로 달력에 추가돼요.</p></div></div>
      <div className="filters"><div><h3>자취 유형</h3><div className="chips">{(['전체', '초보 자취러', '꼼꼼 자취러', '최소주의'] as Package[]).map(item => <button key={item} type="button" className={presetPackage === item ? 'active' : ''} aria-pressed={presetPackage === item} onClick={() => setPresetPackage(item)}>{item}</button>)}</div></div>
      <div><h3>카테고리</h3><div className="chips">{(['전체', '주방', '욕실', '방/거실', '세탁/의류', '가전/점검'] as const).map(item => <button key={item} type="button" className={category === item ? 'active' : ''} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>)}</div></div></div>
      <div className="preset-list">{presets.filter(preset => (category === '전체' || preset.category === category) && (presetPackage === '전체' || preset.packages.includes(presetPackage))).map(preset => { const added = events.some(event => event.presetId === preset.id); return <label key={preset.id} className={`preset-item ${added ? 'is-added' : ''}`}><input type="checkbox" disabled={added || !ready} checked={selectedPresets.includes(preset.id) || added} onChange={e => setSelectedPresets(e.target.checked ? [...selectedPresets, preset.id] : selectedPresets.filter(id => id !== preset.id))} /><span className="preset-copy"><span className="preset-category">{preset.category}</span><strong>{preset.title}</strong><span className="preset-meta">{preset.frequency} · {preset.weekend ? '토요일 ' : ''}{preset.time}{added ? ' · 추가됨' : ''}</span></span></label>; })}</div>
      <div className="preset-footer"><div><label className="reminder-toggle"><input type="checkbox" checked={presetReminders} onChange={e => setPresetReminders(e.target.checked)} /> 추천 시간에 알림 설정</label><p className="hint">주말 일정은 다가오는 토요일부터 시작해요. 주기와 알림은 추가 후 수정할 수 있어요.</p><p className="hint">알림은 앱을 열어 둔 동안만 시도되며 백그라운드에서는 놓칠 수 있어요.</p></div><button type="button" className="primary" disabled={!ready || selectedPresets.length === 0} onClick={addPresets}>선택한 {selectedPresets.length}개 추가</button></div>
    </section> : <div className="layout"><section className="card calendar"><div className="section-head"><div><p className="eyebrow">MY CALENDAR</p><h2>{year}년 {monthNumber}월</h2></div><div className="month-nav"><button onClick={() => changeMonth(-1)} aria-label="이전 달">‹</button><button onClick={() => { setMonth(today().slice(0, 7)); setSelected(today()); }}>오늘</button><button onClick={() => changeMonth(1)} aria-label="다음 달">›</button></div></div>
      <div className="grid weekdays">{['일', '월', '화', '수', '목', '금', '토'].map(d => <span key={d}>{d}</span>)}</div><div className="grid days">{Array.from({ length: first.getDay() }, (_, i) => <span key={`blank${i}`} />)}{Array.from({ length: days }, (_, i) => { const date = `${month}-${String(i + 1).padStart(2, '0')}`; const kinds = [...new Set(events.filter(e => occurs(e, date)).map(e => e.kind))]; return <button key={date} className={`${date === selected ? 'selected' : ''} ${date === currentDate ? 'today' : ''}`} onClick={() => setSelected(date)} aria-label={`${date}${kinds.length ? `, 일정 ${events.filter(e => occurs(e, date)).length}개` : ''}`} aria-pressed={date === selected}><span>{i + 1}</span><span className="dots">{kinds.map(kind => <i key={kind} className={kind} />)}</span></button>; })}</div><div className="legend">{(Object.keys(labels) as Kind[]).map(kind => <span key={kind}><i className={kind} /> {labels[kind]}</span>)}</div></section>
      <aside><section className="card"><p className="eyebrow">TODAY</p><h2>오늘 할 일 <small>{todayEvents.length}</small></h2>{list(todayEvents, currentDate)}</section><section className="card"><p className="eyebrow">SELECTED DAY</p><h2>{selected.slice(5).replace('-', '월 ')}일의 일정</h2>{list(selectedEvents, selected)}</section></aside></div>}
    {form && <div className="overlay" onClick={e => { if (e.target === e.currentTarget) setForm(null); }}><section className="dialog" onKeyDown={dialogKeys} role="dialog" aria-modal="true" aria-labelledby="form-title"><div className="section-head"><h2 id="form-title">{form.id ? '일정 수정' : '새 일정'}</h2><button onClick={() => setForm(null)} aria-label="닫기">×</button></div><form onSubmit={submit}><label>일정 이름<input autoFocus required maxLength={100} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="예: 관리비 납부" /></label><label>유형<select value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value as Kind })}>{(Object.keys(labels) as Kind[]).map(k => <option key={k} value={k}>{labels[k]}</option>)}</select></label><label>날짜<input type="date" required value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></label><label>반복<select value={form.recurrence} onChange={e => setForm({ ...form, recurrence: e.target.value as Recurrence })}><option value="none">반복 안 함</option><option value="daily">매일</option><option value="every2days">2일마다</option><option value="weekly">매주</option><option value="biweekly">2주마다</option><option value="monthly">매월</option><option value="quarterly">3개월마다</option></select></label>{form.recurrence !== 'none' && <><label>반복 종료일 <span className="optional">선택</span><input type="date" min={form.date} value={form.until} onChange={e => setForm({ ...form, until: e.target.value })} /></label>{(form.recurrence === 'monthly' || form.recurrence === 'quarterly') && <p className="hint">해당 날짜가 없는 달에는 마지막 날에 표시돼요.</p>}</>}<label>알림 시간 <span className="optional">선택 · 당일</span><input type="time" value={form.reminder} onChange={e => setForm({ ...form, reminder: e.target.value })} /></label><p className="hint">알림은 앱을 열어 둔 동안만 시도돼요. 백그라운드에서는 놓칠 수 있어요.</p>{error && <p className="error" role="alert">{error}</p>}<div className="form-actions"><button type="button" onClick={() => setForm(null)}>취소</button><button className="primary" type="submit">저장하기</button></div></form></section></div>}
    <footer>일정은 이 브라우저에만 저장됩니다.</footer></main>;
}

