import { Leaf } from 'lucide-react'
import { Link } from 'react-router-dom'

type BrandProps = {
  to?: string
  inverse?: boolean
}

export default function Brand({ to = '/', inverse = false }: BrandProps) {
  return (
    <Link className={`brand${inverse ? ' brand-inverse' : ''}`} to={to} aria-label="NutriMind, ke beranda">
      <span className="brand-mark"><Leaf size={22} strokeWidth={2.5} aria-hidden="true" /></span>
      <span>nutri<span className="brand-accent">mind</span><span className="brand-period">.</span></span>
    </Link>
  )
}
