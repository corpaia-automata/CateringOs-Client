import LandingNavbar from '@/components/landing/LandingNavbar';
import LandingHero from '@/components/landing/LandingHero';
import LandingMetrics from '@/components/landing/LandingMetrics';
import LandingModules from '@/components/landing/LandingModules';
import LandingDashboard from '@/components/landing/LandingDashboard';
import LandingWorkflow from '@/components/landing/LandingWorkflow';
import LandingTestimonials from '@/components/landing/LandingTestimonials';
import LandingPricing from '@/components/landing/LandingPricing';
import LandingCTA from '@/components/landing/LandingCTA';
import LandingFooter from '@/components/landing/LandingFooter';

export default function RootPage() {
  return (
    <main className="bg-[#03060F] overflow-x-hidden">
      <LandingNavbar />
      <LandingHero />
      {/* <LandingMetrics /> */}
      <LandingModules />
      <LandingDashboard />
      <LandingWorkflow />
      {/* <LandingTestimonials /> */}
      <LandingPricing />
      <LandingCTA />
      <LandingFooter />
    </main>
  );
}
