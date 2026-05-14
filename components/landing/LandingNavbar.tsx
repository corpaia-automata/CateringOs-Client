'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Menu, X } from 'lucide-react';

const NAV_LINKS = [
  { label: 'Products', href: '#modules' },
  { label: 'Features', href: '#workflow' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'About', href: '#about' },
];

export default function LandingNavbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
        scrolled
          ? 'bg-[#03060F]/80 backdrop-blur-2xl border-b border-white/[0.05] shadow-[0_1px_40px_rgba(0,0,0,0.6)]'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-5 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center shrink-0">
          <Image
            src="/main.png"
            alt="CateringOS"
            width={140}
            height={36}
            className="object-contain"
            style={{ filter: 'brightness(0) invert(1)' }}
            priority
          />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-0.5">
          {NAV_LINKS.map((l) => (
            <a
              key={l.label}
              href={l.href}
              className="px-4 py-1.5 text-sm text-slate-400 hover:text-white transition-colors duration-200 rounded-lg hover:bg-white/[0.05]"
            >
              {l.label}
            </a>
          ))}
        </nav>

        {/* Desktop CTAs */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm text-slate-400 hover:text-white transition-colors duration-200 px-3 py-1.5"
          >
            Sign In
          </Link>
          <Link
            href="/login"
            className="text-sm font-medium px-4 py-2 bg-orange-500 hover:bg-orange-400 text-white rounded-lg transition-all duration-200 shadow-[0_0_20px_rgba(232,97,10,0.25)] hover:shadow-[0_0_30px_rgba(232,97,10,0.45)]"
          >
            Get Started
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          onClick={() => setOpen(!open)}
          className="md:hidden p-2 text-slate-400 hover:text-white transition-colors"
          aria-label="Toggle menu"
        >
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden bg-[#050B18]/95 backdrop-blur-2xl border-t border-white/[0.06] px-5 py-4 space-y-0.5">
          {NAV_LINKS.map((l) => (
            <a
              key={l.label}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block px-3 py-2.5 text-sm text-slate-400 hover:text-white hover:bg-white/[0.05] rounded-lg transition-colors"
            >
              {l.label}
            </a>
          ))}
          <div className="pt-3 mt-2 border-t border-white/[0.06] flex flex-col gap-2">
            <Link
              href="/login"
              className="block px-3 py-2.5 text-sm text-slate-300 text-center hover:text-white"
            >
              Sign In
            </Link>
            <Link
              href="/login"
              className="block px-4 py-2.5 text-sm font-medium bg-orange-500 text-white rounded-lg text-center"
            >
              Get Started
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
