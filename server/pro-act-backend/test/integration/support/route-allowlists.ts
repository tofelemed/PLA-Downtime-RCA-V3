/**
 * Every route the application registers is guarded (global `JwtAuthGuard`), except these explicitly
 * public ones (`@Public()` AND listed here). `register` is `@PublicIf('AUTH_ALLOW_PUBLIC_REGISTRATION')`,
 * so it stays guarded by default. Adding a public route is a deliberate, reviewed change to this list.
 */
export const PUBLIC_ROUTE_ALLOWLIST: ReadonlySet<string> = new Set([
  'AuthController.login',
  'AuthController.refresh',
  'AuthController.logout',
  'AuthController.validateToken',
  'HealthController.check',
  // readiness probe of the container and the deployment scripts (TF-PREP-001 §4.4)
  'HealthController.ready',
  // the sign-in page's name, logo and browser icon (settings audit, 21 Oct 2026)
  'BrandingPublicV2Controller.publicView',
]);

/**
 * Mutating routes a read-only caller (`viewer`, §13.2) may use: previews and validations that store
 * nothing, export requests and cancels over data it can already read, its own audit entries and its
 * own preferences. Adding a route here is a reviewed change (plan 3.11; decision "Read-only role
 * enforcement").
 */
export const READ_ONLY_ALLOWED_ROUTES: ReadonlySet<string> = new Set([
  'AuditLogController.create',
  'AppSettingsController.setValue',
  'AttributeMappingsV2Controller.preview',
  'CalendarScheduleV2Controller.preview',
  'ExportsV2Controller.create',
  'ExportsV2Controller.cancel',
  'RulesV2Controller.validate',
  'SignalsV2Controller.preview',
  'SourceMappingsV2Controller.preview',
]);
