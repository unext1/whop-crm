export type ColumnTemplate = {
  id: string;
  name: string;
  description: string;
  icon: string;
  columns: string[];
};

export const COLUMN_TEMPLATES: ColumnTemplate[] = [
  {
    id: 'empty',
    name: 'Empty',
    description: 'Start with an empty board',
    icon: '▪️',
    columns: [],
  },
  {
    id: 'sales',
    name: 'Sales',
    description: 'Lead generation and deal tracking',
    icon: '💰',
    columns: ['👋 Lead', '👍 Qualified', '💡 Proposal', '💬 Negotiation', '🎉 Won'],
  },
  {
    id: 'customer-success',
    name: 'Customer Success',
    description: 'Retention, expansion, and customer satisfaction',
    icon: '🤝',
    columns: ['📞 Onboarding', '✅ Active', '🔄 Expansion', '⚠️ At Risk', '❌ Churned'],
  },
  {
    id: 'fundraising',
    name: 'Fundraising',
    description: 'Donor outreach and campaign management',
    icon: '🎯',
    columns: ['📧 Outreach', '📅 Meeting Scheduled', '💼 Proposal Sent', '🤝 Negotiating', '✅ Committed'],
  },
  {
    id: 'investing',
    name: 'Investing',
    description: 'Deal sourcing and investment tracking',
    icon: '📊',
    columns: ['🔍 Sourcing', '📋 Due Diligence', '💼 Term Sheet', '📝 Legal', '✅ Closed'],
  },
];
