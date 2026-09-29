import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BarChart3, CalendarDays, Camera, Flame, Leaf, TrendingUp } from 'lucide-react';
import { api } from '../../lib/api';
import { EmptyState, ErrorState, LoadingState, NutrientPill, PageHeading, errorMessage, number, rounded } from './ui';

type WeeklyReport = { daily: { day: string; calories: number }[]; macros: { protein: number; carbs: number; fat: number } };
type MonthlyEntry = { week: number; calories: number; logs: number };
const dayName: Record<string, string> = { Mon: 'Sen', Tue: 'Sel', Wed: 'Rab', Thu: 'Kam', Fri: 'Jum', Sat: 'Sab', Sun: 'Min' };

export default function Reports() {
  const [weekly, setWeekly] = useState<WeeklyReport | null>(null);
  const [monthly, setMonthly] = useState<MonthlyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const results = await Promise.allSettled([api<WeeklyReport>('/api/reports/weekly'), api<MonthlyEntry[]>('/api/reports/monthly')]);
    if (results[0].status === 'fulfilled') setWeekly(results[0].value);
    if (results[1].status === 'fulfilled') setMonthly(results[1].value);
    if (results.some((result) => result.status === 'rejected')) {
      const rejected = results.find((result) => result.status === 'rejected');
      setError(errorMessage(rejected && rejected.status === 'rejected' ? rejected.reason : null));
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load, refresh]);

  const days = weekly?.daily || [];
  const weekTotal = days.reduce((sum, day) => sum + number(day.calories), 0);
  const recordedDays = days.filter((day) => number(day.calories) > 0).length;
  const monthTotal = monthly.reduce((sum, row) => sum + number(row.calories), 0);
  const monthLogs = monthly.reduce((sum, row) => sum + number(row.logs), 0);
  const weekMax = Math.max(...days.map((day) => number(day.calories)), 1);
  const monthMax = Math.max(...monthly.map((entry) => number(entry.calories)), 1);
  const monthName = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(new Date());

  return <div className="nm-page nm-reports-page"><PageHeading eyebrow="LAPORAN" title="Lihat progres, temukan pola." description="Ringkasan asupan dari makanan yang kamu catat, disusun agar lebih mudah dipahami." action={<Link className="nm-btn nm-btn-outline" to="/app/journal">Buka jurnal <ArrowRight size={17} /></Link>} />
    {loading ? <LoadingState label="Membaca catatan asupanmu..." /> : error && !weekly ? <ErrorState message={error} retry={() => setRefresh((value) => value + 1)} /> : <>
      {error ? <div className="nm-inline-alert" role="alert">{error}</div> : null}
      <section className="nm-report-summary"><div className="nm-report-stat nm-report-stat-dark"><span className="nm-icon-bubble nm-icon-bubble-white"><Flame size={22} /></span><small>TOTAL PEKAN INI</small><strong>{rounded(weekTotal)} <em>kkal</em></strong><span>Dari makanan yang tercatat</span></div><div className="nm-report-stat"><span className="nm-icon-bubble nm-icon-bubble-lime"><CalendarDays size={22} /></span><small>HARI TERCATAT</small><strong>{recordedDays} <em>hari</em></strong><span>Dari 7 hari pekan ini</span></div><div className="nm-report-stat"><span className="nm-icon-bubble nm-icon-bubble-coral"><BarChart3 size={22} /></span><small>CATATAN BULAN INI</small><strong>{rounded(monthLogs)} <em>makanan</em></strong><span>{monthName}</span></div></section>
      <div className="nm-report-grid"><section className="nm-card nm-report-week"><div className="nm-card-heading"><div><span className="nm-eyebrow">GRAFIK PEKAN INI</span><h2>Energi yang tercatat</h2></div><TrendingUp size={21} /></div><p className="nm-subtle">Jumlah kalori per hari berdasarkan catatan makananmu.</p>{weekTotal > 0 ? <div className="nm-report-chart" role="img" aria-label={`Energi harian: ${days.map((day) => `${dayName[day.day] || day.day} ${rounded(day.calories)} kilokalori`).join(', ')}`}>{days.map((day, index) => <div className="nm-report-chart-col" key={`${day.day}-${index}`}><span>{number(day.calories) ? rounded(day.calories) : '—'}</span><div className="nm-report-bar"><i style={{ height: `${number(day.calories) ? Math.max(7, (number(day.calories) / weekMax) * 100) : 0}%` }} /></div><b>{dayName[day.day] || day.day}</b></div>)}</div> : <EmptyState icon={<Camera size={25} />} title="Pekan ini masih kosong" description="Catat makanan untuk melihat pola asupanmu sepanjang minggu." actionLabel="Scan makanan" actionTo="/app/scan" />}</section><section className="nm-card nm-report-macros"><div className="nm-card-heading"><div><span className="nm-eyebrow">KOMPOSISI MAKANAN</span><h2>Rata-rata makro</h2></div><Leaf size={21} /></div><p className="nm-subtle">Rata-rata per catatan makanan pekan ini.</p><div className="nm-report-nutrients"><NutrientPill label="Protein" value={weekly?.macros?.protein} tone="protein" /><NutrientPill label="Karbohidrat" value={weekly?.macros?.carbs} tone="carbs" /><NutrientPill label="Lemak" value={weekly?.macros?.fat} tone="fat" /></div><div className="nm-report-note"><span>✦</span><p>Nilai ini membantu melihat komposisi makanan yang kamu catat, bukan target asupan harian.</p></div></section></div>
      <section className="nm-card nm-month-card"><div className="nm-card-heading"><div><span className="nm-eyebrow">GAMBARAN BULANAN</span><h2>Perjalanan di {monthName}</h2></div><span className="nm-month-total">{rounded(monthTotal)} kkal tercatat</span></div><p className="nm-subtle">Total asupan yang dicatat pada setiap pekan dalam bulan berjalan.</p>{monthly.length ? <div className="nm-month-rows">{monthly.map((entry) => <div className="nm-month-row" key={entry.week}><span>Pekan {entry.week}</span><div className="nm-month-track" role="meter" aria-valuenow={number(entry.calories)} aria-valuemin={0} aria-valuemax={monthMax} aria-label={`Pekan ${entry.week}: ${rounded(entry.calories)} kilokalori`}><i style={{ width: `${Math.max(3, (number(entry.calories) / monthMax) * 100)}%` }} /></div><strong>{rounded(entry.calories)} kkal</strong><small>{rounded(entry.logs)} catatan</small></div>)}</div> : <EmptyState icon={<CalendarDays size={26} />} title="Belum ada data bulan ini" description="Setelah kamu menyimpan makanan, rangkuman bulanan akan muncul di sini." actionLabel="Mulai mencatat" actionTo="/app/scan" />}</section>
    </>}
  </div>;
}
