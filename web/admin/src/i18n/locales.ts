export const locales = ['ar', 'en'] as const;
export type Locale = (typeof locales)[number];

export type Messages = {
  appName: string;
  status: string;
  domainsTitle: string;
  domainsSubtitle: string;
  domain: string;
  platform: string;
  custom: string;
  pending: string;
  verified: string;
  active: string;
  failed: string;
  disabled: string;
  primary: string;
  secondary: string;
  search: string;
  statusLabel: string;
  domainTypeLabel: string;
  sellerLabel: string;
  storeLabel: string;
  clearFilters: string;
  disable: string;
  enable: string;
  confirm: string;
  cancel: string;
  domainStateChanged: string;
  moderationFailed: string;
  noDomainsFound: string;
  all: string;
  previous: string;
  next: string;
  confirmDisableTitle: string;
  confirmDisableBody: string;
  confirmEnableTitle: string;
  confirmEnableBody: string;
};

export const messages: Record<Locale, Messages> = {
  ar: {
    appName: 'لوحة الإدارة',
    status: 'جاري التحميل...',
    domainsTitle: 'نطاقات الواجهات',
    domainsSubtitle: 'إدارة وإشراف نطاقات المتاجر عبر المنصة',
    domain: 'النطاق',
    platform: 'منصة',
    custom: 'مخصص',
    pending: 'قيد الانتظار',
    verified: 'موثق',
    active: 'نشط',
    failed: 'فشل',
    disabled: 'معطل',
    primary: 'رئيسي',
    secondary: 'ثانوي',
    search: 'البحث عن نطاق',
    statusLabel: 'الحالة',
    domainTypeLabel: 'نوع النطاق',
    sellerLabel: 'البائع',
    storeLabel: 'المتجر',
    clearFilters: 'مسح الفلاتر',
    disable: 'تعطيل',
    enable: 'تفعيل',
    confirm: 'تأكيد',
    cancel: 'إلغاء',
    domainStateChanged: 'تغيرت حالة النطاق. يرجى التحديث والمحاولة مرة أخرى.',
    moderationFailed: 'فشلت عملية الإشراف',
    noDomainsFound: 'لم يتم العثور على نطاقات',
    all: 'الكل',
    previous: 'السابق',
    next: 'التالي',
    confirmDisableTitle: 'تأكيد تعطيل النطاق',
    confirmDisableBody: 'هل أنت تأكد من تعطيل هذا النطاق؟ قد يؤثر تعطيل النطاق على توجيه المتجر، وقد يعيد النظام النطاق المبدئي للمنصة كـ نطاق رئيسي.',
    confirmEnableTitle: 'تأكيد إعادة تفعيل النطاق',
    confirmEnableBody: 'إعادة تفعيل النطاق لا يعني بالضرورة جعله نشطاً بشكل مباشر. قد يعود النطاق المخصص إلى حالة موثق أو قيد الانتظار ويتطلب تفعيلاً من البائع.'
  },
  en: {
    appName: 'Admin Dashboard',
    status: 'Loading...',
    domainsTitle: 'Storefront Domains',
    domainsSubtitle: 'Operational moderation across storefront domains',
    domain: 'Domain',
    platform: 'Platform',
    custom: 'Custom',
    pending: 'Pending',
    verified: 'Verified',
    active: 'Active',
    failed: 'Failed',
    disabled: 'Disabled',
    primary: 'Primary',
    secondary: 'Secondary',
    search: 'Search hostnames',
    statusLabel: 'Status',
    domainTypeLabel: 'Domain Type',
    sellerLabel: 'Seller',
    storeLabel: 'Store',
    clearFilters: 'Clear filters',
    disable: 'Disable',
    enable: 'Enable',
    confirm: 'Confirm',
    cancel: 'Cancel',
    domainStateChanged: 'Domain state changed. Refresh and try again.',
    moderationFailed: 'Moderation failed',
    noDomainsFound: 'No domains found',
    all: 'All',
    previous: 'Previous',
    next: 'Next',
    confirmDisableTitle: 'Confirm Disable Domain',
    confirmDisableBody: 'Are you sure you want to disable this domain? Disabling may affect Storefront routing and Core may restore the Store\'s active platform domain as primary.',
    confirmEnableTitle: 'Confirm Enable Domain',
    confirmEnableBody: 'Re-enabling this domain does not necessarily make a custom domain live. Custom domain may return to verified or pending status, and seller activation may still be required.'
  }
};

export function directionFor(locale: Locale): 'rtl' | 'ltr' {
  return locale === 'ar' ? 'rtl' : 'ltr';
}
