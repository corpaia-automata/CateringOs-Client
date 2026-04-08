import DashboardLayout from '@/components/layout/DashboardLayout';
import { TenantProvider } from '@/contexts/TenantContext';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <TenantProvider>
      <DashboardLayout>{children}</DashboardLayout>
    </TenantProvider>
  );
}
