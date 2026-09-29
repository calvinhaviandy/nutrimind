import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, Check, ChevronRight, CircleAlert, Leaf, LoaderCircle, Save, Sparkles, UtensilsCrossed } from 'lucide-react';
import { api } from '../../lib/api';
import { EmptyState, ErrorState, LoadingState, MealCard, MealPlan, NutrientPill, PageHeading, errorMessage, formatDate, localISODate } from './ui';

export default function MealPlans() {
  const [plans, setPlans] = useState<MealPlan[]>([]);
  const [draft, setDraft] = useState<MealPlan | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [savedResult, draftResult] = await Promise.allSettled([
      api<MealPlan[]>('/api/meal-plans'),
      api<MealPlan | null>('/api/current-meal-plan'),
    ]);
    const savedPlans = savedResult.status === 'fulfilled' ? savedResult.value : [];
    let draftPlan = draftResult.status === 'fulfilled' ? draftResult.value : null;
    const todaySaved = savedPlans.find((item) => item.date === localISODate());
    if (todaySaved && draftPlan && JSON.stringify(todaySaved.summary) === JSON.stringify(draftPlan.summary) && JSON.stringify(todaySaved.meals) === JSON.stringify(draftPlan.meals)) draftPlan = null;
    if (savedResult.status === 'fulfilled') setPlans(savedPlans);
    else setError(errorMessage(savedResult.reason));
    setDraft(draftPlan);
    setSelectedId((current) => current || (draftPlan ? 'draft' : savedPlans[0] ? `saved:${savedPlans[0].date}` : null));
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function saveDraft() {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      await api('/api/save-meal-plan', { method: 'POST', body: JSON.stringify(draft) });
      const updated = await api<MealPlan[]>('/api/meal-plans');
      setPlans(updated);
      setDraft(null);
      setSelectedId(`saved:${localISODate()}`);
    } catch (cause) { setError(errorMessage(cause, 'Rencana belum tersimpan. Coba lagi.')); }
    finally { setSaving(false); }
  }

  const isDraft = selectedId === 'draft';
  const selected = isDraft ? draft : plans.find((item) => `saved:${item.date}` === selectedId) || (draft || plans[0]);
  const selectedDate = isDraft ? localISODate() : selected?.date || localISODate();

  return <div className="nm-page nm-plans-page"><PageHeading eyebrow="RENCANA MAKAN" title="Menu yang sudah kamu rencanakan." description="Temukan menu hari ini dan jelajahi rencana yang pernah kamu simpan." action={<Link className="nm-btn nm-btn-primary" to="/app/plan/new"><Sparkles size={18} /> Buat rencana baru</Link>} />
    {loading ? <LoadingState label="Menyiapkan rencana makan..." /> : error && !selected ? <ErrorState message={error} retry={() => void load()} /> : !selected ? <EmptyState icon={<UtensilsCrossed size={28} />} title="Belum ada rencana makan" description="Buat ide menu sesuai profil dan preferensimu untuk memulai." actionLabel="Buat rencana makan" actionTo="/app/plan/new" /> : <>
      {error ? <div className="nm-inline-alert" role="alert"><CircleAlert size={17} /> {error}</div> : null}
      <section className="nm-plan-spotlight"><div className="nm-plan-spotlight-copy"><span className="nm-eyebrow nm-eyebrow-light"><CalendarDays size={15} /> {isDraft ? 'DRAF SAAT INI' : formatDate(selectedDate, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span><h2>{isDraft ? 'Rencana baru untuk hari ini' : 'Menu pilihanmu hari ini'}</h2><p>{isDraft ? 'Rencana ini baru dibuat. Simpan agar bisa kamu lihat kembali di riwayat.' : `${selected.meals?.length || 0} waktu makan tersusun untuk membantu hari terasa lebih terarah.`}</p>{isDraft ? <button className="nm-btn nm-btn-citrus" type="button" disabled={saving} onClick={() => void saveDraft()}>{saving ? <LoaderCircle size={17} className="nm-spin" /> : <Save size={17} />}{saving ? 'Menyimpan...' : 'Simpan rencana'} <ArrowRight size={17} /></button> : <Link className="nm-btn nm-btn-citrus" to="/app/plan/new">Buat menu lain <ArrowRight size={17} /></Link>}</div><div className="nm-plan-spotlight-art" aria-hidden="true"><Leaf size={86} strokeWidth={1.2} /><span>✦</span></div></section>
      <div className="nm-plan-details-layout"><section className="nm-plan-details"><div className="nm-list-heading"><div><span className="nm-eyebrow">RANGKUMAN NUTRISI</span><h2>Estimasi harian</h2></div></div><div className="nm-plan-summary"><NutrientPill label="Energi" value={selected.summary?.calories} unit="kkal" tone="calories" /><NutrientPill label="Protein" value={selected.summary?.protein} tone="protein" /><NutrientPill label="Karbohidrat" value={selected.summary?.carbs} tone="carbs" /><NutrientPill label="Lemak" value={selected.summary?.fat} tone="fat" /></div><div className="nm-list-heading nm-meals-heading"><div><span className="nm-eyebrow">MENU SATU HARI</span><h2>Dari pagi sampai malam</h2></div></div><div className="nm-meal-stack">{selected.meals?.map((meal, index) => <MealCard key={`${selectedDate}-${meal.type}-${index}`} meal={meal} index={index} />)}</div><p className="nm-fineprint">Nilai energi adalah estimasi dari data makanan dan dapat berbeda sesuai porsi atau cara memasak.</p></section><aside className="nm-plan-history"><div className="nm-card"><span className="nm-eyebrow">ARSIP MENU</span><h2>Riwayat rencana</h2><p>Pilih tanggal untuk melihat kembali menu yang tersimpan.</p><div className="nm-history-list">{draft ? <button className={`nm-history-item ${selectedId === 'draft' ? 'is-active' : ''}`} type="button" onClick={() => setSelectedId('draft')}><span className="nm-history-date"><Sparkles size={18} /></span><span><strong>Draf terbaru</strong><small>Belum disimpan</small></span><ChevronRight size={17} /></button> : null}{plans.map((item) => <button className={`nm-history-item ${selectedId === `saved:${item.date}` ? 'is-active' : ''}`} key={item.date} type="button" onClick={() => setSelectedId(`saved:${item.date}`)}><span className="nm-history-date"><CalendarDays size={18} /></span><span><strong>{formatDate(item.date || '', { day: 'numeric', month: 'long', year: 'numeric' })}</strong><small>{item.meals?.length || 0} menu · {Math.round(Number(item.summary?.calories) || 0).toLocaleString('id-ID')} kkal</small></span>{selectedId === `saved:${item.date}` ? <Check size={17} /> : <ChevronRight size={17} />}</button>)}</div></div></aside></div>
    </>}
  </div>;
}
