/** Display text for the sign-in page. Labels only: field ids, names and validation live in LoginForm. */
export const LOGIN_COPY = {
  documentTitle: 'Sign in · Traverse Forge',
  heroTitle: 'PRODUCTION ASSURANCE',
  heroSubtitle: 'TRAVERSE LOSS · DOWNTIME · ROOT CAUSE',
  appName: 'TRAVERSE FORGE',
  appSubtitle: 'PRODUCTION LOSS ACCOUNTING · DOWNTIME · RCA',
  noticeLead: 'Authorized use notice:',
  noticeBody:
    'Access is restricted to authorized personnel. All sessions, including failed attempts, are logged and monitored in accordance with the site cybersecurity policy aligned to IEC 62443. Loss records, classifications and investigation data are subject to audit trail and approval controls.',
  heading: 'Sign in',
  userIdLabel: 'Email',
  userIdPlaceholder: 'name@company.com',
  passwordLabel: 'Password',
  passwordPlaceholder: 'Enter your password',
  submit: 'Secure sign in',
  help: 'Access issues? Contact your site system administrator.',
  // Deliberately generic: must not reveal which field was wrong (OWASP ASVS, IEC 62443-3-3 SR 1.11).
  invalidCredentials: 'Sign-in failed. Check your credentials and try again.',
} as const;
