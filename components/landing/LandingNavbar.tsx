'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';

const NAV_LINKS = [
  { label: 'Products', href: '#modules' },
  { label: 'Features', href: '#workflow' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'About', href: '#about' },
];

export default function LandingNavbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="w-full bg-black shadow-xl border-b border-white/5">
      <div className="max-w-7xl mx-auto px-5 lg:px-8 h-20 flex items-center justify-between">
        
        {/* Logo */}
        <Link href="/" className="flex items-center shrink-0">
          <img
            src="/logos/white-logo.png"
            alt="CateringOS"
            className="h-14 w-auto object-contain"
          />
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors duration-200 rounded-lg hover:bg-white/5"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Desktop CTA */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm text-slate-400 hover:text-white transition-colors duration-200 px-3 py-2"
          >
            Sign In
          </Link>

          <Link
            href="/login"
            className="text-sm font-medium px-5 py-2.5 bg-orange-500 hover:bg-orange-400 text-white rounded-xl transition-all duration-200 shadow-lg hover:shadow-orange-500/30"
          >
            Get Started
          </Link>
        </div>

        {/* Mobile Toggle */}
        <button
          onClick={() => setOpen(!open)}
          className="md:hidden p-2 text-slate-400 hover:text-white transition-colors"
          aria-label="Toggle menu"
        >
          {open ? (
            <X className="w-6 h-6" />
          ) : (
            <Menu className="w-6 h-6" />
          )}
        </button>
      </div>

      {/* Mobile Drawer */}
      {open && (
        <div className="md:hidden bg-black border-t border-white/5 px-5 py-4 space-y-1 shadow-2xl">
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              onClick={() => setOpen(false)}
              className="block px-4 py-3 text-sm text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
            >
              {link.label}
            </a>
          ))}

          <div className="pt-4 mt-3 border-t border-white/5 flex flex-col gap-2">
            <Link
              href="/login"
              className="block px-4 py-3 text-sm text-slate-300 text-center hover:text-white rounded-lg"
            >
              Sign In
            </Link>

            <Link
              href="/login"
              className="block px-4 py-3 text-sm font-medium bg-orange-500 hover:bg-orange-400 text-white rounded-xl text-center transition-all duration-200"
            >
              Get Started
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}