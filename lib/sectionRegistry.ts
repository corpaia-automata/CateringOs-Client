import type { ComponentType } from 'react';

import BrandedCover from '@/components/sections/BrandedCover';
import ClientDetails from '@/components/sections/ClientDetails';
import CompanyProfile from '@/components/sections/CompanyProfile';
import EventDetails from '@/components/sections/EventDetails';
import EventSummary from '@/components/sections/EventSummary';
import Gallery from '@/components/sections/Gallery';
import MenuGroups from '@/components/sections/MenuGroups';
import PricingSummary from '@/components/sections/PricingSummary';
import ServiceSettings from '@/components/sections/ServiceSettings';
import Signature from '@/components/sections/Signature';
import SpecialInfo from '@/components/sections/SpecialInfo';
import Terms from '@/components/sections/Terms';
import TravelSchedule, { RoomsSchedule } from '@/components/sections/TravelSchedule';
import type { SectionProps } from '@/components/sections/types';

export const sectionRegistry: Record<string, ComponentType<SectionProps>> = {
  client_details: ClientDetails,
  event_details: EventDetails,
  event_summary: EventSummary,
  menu_groups: MenuGroups,
  pricing_summary: PricingSummary,
  terms: Terms,
  signature: Signature,
  special_info: SpecialInfo,
  travel_schedule: TravelSchedule,
  rooms_schedule: RoomsSchedule,
  branded_cover: BrandedCover,
  company_profile: CompanyProfile,
  gallery: Gallery,
  service_settings: ServiceSettings,
};
