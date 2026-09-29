import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Camera, Droplets, Flame, Lightbulb, LoaderCircle, Plus, Sparkles, UtensilsCrossed } from 'lucide-react';
import { api } from '../../lib/api';
import { EmptyState, ErrorState, LoadingState, MealPlan, NutrientPill, errorMessage, formatDate, localISODate, number, rounded } from './ui';

type DashboardData = {
  user: string;
  intake: { calories: number; protein: number; carbs: number; fat: number };
  hydration: number;
  meals: { meal_type: string; title: string; calories: number; time: string }[];
  weekly: { day: string; value: number; is_today: boolean }[];
};

const weekdayNames = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

export default function Dashboard() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [plan, setPlan] = useState<MealPlan | null>(null);
  const [tip, setTip] = useState<string | null>(null);
  const [tipError, setTipError] = useState<string | null>(null);
  const [tipLoading, setTipLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [addingWater, setAddingWater] = useState(false);
  const today = localISODate();

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const result = await api<DashboardData>(`/api/dashboard?date=${today}`);
      setDashboard(result);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    let active = true;
    api<MealPlan | null>('/api/current-meal-plan').then((value) => { if (active) setPlan(value); }).catch(() => { /* The dashboard remains useful without a plan. */ });
    const cachedTip = sessionStorage.getItem(`nutrimind-tip-${today}`);
    if (cachedTip && active) setTip(cachedTip);
    return () => { active = false; };
  }, [today]);

  async function getTip() {
    setTipLoading(true);
    setTipError(null);
    try {
      const result = await api<{ tip: string }>('/api/daily-tip');
      setTip(result.tip);
      sessionStorage.setItem(`nutrimind-tip-${today}`, result.tip);
    } catch (cause) { setTipError(errorMessage(cause)); }
    finally { setTipLoading(false); }
  }

  async function addWater() {
    setAddingWater(true);
    try {
      await api('/api/add-water', { method: 'POST' });
      await load();
    } catch (cause) {
      setError(errorMessage(cause, 'Gelas air belum tersimpan. Coba lagi.'));
    } finally {
      setAddingWater(false);
    }
  }

  if (loading && !dashboard) return <LoadingState label="Menyiapkan ringkasan hari ini..." />;
  if (error && !dashboard) return <ErrorState message={error} retry={() => void load()} />;
  if (!dashboard) return null;

  const hour = new Date().getHours();
  const greeting = hour < 11 ? 'Selamat pagi' : hour < 15 ? 'Selamat siang' : hour < 18 ? 'Selamat sore' : 'Selamat malam';
  const firstName = dashboard.user?.trim().split(/\s+/)[0] || 'teman';
  const consumed = number(dashboard.intake?.calories);
  const planCalories = number(plan?.target_calories || plan?.summary?.calories);
  const percentage = planCalories ? Math.min(100, Math.round((consumed / planCalories) * 100)) : 0;
  const maxWeekly = Math.max(...(dashboard.weekly || []).map((day) => number(day.value)), 1);

  return <div className="nm-page nm-dashboard">
    <section className="nm-welcome">
      <div className="nm-welcome-copy"><span className="nm-eyebrow nm-eyebrow-light"><Sparkles size={14} /> {formatDate(today, { weekday: 'long', day: 'numeric', month: 'long' })}</span><h1>{greeting}, {firstName}<span className="nm-heading-dot">.</span></h1><p>Langkah kecil yang konsisten membuat perjalanan sehat terasa lebih ringan. Lihat progresmu hari ini.</p><Link className="nm-btn nm-btn-citrus" to="/app/scan"><Camera size={18} /> Scan makanan <ArrowRight size={17} /></Link></div>
      <div className="nm-welcome-art" aria-hidden="true"><div className="nm-orbit nm-orbit-outer" /><div className="nm-orbit nm-orbit-inner" /><div className="nm-art-center">✦</div><span className="nm-art-pill nm-art-pill-one">🥑 Seimbang</span><span className="nm-art-pill nm-art-pill-two">+ Kebiasaan baik</span></div>
    </section>

    {error ? <div className="nm-inline-alert" role="alert">{error}</div> : null}

    <div className="nm-dashboard-top">
      <section className="nm-card nm-calorie-card">
        <div className="nm-card-heading"><div><span className="nm-eyebrow">ENERGI HARI INI</span><h2>Asupan tercatat</h2></div><span className="nm-icon-bubble nm-icon-bubble-coral"><Flame size={20} /></span></div>
        <div className="nm-calorie-main"><strong>{rounded(consumed)}</strong><span>kkal</span></div>
        {planCalories ? <><div className="nm-progress-track" role="progressbar" aria-valuenow={Math.min(consumed, planCalories)} aria-valuemin={0} aria-valuemax={planCalories} aria-label="Asupan dibanding rencana makan"><span style={{ width: `${percentage}%` }} /></div><div className="nm-card-foot"><span>{percentage}% dari rencana makan</span><span>{rounded(planCalories)} kkal</span></div></> : <p className="nm-card-note">Belum ada rencana makan sebagai acuan. <Link to="/app/plan/new">Buat rencana <ArrowRight size={13} /></Link></p>}
      </section>
      <section className="nm-card nm-hydration-card"><div className="nm-card-heading"><div><span className="nm-eyebrow">HIDRASI</span><h2>Air minum</h2></div><span className="nm-icon-bubble nm-icon-bubble-blue"><Droplets size={20} /></span></div><div className="nm-hydration-count"><strong>{rounded(dashboard.hydration)}</strong><span>gelas tercatat hari ini</span></div><div className="nm-water-row" aria-hidden="true">{Array.from({ length: 8 }, (_, index) => <span key={index} className={index < number(dashboard.hydration) ? 'is-filled' : ''} />)}</div><button className="nm-btn nm-btn-outline nm-full" onClick={() => void addWater()} disabled={addingWater}><Plus size={17} /> {addingWater ? 'Menyimpan...' : 'Catat satu gelas'}</button></section>
      <section className="nm-card nm-macros-card"><div className="nm-card-heading"><div><span className="nm-eyebrow">KOMPOSISI</span><h2>Makro hari ini</h2></div><span className="nm-icon-bubble nm-icon-bubble-lime"><UtensilsCrossed size={20} /></span></div><div className="nm-nutrient-stack"><NutrientPill label="Protein" value={dashboard.intake?.protein} tone="protein" /><NutrientPill label="Karbohidrat" value={dashboard.intake?.carbs} tone="carbs" /><NutrientPill label="Lemak" value={dashboard.intake?.fat} tone="fat" /></div></section>
    </div>

    <div className="nm-dashboard-bottom">
      <section className="nm-card nm-week-card"><div className="nm-card-heading"><div><span className="nm-eyebrow">SEPEKAN INI</span><h2>Jejak asupanmu</h2></div><Link className="nm-text-link" to="/app/insights">Lihat laporan <ArrowRight size={16} /></Link></div><p className="nm-subtle">Jumlah energi dari makanan yang dicatat setiap hari.</p><div className="nm-week-chart" role="img" aria-label={`Asupan pekan ini: ${(dashboard.weekly || []).map((day, index) => `${weekdayNames[index]} ${rounded(day.value)} kkal`).join(', ')}`}>{(dashboard.weekly || []).map((day, index) => <div className="nm-week-col" key={index}><span className="nm-week-value">{number(day.value) ? rounded(day.value) : '—'}</span><div className="nm-week-bar-track"><span className={day.is_today ? 'is-today' : ''} style={{ height: number(day.value) ? `${Math.max(8, (number(day.value) / maxWeekly) * 100)}%` : '0%' }} /></div><span className={day.is_today ? 'is-today' : ''}>{weekdayNames[index]}</span></div>)}</div></section>
      <section className="nm-card nm-plan-card"><div className="nm-card-heading"><div><span className="nm-eyebrow">MENU HARI INI</span><h2>Rencana makan</h2></div><Link className="nm-text-link" to="/app/plan">Lihat semua <ArrowRight size={16} /></Link></div>{dashboard.meals?.length ? <div className="nm-plan-list">{dashboard.meals.map((meal, index) => <div className="nm-plan-line" key={`${meal.meal_type}-${index}`}><div className="nm-plan-line-time">{meal.time || '—'}</div><div><span className="nm-mini-label">{({ Breakfast: 'Sarapan', Lunch: 'Makan siang', Dinner: 'Makan malam', Snack: 'Camilan' } as Record<string, string>)[meal.meal_type] || meal.meal_type}</span><strong>{meal.title}</strong></div><span className="nm-plan-line-kcal">{rounded(meal.calories)} kkal</span></div>)}</div> : <EmptyState title="Menu belum disusun" description="Buat rencana makan pribadi untuk mengisi jadwal hari ini." actionLabel="Buat rencana" actionTo="/app/plan/new" />}</section>
    </div>

    <div className="nm-dashboard-bottom nm-dashboard-last"><section className="nm-tip-card"><div className="nm-tip-symbol"><Lightbulb size={23} /></div><div><span className="nm-eyebrow">INSPIRASI HARI INI</span><h2>Tips kecil, dampak besar</h2>{tip ? <p>{tip}</p> : tipError ? <p role="alert">{tipError}</p> : <><p>Minta satu ide sederhana untuk kebiasaan makan hari ini.</p><button className="nm-tip-button" type="button" disabled={tipLoading} onClick={() => void getTip()}>{tipLoading ? <LoaderCircle className="nm-spin" size={15} /> : <Sparkles size={15} />}{tipLoading ? 'Menyiapkan...' : 'Lihat tips hari ini'}</button></>}</div></section><Link className="nm-quick-card" to="/app/journal"><span className="nm-icon-bubble nm-icon-bubble-lime"><UtensilsCrossed size={23} /></span><span><small>CATATAN MAKAN</small><strong>Lihat apa yang sudah kamu makan</strong></span><ArrowRight size={20} /></Link></div>
  </div>;
}
