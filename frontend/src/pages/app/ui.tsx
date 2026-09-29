import type { ReactNode } from 'react';
import { ArrowRight, CircleAlert, LoaderCircle, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import './app-pages.css';

export type Meal = {
  type: string;
  title: string;
  desc?: string;
  calories: number;
  items?: string[];
};

export type MealPlan = {
  date?: string;
  target_calories?: number;
  summary: { calories: number; protein: number; carbs: number; fat: number };
  meals: Meal[];
};

export const number = (value: unknown): number => {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
};

export const rounded = (value: unknown) => Math.round(number(value)).toLocaleString('id-ID');

export function localISODate(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDate(value: string, options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }): string {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('id-ID', options).format(date);
}

export function errorMessage(error: unknown, fallback = 'Ada kendala saat memuat data. Coba lagi sebentar.'): string {
  const message = error instanceof Error ? error.message : String(error || '');
  if (/OPENAI_API_KEY|AI features|API key/i.test(message)) {
    return 'Fitur AI belum aktif. Tambahkan OPENAI_API_KEY ke file .env, lalu mulai ulang server.';
  }
  if (/unauthorized|401/i.test(message)) return 'Sesi Anda berakhir. Masuk kembali untuk melanjutkan.';
  return message && !/^\[object Object\]$/.test(message) ? message : fallback;
}

export function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <header className="nm-heading">
    <div><span className="nm-eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>
    {action ? <div className="nm-heading-action">{action}</div> : null}
  </header>;
}

export function LoadingState({ label = 'Menyiapkan data untuk Anda...' }: { label?: string }) {
  return <div className="nm-state nm-loading" role="status"><LoaderCircle aria-hidden="true" className="nm-spin" size={27} /><p>{label}</p></div>;
}

export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return <div className="nm-state nm-error" role="alert"><span className="nm-state-icon"><CircleAlert size={25} /></span><h2>Data belum bisa ditampilkan</h2><p>{message}</p>{retry ? <button type="button" className="nm-btn nm-btn-outline" onClick={retry}>Coba lagi <ArrowRight size={16} /></button> : null}</div>;
}

export function EmptyState({ icon, title, description, actionLabel, actionTo }: { icon?: ReactNode; title: string; description: string; actionLabel?: string; actionTo?: string }) {
  return <div className="nm-state nm-empty"><span className="nm-state-icon">{icon || <Sparkles size={27} />}</span><h2>{title}</h2><p>{description}</p>{actionLabel && actionTo ? <Link className="nm-btn nm-btn-primary" to={actionTo}>{actionLabel}<ArrowRight size={16} /></Link> : null}</div>;
}

export function NutrientPill({ label, value, unit = 'g', tone }: { label: string; value: unknown; unit?: string; tone: 'protein' | 'carbs' | 'fat' | 'calories' }) {
  return <div className={`nm-nutrient nm-nutrient-${tone}`}><span>{label}</span><strong>{rounded(value)} <small>{unit}</small></strong></div>;
}

export function MealCard({ meal, index = 0 }: { meal: Meal; index?: number }) {
  const labels: Record<string, string> = { Breakfast: 'Sarapan', Lunch: 'Makan siang', Dinner: 'Makan malam', Snack: 'Camilan' };
  const key = meal.type?.toLowerCase() || 'meal';
  return <article className="nm-meal-card">
    <div className={`nm-meal-symbol nm-meal-symbol-${key}`} aria-hidden="true">{String(index + 1).padStart(2, '0')}</div>
    <div className="nm-meal-body"><div className="nm-meal-top"><span className="nm-mini-label">{labels[meal.type] || meal.type}</span><span className="nm-meal-cal">{rounded(meal.calories)} kkal</span></div><h3>{meal.title}</h3>{meal.desc ? <p>{meal.desc}</p> : null}{meal.items?.length ? <div className="nm-item-list">{meal.items.map((item, itemIndex) => <span key={`${item}-${itemIndex}`}>{item}</span>)}</div> : null}</div>
  </article>;
}
