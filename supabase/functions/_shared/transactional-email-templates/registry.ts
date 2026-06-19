/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as dailyTaskReminder } from './daily-task-reminder.tsx'
import { template as weeklySalesReport } from './weekly-sales-report.tsx'
import { template as welcomeCustomer } from './welcome-customer.tsx'
import { template as leadForwardedToPartner } from './lead-forwarded-to-partner.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'daily-task-reminder': dailyTaskReminder,
  'weekly-sales-report': weeklySalesReport,
  'welcome-customer': welcomeCustomer,
  'lead-forwarded-to-partner': leadForwardedToPartner,
}
