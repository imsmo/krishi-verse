// apps/web-storefront/src/i18n/en.ts · English message catalog (the SOURCE-OF-TRUTH key set; hi.ts + gu.ts
// MUST mirror every key — Law 7, no inline literals in components/pages). Loaded by lib/i18n.ts into the
// shared @krishi-verse/i18n Translator. Plain data, no framework.
import type { Messages } from '@krishi-verse/i18n';

export const en: Messages = {
  'brand.tagline': 'Fresh from the farm',

  'nav.home': 'Home',
  'nav.pricing': 'Pricing',
  'nav.help': 'Help',
  'nav.about': 'About',
  'nav.blog': 'Blog',
  'nav.press': 'Press',
  'nav.signup': 'Sell on Krishi-Verse',
  'nav.login': 'Sign in',
  'nav.cart': 'Cart',
  'nav.primary': 'Primary',
  'lang.label': 'Language',

  'footer.tagline': 'A multi-tenant agri-commerce marketplace connecting farmers, traders and buyers across India.',
  'footer.rights': '© {year} {app}. All rights reserved.',
  'footer.col.company': 'Company',
  'footer.col.support': 'Support',
  'footer.col.sellers': 'For sellers',

  'common.loading': 'Loading…',
  'common.errorTitle': 'Something went wrong',
  'common.errorBody': 'We could not load this page just now. Please try again.',
  'common.retry': 'Try again',
  'common.notFoundTitle': 'Page not found',
  'common.notFoundBody': 'The page you are looking for does not exist or has moved.',
  'common.backHome': 'Back to home',

  'about.title': 'About Krishi-Verse',
  'about.lead': 'We connect India’s farmers, traders and buyers on one trusted marketplace.',
  'about.p1': 'Krishi-Verse is a multi-tenant agri-commerce platform: every seller gets their own storefront, and buyers discover fresh produce and agri-inputs from verified sellers across the country.',
  'about.p2': 'From listing and price discovery to secure payments, logistics and farm-to-fork traceability, the platform is built for scale, transparency and trust.',
  'about.missionTitle': 'Our mission',
  'about.mission': 'Put more of every rupee back in the farmer’s hands while giving buyers provenance they can verify.',

  'pricing.title': 'Pricing',
  'pricing.lead': 'Simple plans for sellers of every size. Buyers always browse and buy for free.',
  'pricing.note': 'Final pricing and platform fees are confirmed when you create a seller account.',
  'pricing.tier.free.name': 'Starter',
  'pricing.tier.free.price': '₹0',
  'pricing.tier.free.desc': 'List a small catalogue, accept orders, get paid to your wallet.',
  'pricing.tier.growth.name': 'Growth',
  'pricing.tier.growth.price': 'From ₹999/mo',
  'pricing.tier.growth.desc': 'Higher listing limits, auctions, promotions and priority support.',
  'pricing.tier.enterprise.name': 'Enterprise',
  'pricing.tier.enterprise.price': 'Talk to us',
  'pricing.tier.enterprise.desc': 'Custom limits, dedicated onboarding and integrations.',
  'pricing.cta': 'Start selling',

  'help.title': 'Help & support',
  'help.lead': 'Answers to the questions buyers ask most.',
  'help.q1': 'How do I buy on Krishi-Verse?',
  'help.a1': 'Browse a seller’s storefront, add items to your cart and check out securely. You’ll get an order confirmation and can track delivery from your account.',
  'help.q2': 'How are payments protected?',
  'help.a2': 'Payments are processed securely and held until your order is fulfilled. Money always moves through the platform wallet — never directly between strangers.',
  'help.q3': 'What is farm-to-fork traceability?',
  'help.a3': 'Many products carry a QR code. Scan it (or open the /trace link) to see the verified journey of the produce — no personal data, just provenance.',
  'help.q4': 'How do I become a seller?',
  'help.a4': 'Create a seller account from “Sell on Krishi-Verse”. You’ll get your own storefront and tools to list, price and fulfil orders.',
  'help.contact': 'Still need help? Reach our support team from within your account.',

  'blog.title': 'Blog',
  'blog.lead': 'Stories from the field, product updates and market insights.',
  'blog.empty': 'No posts published yet. Check back soon.',

  'press.title': 'Press',
  'press.lead': 'Media resources and company news.',
  'press.body': 'For interviews, brand assets or media enquiries, please contact our communications team. We’ll respond within two business days.',
  'press.contact': 'Media enquiries',

  'tenantsSignup.title': 'Sell on Krishi-Verse',
  'tenantsSignup.lead': 'Reach buyers across India with your own branded storefront.',
  'tenantsSignup.body': 'Set up your catalogue, accept orders and auctions, get paid to your wallet, and build trust with verified, traceable produce.',
  'tenantsSignup.bullet1': 'Your own storefront and catalogue',
  'tenantsSignup.bullet2': 'Secure payments and fast payouts',
  'tenantsSignup.bullet3': 'Logistics and farm-to-fork traceability built in',
  'tenantsSignup.cta': 'Create a seller account',
};
