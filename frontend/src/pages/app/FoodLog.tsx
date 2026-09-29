import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Camera, ChevronRight, CircleX, Flame, Search, UtensilsCrossed } from 'lucide-react';
import { api } from '../../lib/api';
import { EmptyState, ErrorState, LoadingState, NutrientPill, PageHeading, errorMessage, formatDate, localISODate, number, rounded } from './ui';

type FoodLogEntry = {
  id: number;
  food_name: string;
  image_path: string | null;
  image_url?: string | null;
  log_date: string;
  created_at: string;
  caloric_value: number;
  protein: number;
  carbohydrates: number;
  fat: number;
  dietary_fiber?: number;
  sugars?: number;
  saturated_fats?: number;
  sodium?: number;
  potassium?: number;
  iron?: number;
  calcium?: number;
  vitamin_c?: number;
};

export default function FoodLog() {
  const [date, setDate] = useState(localISODate());
  const [allDates, setAllDates] = useState(false);
  const [logs, setLogs] = useState<FoodLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<FoodLogEntry | null>(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    const path = allDates ? '/api/food-logs' : `/api/food-logs?date=${date}`;
    api<FoodLogEntry[]>(path).then((items) => { if (active) setLogs(items); }).catch((cause) => { if (active) setError(errorMessage(cause)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [allDates, date, refresh]);

  useEffect(() => {
    if (!selected) return;
    function onEscape(event: KeyboardEvent) { if (event.key === 'Escape') setSelected(null); }
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [selected]);

  const totals = logs.reduce((acc, item) => ({ calories: acc.calories + number(item.caloric_value), protein: acc.protein + number(item.protein), carbs: acc.carbs + number(item.carbohydrates), fat: acc.fat + number(item.fat) }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
  const details = selected ? [
    ['Energi', selected.caloric_value, 'kkal'], ['Protein', selected.protein, 'g'], ['Karbohidrat', selected.carbohydrates, 'g'], ['Lemak', selected.fat, 'g'],
    ['Serat', selected.dietary_fiber, 'g'], ['Gula', selected.sugars, 'g'], ['Lemak jenuh', selected.saturated_fats, 'g'], ['Sodium', selected.sodium, 'mg'], ['Kalium', selected.potassium, 'mg'], ['Zat besi', selected.iron, 'mg'], ['Kalsium', selected.calcium, 'mg'], ['Vitamin C', selected.vitamin_c, 'mg'],
  ] as const : [];

  return <div className="nm-page nm-log-page"><PageHeading eyebrow="JURNAL MAKAN" title="Cerita di balik setiap piring." description="Semua makanan yang kamu simpan ada di sini, lengkap dengan ringkasan nutrisinya." action={<Link className="nm-btn nm-btn-primary" to="/app/scan"><Camera size={17} /> Scan makanan</Link>} />
    <section className="nm-card nm-log-filters"><div className="nm-segmented" aria-label="Filter tanggal"><button type="button" className={!allDates ? 'is-active' : ''} onClick={() => { setAllDates(false); setDate(localISODate()); }}>Hari ini</button><button type="button" className={allDates ? 'is-active' : ''} onClick={() => setAllDates(true)}>Semua catatan</button></div><label className="nm-date-field"><CalendarDays size={17} /><span className="nm-visually-hidden">Pilih tanggal</span><input type="date" value={date} max={localISODate()} onChange={(event) => { setDate(event.target.value); setAllDates(false); }} /></label></section>
    {loading ? <LoadingState label="Mengambil catatan makanan..." /> : error ? <ErrorState message={error} retry={() => setRefresh((count) => count + 1)} /> : <>
      {logs.length ? <><div className="nm-log-summary"><div className="nm-card nm-log-hero-stat"><span className="nm-icon-bubble nm-icon-bubble-coral"><Flame size={22} /></span><span><small>{allDates ? 'TOTAL PILIHAN' : 'ASUPAN PADA TANGGAL INI'}</small><strong>{rounded(totals.calories)} <em>kkal</em></strong><p>Dari {logs.length} catatan makanan</p></span></div><div className="nm-card nm-log-macro-stats"><NutrientPill label="Protein" value={totals.protein} tone="protein" /><NutrientPill label="Karbohidrat" value={totals.carbs} tone="carbs" /><NutrientPill label="Lemak" value={totals.fat} tone="fat" /></div></div>
        <div className="nm-list-heading"><div><span className="nm-eyebrow">RIWAYAT ASUPAN</span><h2>{allDates ? 'Semua makanan' : `Makanan pada ${formatDate(date, { day: 'numeric', month: 'long' })}`}</h2></div><span>{logs.length} catatan</span></div><div className="nm-food-grid">{logs.map((item) => <button className="nm-food-card" type="button" key={item.id} onClick={() => setSelected(item)}><div className="nm-food-image">{item.image_url || item.image_path ? <img src={item.image_url || `/static/${item.image_path?.replace(/^\/+/, '')}`} alt={item.food_name} loading="lazy" /> : <UtensilsCrossed size={30} />}</div><div className="nm-food-card-body"><span className="nm-mini-label">{formatDate(item.log_date, { day: 'numeric', month: 'short' })}</span><h3>{item.food_name}</h3><p><Flame size={15} /> {rounded(item.caloric_value)} kkal</p><div className="nm-food-card-bottom"><span>P {rounded(item.protein)}g</span><span>K {rounded(item.carbohydrates)}g</span><span>L {rounded(item.fat)}g</span><ChevronRight size={17} /></div></div></button>)}</div></> : <EmptyState icon={<Search size={26} />} title="Belum ada makanan di sini" description={allDates ? 'Mulai dengan memindai foto makanan pertamamu.' : 'Belum ada catatan untuk tanggal ini. Pindai makanan untuk mencatat asupan hari ini.'} actionLabel="Scan makanan" actionTo="/app/scan" />}
    </>}
    {selected ? <div className="nm-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}><div className="nm-modal" role="dialog" aria-modal="true" aria-labelledby="food-detail-title"><div className="nm-modal-head"><span className="nm-eyebrow">DETAIL MAKANAN</span><button type="button" className="nm-icon-button" aria-label="Tutup detail" onClick={() => setSelected(null)}><CircleX size={23} /></button></div><div className="nm-modal-title"><div className="nm-food-image">{selected.image_url || selected.image_path ? <img src={selected.image_url || `/static/${selected.image_path?.replace(/^\/+/, '')}`} alt="" /> : <UtensilsCrossed size={30} />}</div><div><h2 id="food-detail-title">{selected.food_name}</h2><p>{formatDate(selected.log_date)} · {selected.created_at ? new Date(selected.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : ''}</p></div></div><div className="nm-modal-grid">{details.map(([label, value, unit]) => <div key={label}><span>{label}</span><strong>{rounded(value)} {unit}</strong></div>)}</div><p className="nm-fineprint">Nilai nutrisi merupakan estimasi database makanan dan dapat berbeda sesuai porsi atau cara memasak.</p></div></div> : null}
  </div>;
}
