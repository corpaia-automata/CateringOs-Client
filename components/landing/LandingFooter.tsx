import Link from 'next/link';
import { ChefHat, Twitter, Linkedin, Instagram } from 'lucide-react';

const LINKS = {
  Product: [
    { label: 'Quotation Management', href: '#modules' },
    { label: 'Menu Planning', href: '#modules' },
    { label: 'Costing Engine', href: '#modules' },
    { label: 'CRM & Leads', href: '#modules' },
    { label: 'Analytics', href: '#modules' },
  ],
  Company: [
    { label: 'About Us', href: '#about' },
    { label: 'Careers', href: '#' },
    { label: 'Blog', href: '#' },
    { label: 'Press', href: '#' },
    { label: 'Contact', href: '#' },
  ],
  Support: [
    { label: 'Documentation', href: '#' },
    { label: 'Help Center', href: '#' },
    { label: 'Onboarding', href: '#' },
    { label: 'API Reference', href: '#' },
    { label: 'Status', href: '#' },
  ],
  Legal: [
    { label: 'Privacy Policy', href: '#' },
    { label: 'Terms of Service', href: '#' },
    { label: 'Cookie Policy', href: '#' },
    { label: 'Data Security', href: '#' },
  ],
};

const SOCIALS = [
  { Icon: Twitter, label: 'Twitter' },
  { Icon: Linkedin, label: 'LinkedIn' },
  { Icon: Instagram, label: 'Instagram' },
];

export default function LandingFooter() {
  return (
    <footer id="about" className="bg-[#03060F] border-t border-white/[0.05]">
      <div className="max-w-7xl mx-auto px-5 lg:px-8 py-14 lg:py-16">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-8 lg:gap-10">
          {/* Brand */}
          <div className="col-span-2">
            <Link href="/" className="inline-flex items-center gap-2.5 mb-4">
              <span className="w-8 h-8 rounded-[9px] bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-[0_0_12px_rgba(232,97,10,0.3)]">
                <ChefHat className="w-4 h-4 text-white" strokeWidth={2} />
              </span>
              <span className="text-white font-semibold text-[15px] tracking-tight">
                Catering<span className="text-orange-400">OS</span>
              </span>
            </Link>

            <p className="text-[13px] text-slate-500 leading-relaxed mb-5 max-w-[240px]">
              The complete operating system for modern catering businesses. Quotations, menus, CRM, and operations — unified.
            </p>

            <div className="flex gap-2.5">
              {SOCIALS.map(({ Icon, label }) => (
                <a
                  key={label}
                  href="#"
                  aria-label={label}
                  className="w-8 h-8 rounded-lg border border-white/[0.07] bg-white/[0.04] flex items-center justify-center text-slate-500 hover:text-white hover:border-white/[0.14] hover:bg-white/[0.07] transition-all duration-200"
                >
                  <Icon className="w-3.5 h-3.5" />
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(LINKS).map(([category, links]) => (
            <div key={category}>
              <h4 className="text-[11px] font-semibold text-white uppercase tracking-wider mb-4">
                {category}
              </h4>
              <ul className="space-y-2.5">
                {links.map(({ label, href }) => (
                  <li key={label}>
                    <a
                      href={href}
                      className="text-[13px] text-slate-500 hover:text-slate-300 transition-colors duration-200"
                    >
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-6 border-t border-white/[0.05] flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[12px] text-slate-600">
            &copy; {new Date().getFullYear()} CateringOS. All rights reserved.
          </p>
          <p className="text-[12px] text-slate-600">
            Built for caterers, by caterers &middot; Made in India &#127470;&#127475;
          </p>
        </div>
      </div>
    </footer>
  );
}
