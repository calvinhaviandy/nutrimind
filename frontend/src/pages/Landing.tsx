import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, BarChart3, Camera, Check, ChevronDown, Droplets, Heart, Leaf, ScanLine, Sparkles, UtensilsCrossed } from 'lucide-react'
import Brand from '../components/Brand'
import SiteHeader from '../components/SiteHeader'
import { useAuth } from '../lib/auth'

const features = [
  { number: '01', icon: Camera, title: 'Kenali isi piringmu', description: 'Ambil foto makanan dan lihat perkiraan kalori serta makronutriennya. Simpan ke catatan harian dalam satu alur.', tag: 'Pindai makanan', tone: 'mint' },
  { number: '02', icon: UtensilsCrossed, title: 'Makan dengan rencana', description: 'Masukkan usia, ukuran tubuh, aktivitas, dan preferensi makan untuk mendapatkan ide menu harian yang lebih relevan.', tag: 'Rencana makan', tone: 'peach' },
  { number: '03', icon: BarChart3, title: 'Lihat gambaran besarnya', description: 'Pantau asupan, air minum, dan tren mingguan dalam tampilan yang mudah dipahami. Tahu apa yang sudah berjalan baik.', tag: 'Laporan', tone: 'lavender' },
]

const steps = [
  { number: '01', title: 'Buat akun', description: 'Mulai dengan ruang pribadi untuk menyimpan catatan dan rencana makanmu.' },
  { number: '02', title: 'Catat atau pindai', description: 'Foto makananmu untuk melihat perkiraan nutrisinya, lalu tambahkan ke jurnal.' },
  { number: '03', title: 'Temukan ritmemu', description: 'Susun rencana makan, catat air minum, dan pelajari pola dari laporan.' },
]

const faqs = [
  { question: 'Apakah NutriMind bisa digunakan gratis?', answer: 'Kamu bisa membuat akun dan memakai fitur yang tersedia di aplikasi ini tanpa biaya berlangganan. Fitur berbasis AI memerlukan layanan AI yang aktif pada server.' },
  { question: 'Seberapa akurat hasil pindai makanan?', answer: 'Hasil pindai adalah perkiraan berdasarkan foto dan data makanan yang tersedia. Porsi, bahan, serta cara memasak dapat mengubah nilai nutrisi sebenarnya.' },
  { question: 'Apakah rencana makan menggantikan saran ahli gizi?', answer: 'Tidak. Rencana makan adalah inspirasi umum untuk membantu mengatur kebiasaan. Untuk kebutuhan medis atau diet khusus, konsultasikan dengan ahli gizi atau tenaga kesehatan.' },
  { question: 'Data apa yang dapat saya lihat kembali?', answer: 'Kamu dapat meninjau catatan makanan, rencana makan yang disimpan, ringkasan asupan, dan laporan kalori dari akunmu.' },
]

function SamplePreview() {
  return (
    <div className="sample-preview" aria-label="Contoh tampilan ringkasan NutriMind">
      <div className="preview-header">
        <div className="preview-mark"><Leaf size={15} /></div>
        <span>Ringkasan harian</span>
        <span className="preview-dots"><i /><i /><i /></span>
      </div>
      <div className="preview-main">
        <div>
          <span className="preview-eyebrow">HARI INI</span>
          <strong>Pilihan kecil,<br />progres nyata.</strong>
          <p>Satu tempat untuk melihat pola makanmu.</p>
        </div>
        <div className="preview-ring"><span>1.420<small>kcal tercatat</small></span></div>
      </div>
      <div className="preview-macro-row">
        <div><span>Protein</span><strong>76 g</strong><i className="preview-bar green" /></div>
        <div><span>Karbo</span><strong>154 g</strong><i className="preview-bar orange" /></div>
        <div><span>Lemak</span><strong>48 g</strong><i className="preview-bar yellow" /></div>
      </div>
      <p className="preview-disclaimer">Contoh tampilan dengan data ilustrasi</p>
    </div>
  )
}

export default function Landing() {
  const { session } = useAuth()
  const ctaTarget = session?.authenticated ? '/app' : '/register'
  const ctaLabel = session?.authenticated ? 'Buka ruangmu' : 'Mulai perjalananmu'
  useEffect(() => { document.title = 'NutriMind — Kenali makanmu, rawat dirimu' }, [])

  return (
    <div className="landing-page">
      <SiteHeader />
      <main>
        <section className="hero-section">
          <div className="container hero-grid">
            <div className="hero-copy">
              <span className="eyebrow"><span className="eyebrow-dot" /> SAHABAT NUTRISI HARIANMU</span>
              <h1>Makan lebih sadar.<br /><em>Hidup terasa</em><br />lebih ringan.</h1>
              <p className="hero-lead">Tak perlu menebak isi piringmu. NutriMind membantumu mencatat makanan, menyusun rencana, dan memahami kebiasaan makan, selangkah demi selangkah.</p>
              <div className="hero-actions">
                <Link to={ctaTarget} className="button button-lg">{ctaLabel} <ArrowUpRight size={18} /></Link>
                <a href="#cara-kerja" className="button-text">Lihat cara kerjanya <ArrowRight size={17} /></a>
              </div>
              <div className="hero-proof"><span className="hero-proof-icon"><Heart size={18} fill="currentColor" /></span><p>Lebih paham makanmu.<br /><strong>Lebih mudah menjaga keseimbangan.</strong></p></div>
            </div>
            <div className="hero-visual">
              <div className="hero-visual-frame"><img src="/images/hero-meal.png" alt="Semangkuk makanan seimbang berisi ayam, sayuran, alpukat, dan nasi" /></div>
              <div className="hero-visual-label"><span><ScanLine size={19} /></span><div><strong>Kenali makanmu</strong><small>Foto · Lihat nutrisi · Catat</small></div></div>
              <div className="hero-squiggle" aria-hidden="true">✳</div>
            </div>
          </div>
          <div className="container hero-bottom-note"><span>MAKAN ENAK, TETAP PAHAM</span><span className="hero-line" /><span>DIRANCANG UNTUK KESEHARIANMU</span></div>
        </section>

        <section className="promise-strip" aria-label="Manfaat NutriMind">
          <div className="container promise-grid">
            <div><span className="promise-icon"><Camera size={21} /></span><strong>Foto makananmu</strong><p>Kenali perkiraan nutrisinya</p></div>
            <div><span className="promise-icon"><Sparkles size={21} /></span><strong>Rencanakan menu</strong><p>Sesuaikan dengan preferensimu</p></div>
            <div><span className="promise-icon"><BarChart3 size={21} /></span><strong>Pahami progres</strong><p>Lihat pola yang terbentuk</p></div>
          </div>
        </section>

        <section id="fitur" className="features-section section-pad">
          <div className="container">
            <div className="section-heading section-heading-split">
              <div><span className="eyebrow">LEBIH DARI SEKADAR ANGKA</span><h2>Kebiasaan sehat jadi <em>lebih sederhana.</em></h2></div>
              <p>Semua yang kamu butuhkan untuk mengenal pola makanmu, dalam satu ruang yang tenang dan mudah digunakan.</p>
            </div>
            <div className="feature-grid">
              {features.map(({ number, icon: Icon, title, description, tag, tone }) => (
                <article className={`feature-card feature-${tone}`} key={title}>
                  <div className="feature-card-top"><span>{number} / 03</span><ArrowUpRight size={18} /></div>
                  <span className="feature-icon"><Icon size={30} strokeWidth={1.75} /></span>
                  <span className="feature-tag">{tag}</span>
                  <h3>{title}</h3><p>{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="spotlight-section section-pad">
          <div className="container spotlight-grid">
            <div className="spotlight-copy">
              <span className="eyebrow eyebrow-light">RUANG UNTUK MEMAHAMI DIRI</span>
              <h2>Bukan tentang sempurna.<br /><em>Tentang lebih sadar.</em></h2>
              <p>Setiap catatan adalah petunjuk. Lihat apa yang kamu makan, bagaimana keseimbangan nutrisimu, dan kebiasaan mana yang ingin kamu bangun berikutnya.</p>
              <ul>
                <li><Check size={17} /> Ringkasan kalori dan makronutrien harian</li>
                <li><Check size={17} /> Catatan air minum yang mudah diperbarui</li>
                <li><Check size={17} /> Tren mingguan dan bulanan</li>
              </ul>
              <Link className="button button-light" to={ctaTarget}>{session?.authenticated ? 'Buka ruangmu' : 'Coba NutriMind'} <ArrowUpRight size={18} /></Link>
            </div>
            <SamplePreview />
          </div>
        </section>

        <section id="cara-kerja" className="steps-section section-pad">
          <div className="container">
            <div className="section-heading centered"><span className="eyebrow">CARA KERJANYA</span><h2>Mulai dari yang <em>mudah.</em></h2><p>Tiga langkah sederhana untuk membuat pilihan makan yang lebih kamu pahami.</p></div>
            <div className="steps-grid">
              {steps.map((step, index) => (
                <article className="step-card" key={step.number}>
                  <div className="step-number">{step.number}</div>
                  {index < steps.length - 1 && <span className="step-connector" aria-hidden="true" />}
                  <h3>{step.title}</h3><p>{step.description}</p>
                </article>
              ))}
            </div>
            <div className="steps-note"><Droplets size={19} /><span>Perubahan kecil yang konsisten dapat membentuk kebiasaan baru.</span></div>
          </div>
        </section>

        <section id="tanya-jawab" className="faq-section section-pad">
          <div className="container faq-grid">
            <div className="faq-intro"><span className="eyebrow">TANYA JAWAB</span><h2>Masih ingin tahu <em>lebih banyak?</em></h2><p>Beberapa hal yang sering ditanyakan sebelum memulai.</p><span className="faq-sun" aria-hidden="true">✳</span></div>
            <div className="faq-list">
              {faqs.map(({ question, answer }) => <details key={question}><summary>{question}<ChevronDown size={20} /></summary><p>{answer}</p></details>)}
            </div>
          </div>
        </section>

        <section className="final-cta-section">
          <div className="container final-cta">
            <div className="final-cta-star" aria-hidden="true">✳</div>
            <span className="eyebrow eyebrow-light">MULAI HARI INI</span>
            <h2>Kenali makanmu.<br /><em>Rawat dirimu.</em></h2>
            <p>Satu langkah kecil hari ini bisa membuat pilihan besok terasa lebih mudah.</p>
            <Link className="button button-light button-lg" to={ctaTarget}>{session?.authenticated ? 'Buka ruangmu' : 'Buat akun gratis'} <ArrowUpRight size={19} /></Link>
          </div>
        </section>
      </main>
      <footer className="site-footer"><div className="container footer-inner"><Brand /><p>Teman untuk makan lebih sadar, setiap hari.</p><span>© {new Date().getFullYear()} NutriMind</span></div></footer>
    </div>
  )
}
