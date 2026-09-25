/** Office Beacon main navigation — matches www.officebeacon.com */
export interface ObNavMenuColumn {
  title: string;
  url?: string;
  links?: ObNavLink[];
  /** megamenu--3 bottom-right CTA cell (no sub-links) */
  promo?: boolean;
}

export interface ObNavLink {
  label: string;
  url?: string;
  items?: ObNavLink[];
  menuColumns?: ObNavMenuColumn[];
}

const OB_MEGA_PROMO: ObNavMenuColumn = {
  title: "Discover More Services",
  url: "https://www.officebeacon.com/services/",
  links: [],
  promo: true,
};

export const OB_STAFFING_MEGA_COLUMNS: ObNavMenuColumn[] = [
  {
    title: "Back Office Operations",
    url: "https://www.officebeacon.com/services/backoffice-operations-virtual-assistant/",
    links: [
      { label: "Virtual Assistant", url: "https://www.officebeacon.com/services/virtual-assistant/" },
      { label: "Logistics Support", url: "https://www.officebeacon.com/services/logistics-support-virtual-assistant/" },
      { label: "Call Center", url: "https://www.officebeacon.com/services/call-center-virtual-assistant/" },
      { label: "Data Entry", url: "https://www.officebeacon.com/services/data-entry-virtual-assistant/" },
      { label: "AI Workflows", url: "https://www.officebeacon.com/services/ai-workflows-virtual-assistant/" },
      { label: "Project Management", url: "https://www.officebeacon.com/services/project-management-virtual-assistant/" },
    ],
  },
  {
    title: "Administrative Support",
    url: "https://www.officebeacon.com/services/administrative-support-virtual-assistant/",
    links: [
      { label: "Finance and Accounting", url: "https://www.officebeacon.com/services/finance-accounting-virtual-assistant/" },
      { label: "Legal Assistants", url: "https://www.officebeacon.com/services/legal-virtual-assistant/" },
      { label: "Human Resources", url: "https://www.officebeacon.com/services/human-resource-virtual-assistant/" },
      { label: "Interpretation Services", url: "https://www.officebeacon.com/services/language-translation-virtual-assistant/" },
    ],
  },
  {
    title: "All Industries",
    url: "https://www.officebeacon.com/industries",
    links: [
      { label: "Insurance", url: "https://www.officebeacon.com/industries/insurance-remote-staffing/" },
      { label: "Promotional Products", url: "https://www.officebeacon.com/industries/promotional-products-remote-staffing/" },
      { label: "Finance & Accounting", url: "https://www.officebeacon.com/industries/finance-accounting-remote-staffing/" },
      { label: "Healthcare", url: "https://www.officebeacon.com/industries/healthcare-remote-staffing/" },
      { label: "Legal", url: "https://www.officebeacon.com/industries/legal-remote-staffing/" },
      { label: "Property Management", url: "https://www.officebeacon.com/industries/property-management-remote-staffing/" },
      { label: "Construction", url: "https://www.officebeacon.com/industries/construction-remote-staffing/" },
      { label: "View All Industries", url: "https://www.officebeacon.com/industries/" },
    ],
  },
  {
    title: "Marketing, Sales & CRM Support",
    url: "https://www.officebeacon.com/services/marketing-sales-crm-support-virtual-assistant/",
    links: [
      { label: "Webstore and Website Management", url: "https://www.officebeacon.com/services/webstore-website-management-virtual-assistant/" },
      { label: "Sales Support and Lead Generation", url: "https://www.officebeacon.com/services/sales-support-lead-generation-virtual-assistant/" },
      { label: "Marketing Support", url: "https://www.officebeacon.com/services/marketing-support-virtual-assistant/" },
      { label: "Creative Design & Editing", url: "https://www.officebeacon.com/services/creative-design-editing-virtual-assistant/" },
    ],
  },
  {
    title: "Technical Support",
    url: "https://www.officebeacon.com/services/technical-support-virtual-assistant/",
    links: [
      { label: "Software Development", url: "https://www.officebeacon.com/services/software-development-virtual-assistant/" },
      { label: "IT Services", url: "https://www.officebeacon.com/services/devops-it-services-virtual-assistant/" },
      { label: "Cybersecurity & Compliance (iSecurify)", url: "https://www.officebeacon.com/services/cybersecurity-compliance-virtual-assistant/" },
    ],
  },
  OB_MEGA_PROMO,
];

export const OB_STAFFING_MOBILE_ITEMS: ObNavLink[] = [
  {
    label: "Backoffice Operations",
    url: "https://www.officebeacon.com/services/backoffice-operations-virtual-assistant/",
    items: [
      { label: "Virtual Assistant", url: "https://www.officebeacon.com/services/virtual-assistant/" },
      { label: "Logistics Support", url: "https://www.officebeacon.com/services/logistics-support-virtual-assistant/" },
      { label: "Call Center", url: "https://www.officebeacon.com/services/call-center-virtual-assistant/" },
      { label: "Data Entry", url: "https://www.officebeacon.com/services/data-entry-virtual-assistant/" },
      { label: "AI Workflows", url: "https://www.officebeacon.com/services/ai-workflows-virtual-assistant/" },
      { label: "Project Management", url: "https://www.officebeacon.com/services/project-management-virtual-assistant/" },
    ],
  },
  {
    label: "Administrative Support",
    url: "https://www.officebeacon.com/services/administrative-support-virtual-assistant/",
    items: [
      { label: "Finance and Accounting", url: "https://www.officebeacon.com/services/finance-accounting-virtual-assistant/" },
      { label: "Legal Assistants", url: "https://www.officebeacon.com/services/legal-virtual-assistant/" },
      { label: "Human Resources", url: "https://www.officebeacon.com/services/human-resource-virtual-assistant/" },
      { label: "Interpretation Services", url: "https://www.officebeacon.com/services/language-translation-virtual-assistant/" },
    ],
  },
  {
    label: "Marketing, Sales & CRM Support",
    url: "https://www.officebeacon.com/services/marketing-sales-crm-support-virtual-assistant/",
    items: [
      { label: "Webstore and Website Management", url: "https://www.officebeacon.com/services/webstore-website-management-virtual-assistant/" },
      { label: "Sales Support and Lead Generation", url: "https://www.officebeacon.com/services/sales-support-lead-generation-virtual-assistant/" },
      { label: "Marketing Support", url: "https://www.officebeacon.com/services/marketing-support-virtual-assistant/" },
      { label: "Creative Design & Editing", url: "https://www.officebeacon.com/services/creative-design-editing-virtual-assistant/" },
    ],
  },
  {
    label: "Technical Support",
    url: "https://www.officebeacon.com/services/technical-support-virtual-assistant/",
    items: [
      { label: "Software Development", url: "https://www.officebeacon.com/services/software-development-virtual-assistant/" },
      { label: "IT Services", url: "https://www.officebeacon.com/services/devops-it-services-virtual-assistant/" },
      { label: "Cybersecurity & Compliance (iSecurify)", url: "https://www.officebeacon.com/services/cybersecurity-compliance-virtual-assistant/" },
    ],
  },
  { label: "View All Services", url: "https://www.officebeacon.com/services/" },
];

export const OB_NAV_ITEMS: ObNavLink[] = [
  {
    label: "Solutions",
    items: [
      { label: "Boost Sales & Market Reach", url: "https://www.officebeacon.com/solutions/boost-sales-and-reach" },
      { label: "Reduce Costs & Overhead", url: "https://www.officebeacon.com/solutions/reduce-cost-overhead" },
      { label: "Save Time & Increase Efficiency", url: "https://www.officebeacon.com/solutions/save-time-increase-efficiency" },
      { label: "Strengthen Security & Compliance", url: "https://www.officebeacon.com/solutions/security-compliance" },
      { label: "Strategic Partnerships", url: "https://www.officebeacon.com/solutions/member-partnerships" },
    ],
  },
  {
    label: "Staffing Services",
    menuColumns: OB_STAFFING_MEGA_COLUMNS,
    items: OB_STAFFING_MOBILE_ITEMS,
  },
  {
    label: "All Industries",
    items: [
      { label: "Insurance", url: "https://www.officebeacon.com/industries/insurance-remote-staffing/" },
      { label: "Promotional Products", url: "https://www.officebeacon.com/industries/promotional-products-remote-staffing/" },
      { label: "Finance & Accounting", url: "https://www.officebeacon.com/industries/finance-accounting-remote-staffing/" },
      { label: "Healthcare", url: "https://www.officebeacon.com/industries/healthcare-remote-staffing/" },
      { label: "Legal", url: "https://www.officebeacon.com/industries/legal-remote-staffing/" },
      { label: "Property Management", url: "https://www.officebeacon.com/industries/property-management-remote-staffing/" },
      { label: "Construction", url: "https://www.officebeacon.com/industries/construction-remote-staffing/" },
      { label: "View All Industries", url: "https://www.officebeacon.com/industries/" },
    ],
  },
  { label: "How It Works", url: "/how-it-works" },
  {
    label: "About",
    items: [
      { label: "Why Office Beacon?", url: "https://www.officebeacon.com/why-office-beacon/" },
      { label: "Team", url: "https://www.officebeacon.com/team" },
      { label: "Data Protection - Certifications", url: "https://www.officebeacon.com/certification-data-protection" },
      { label: "Office Locations", url: "https://www.officebeacon.com/delivery-centers" },
      { label: "News", url: "https://www.officebeacon.com/press-release/" },
    ],
  },
  { label: "Events", url: "https://events.officebeacon.com/" },
  { label: "Careers", url: "https://www.officebeacon.com/careers" },
];
