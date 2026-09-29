import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, ArrowRight, Check, CircleAlert, Heart, Leaf, LoaderCircle, Save, Sparkles, UtensilsCrossed } from 'lucide-react';
import { api } from '../../lib/api';
import { MealCard, MealPlan, NutrientPill, PageHeading, errorMessage, rounded } from './ui';

const preferenceChoices = [
  { label: 'Tinggi protein', value: 'High protein' },
  { label: 'Vegetarian', value: 'Vegetarian' },
  { label: 'Rendah gula', value: 'Low sugar' },
  { label: 'Menu Indonesia', value: 'Indonesian meals' },
  { label: 'Praktis', value: 'Quick and easy meals' },
  { label: 'Hemat', value: 'Budget friendly' },
];

export default function GeneratePlan() {
  const navigate = useNavigate();
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [activity, setActivity] = useState('');
  const [preferences, setPreferences] = useState<string[]>([]);
  const [plan, setPlan] = useState<MealPlan | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  function togglePreference(value: string) {
    setPreferences((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  }

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGenerating(true);
    setPlan(null);
    setGenerateError(null);
    setSaveError(null);
    try {
      const response = await api<MealPlan>('/api/generate-meal-plan', { method: 'POST', body: JSON.stringify({ age: Number(age), gender, weight: Number(weight), height: Number(height), activity, preferences }) });
      if (
        !response || !response.summary || !Array.isArray(response.meals) || response.meals.length === 0 ||
        !(Number(response.summary.calories) > 0) ||
        response.meals.some((meal) => !meal || !Array.isArray(meal.items) || meal.items.length === 0 || !(Number(meal.calories) > 0))
      ) throw new Error('Menu belum lengkap atau belum memiliki data nutrisi. Coba buat ulang.');
      setPlan(response);
      window.setTimeout(() => document.getElementById('generated-plan')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    } catch (cause) {
      setGenerateError(errorMessage(cause, 'Rencana belum berhasil dibuat. Coba lagi.'));
    } finally { setGenerating(false); }
  }

  async function save() {
    if (!plan) return;
    setSaving(true);
    setSaveError(null);
    try {
      await api('/api/save-meal-plan', { method: 'POST', body: JSON.stringify(plan) });
      navigate('/app/plan');
    } catch (cause) {
      setSaveError(errorMessage(cause, 'Rencana belum tersimpan. Coba lagi.'));
    } finally { setSaving(false); }
  }

  return <div className="nm-page nm-generate-page"><PageHeading eyebrow="RENCANA MAKAN" title="Menu yang terasa pas untukmu." description="Ceritakan kebutuhan dan kebiasaanmu, lalu susun ide menu harian dengan bantuan AI." />
    <div className="nm-generate-layout"><form className="nm-card nm-plan-form" onSubmit={(event) => void generate(event)}><div className="nm-section-intro"><span className="nm-icon-bubble nm-icon-bubble-lime"><Heart size={23} /></span><div><h2>Kenali kebutuhanmu</h2><p>Isi profil singkat agar saran menu lebih relevan.</p></div></div><div className="nm-form-grid"><label className="nm-field"><span>Usia</span><div className="nm-input-wrap"><input value={age} onChange={(event) => setAge(event.target.value)} type="number" min="1" max="120" required placeholder="Contoh: 28" /><small>tahun</small></div></label><label className="nm-field"><span>Jenis kelamin</span><select value={gender} onChange={(event) => setGender(event.target.value)} required><option value="">Pilih</option><option value="female">Perempuan</option><option value="male">Laki-laki</option></select></label><label className="nm-field"><span>Berat badan</span><div className="nm-input-wrap"><input value={weight} onChange={(event) => setWeight(event.target.value)} type="number" min="1" max="500" step="0.1" required placeholder="Contoh: 62" /><small>kg</small></div></label><label className="nm-field"><span>Tinggi badan</span><div className="nm-input-wrap"><input value={height} onChange={(event) => setHeight(event.target.value)} type="number" min="50" max="280" step="0.1" required placeholder="Contoh: 168" /><small>cm</small></div></label></div><label className="nm-field"><span>Aktivitas sehari-hari</span><select value={activity} onChange={(event) => setActivity(event.target.value)} required><option value="">Pilih tingkat aktivitas</option><option value="sedentary">Lebih banyak duduk</option><option value="lightly active">Aktivitas ringan</option><option value="moderately active">Aktivitas sedang</option><option value="very active">Sangat aktif</option></select></label><div className="nm-field"><span>Preferensi makan <em>(opsional)</em></span><div className="nm-chip-list">{preferenceChoices.map((choice) => <button type="button" key={choice.value} className={`nm-chip ${preferences.includes(choice.value) ? 'is-selected' : ''}`} aria-pressed={preferences.includes(choice.value)} onClick={() => togglePreference(choice.value)}>{preferences.includes(choice.value) ? <Check size={14} /> : <PlusGlyph />}{choice.label}</button>)}</div></div><button className="nm-btn nm-btn-primary nm-full nm-generate-submit" type="submit" disabled={generating}>{generating ? <LoaderCircle size={18} className="nm-spin" /> : <Sparkles size={18} />}{generating ? 'Menyusun menu...' : 'Buat rencana makan'}<ArrowRight size={17} /></button>{generateError ? <div className="nm-inline-alert" role="alert" style={{ marginTop: 12 }}><CircleAlert size={18} /> <span>{generateError}</span></div> : null}<p className="nm-fineprint">Rencana ini bersifat informatif. Sesuaikan dengan kondisi kesehatan dan kebutuhan pribadi.</p></form>
      <aside className="nm-generate-aside"><div className="nm-plan-explainer"><div className="nm-explainer-art"><span className="nm-explainer-circle"><UtensilsCrossed size={36} /></span><span className="nm-explainer-spark">✦</span></div><span className="nm-eyebrow">DIBUAT UNTUK HARI-HARIMU</span><h2>Satu rencana, lebih sedikit bingung.</h2><p>Ide sarapan, makan siang, makan malam, dan camilan dalam satu tempat. Lihat estimasi energi dan kandungan makronya sebelum menyimpan.</p><div className="nm-explainer-list"><span><Activity size={17} /> Mempertimbangkan aktivitasmu</span><span><Leaf size={17} /> Mengikuti preferensi makanmu</span><span><Sparkles size={17} /> Bisa dibuat ulang kapan saja</span></div></div></aside></div>
    {plan ? <section id="generated-plan" className="nm-generated-plan"><div className="nm-generated-head"><div><span className="nm-eyebrow">RENCANA SIAP DILIHAT</span><h2>Ini ide menu untukmu</h2><p>Periksa dahulu sebelum menyimpannya sebagai rencana hari ini.</p></div><button className="nm-btn nm-btn-primary" type="button" disabled={saving} onClick={() => void save()}>{saving ? <LoaderCircle size={17} className="nm-spin" /> : <Save size={17} />}{saving ? 'Menyimpan...' : 'Simpan rencana'}</button></div>{saveError ? <div className="nm-inline-alert" role="alert" style={{ marginTop: 16 }}><CircleAlert size={18} /> <span>{saveError}</span></div> : null}<div className="nm-plan-summary"><NutrientPill label="Energi menu" value={plan.summary.calories} unit="kkal" tone="calories" /><NutrientPill label="Protein" value={plan.summary.protein} tone="protein" /><NutrientPill label="Karbohidrat" value={plan.summary.carbs} tone="carbs" /><NutrientPill label="Lemak" value={plan.summary.fat} tone="fat" /></div>{plan.target_calories ? <p className="nm-target-note">Perkiraan kebutuhan energi harian: <strong>{rounded(plan.target_calories)} kkal</strong>. Energi menu yang tersedia bisa berbeda dari angka ini.</p> : null}<div className="nm-meal-grid">{plan.meals.map((meal, index) => <MealCard key={`${meal.type}-${index}`} meal={meal} index={index} />)}</div></section> : null}
  </div>;
}

function PlusGlyph() { return <span className="nm-chip-plus" aria-hidden="true">+</span>; }
