import { ChangeEvent, DragEvent, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Camera, Check, CircleAlert, ImagePlus, LoaderCircle, ScanLine, Sparkles, UploadCloud } from 'lucide-react';
import { api } from '../../lib/api';
import { NutrientPill, PageHeading, errorMessage, rounded } from './ui';

type Nutrition = Record<string, string | number>;
type ScanResult = { found: true; nutrition: Nutrition } | { found: false; food: string };

function readImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Foto tidak bisa dibaca. Coba file lain.'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('Format foto tidak didukung. Gunakan JPG, PNG, atau WebP.'));
      image.onload = () => {
        const maxSide = 1280;
        const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext('2d');
        if (!context) return reject(new Error('Foto tidak bisa diproses di browser ini.'));
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const encodedPhoto = canvas.toDataURL('image/jpeg', 0.78);
        // Keep the decoded image below the API's 2 MB limit and the JSON request below Vercel's 4.5 MB limit.
        if (encodedPhoto.length > 2_600_000) {
          reject(new Error('Foto masih terlalu besar setelah diperkecil. Coba foto lain atau kurangi resolusinya.'));
          return;
        }
        resolve(encodedPhoto);
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export default function ScanFood() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dragging, setDragging] = useState(false);

  async function selectFile(file?: File) {
    if (!file) return;
    setError(null);
    setResult(null);
    setSaved(false);
    if (!file.type.startsWith('image/')) { setError('Pilih file gambar seperti JPG, PNG, atau WebP.'); return; }
    if (file.size > 15 * 1024 * 1024) { setError('Ukuran foto maksimal 15 MB.'); return; }
    try { setPhoto(await readImage(file)); } catch (cause) { setError(errorMessage(cause)); }
  }

  function onInput(event: ChangeEvent<HTMLInputElement>) {
    void selectFile(event.target.files?.[0]);
    event.target.value = '';
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    void selectFile(event.dataTransfer.files[0]);
  }

  async function scan() {
    if (!photo) return;
    setBusy(true);
    setResult(null);
    setError(null);
    try {
      const response = await api<ScanResult>('/api/scan-food', { method: 'POST', body: JSON.stringify({ image: photo }) });
      setResult(response);
    } catch (cause) {
      setError(errorMessage(cause, 'Foto belum berhasil dianalisis. Coba lagi.'));
    } finally { setBusy(false); }
  }

  async function save() {
    if (!photo || !result?.found) return;
    setSaving(true);
    setError(null);
    try {
      await api('/api/add-food-log', { method: 'POST', body: JSON.stringify({ nutrition: result.nutrition, image: photo }) });
      setSaved(true);
    } catch (cause) {
      setError(errorMessage(cause, 'Catatan belum tersimpan. Coba lagi.'));
    } finally { setSaving(false); }
  }

  const nutrition = result?.found ? result.nutrition : null;
  const details = nutrition ? [
    ['Serat', 'dietary fiber', 'g'], ['Gula', 'sugars', 'g'], ['Lemak jenuh', 'saturated fats', 'g'],
    ['Sodium', 'sodium', 'mg'], ['Kalium', 'potassium', 'mg'], ['Zat besi', 'iron', 'mg'],
  ] as const : [];

  return <div className="nm-page nm-scan-page"><PageHeading eyebrow="SCAN MAKANAN" title="Kenali isi piringmu." description="Unggah foto makanan dan lihat perkiraan nutrisinya dalam beberapa langkah." action={<Link className="nm-btn nm-btn-outline" to="/app/journal">Lihat catatan <ArrowRight size={17} /></Link>} />
    <div className="nm-scan-layout">
      <section className="nm-card nm-scan-upload"><div className="nm-section-intro"><span className="nm-icon-bubble nm-icon-bubble-lime"><Camera size={23} /></span><div><h2>Unggah foto makanan</h2><p>Foto yang terang dan jelas membantu proses pengenalan.</p></div></div>
        <input ref={inputRef} className="nm-visually-hidden" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={onInput} aria-label="Pilih foto makanan" />
        <div className={`nm-dropzone ${dragging ? 'is-dragging' : ''} ${photo ? 'has-photo' : ''}`} onDragEnter={(event) => { event.preventDefault(); setDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={(event) => { event.preventDefault(); setDragging(false); }} onDrop={onDrop}>
          {photo ? <img className="nm-photo-preview" src={photo} alt="Foto makanan yang akan dianalisis" /> : <div className="nm-drop-placeholder"><span><UploadCloud size={36} /></span><h3>Tarik foto ke sini</h3><p>atau pilih dari perangkatmu</p><small>JPG, PNG, WebP · Maks. 15 MB</small></div>}
        </div>
        <div className="nm-scan-actions"><button className="nm-btn nm-btn-outline" type="button" onClick={() => inputRef.current?.click()}><ImagePlus size={17} /> {photo ? 'Ganti foto' : 'Pilih foto'}</button><button className="nm-btn nm-btn-primary" type="button" disabled={!photo || busy} onClick={() => void scan()}>{busy ? <LoaderCircle size={17} className="nm-spin" /> : <ScanLine size={17} />}{busy ? 'Menganalisis...' : 'Analisis makanan'}</button></div>
        <p className="nm-fineprint"><Sparkles size={15} /> Hasil AI adalah perkiraan. Porsi dan cara memasak dapat memengaruhi nilai nutrisi.</p>
      </section>
      <aside className="nm-scan-aside"><div className="nm-how-card"><span className="nm-eyebrow">CARA KERJANYA</span><h2>Tiga langkah sederhana</h2><div className="nm-how-list"><div><b>01</b><p><strong>Ambil foto</strong><span>Fokuskan makanan dalam bingkai.</span></p></div><div><b>02</b><p><strong>Lihat estimasi</strong><span>NutriMind mencocokkan makanan dengan data nutrisi.</span></p></div><div><b>03</b><p><strong>Simpan catatan</strong><span>Pantau asupanmu dari waktu ke waktu.</span></p></div></div></div></aside>
    </div>
    {error ? <div className="nm-inline-alert" role="alert"><CircleAlert size={17} /> {error}</div> : null}
    {result && !result.found ? <section className="nm-card nm-scan-result nm-scan-notfound"><span className="nm-state-icon"><CircleAlert size={24} /></span><h2>Makanan belum ada di database</h2><p>Foto dikenali sebagai <strong>{result.food}</strong>, tetapi datanya belum tersedia. Coba foto lain dengan makanan yang lebih jelas.</p></section> : null}
    {nutrition ? <section className="nm-card nm-scan-result"><div className="nm-result-heading"><div><span className="nm-eyebrow">HASIL ANALISIS</span><h2>{String(nutrition.food || 'Makanan terdeteksi')}</h2><p>Perkiraan nutrisi berdasarkan makanan yang paling mendekati dalam database.</p></div><span className="nm-result-check"><Check size={22} /></span></div><div className="nm-result-stats"><NutrientPill label="Energi" value={nutrition['caloric value']} unit="kkal" tone="calories" /><NutrientPill label="Protein" value={nutrition.protein} tone="protein" /><NutrientPill label="Karbohidrat" value={nutrition.carbohydrates} tone="carbs" /><NutrientPill label="Lemak" value={nutrition.fat} tone="fat" /></div><details className="nm-more-details"><summary>Lihat nutrisi lainnya</summary><div>{details.map(([label, key, unit]) => <span key={key}><b>{label}</b><strong>{rounded(nutrition[key])} {unit}</strong></span>)}</div></details><div className="nm-result-actions"><button type="button" className="nm-btn nm-btn-primary" disabled={saving || saved} onClick={() => void save()}>{saved ? <Check size={17} /> : saving ? <LoaderCircle className="nm-spin" size={17} /> : <Sparkles size={17} />}{saved ? 'Tersimpan di catatan' : saving ? 'Menyimpan...' : 'Simpan ke catatan hari ini'}</button>{saved ? <Link className="nm-text-link" to="/app/journal">Buka catatan <ArrowRight size={16} /></Link> : null}</div></section> : null}
  </div>;
}
