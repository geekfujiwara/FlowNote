/**
 * Azure Application Insights – singleton initializer.
 *
 * Usage:
 *   import { appInsights, trackEvent, trackPageView } from '@/lib/appInsights'
 *
 * Connection string is read from VITE_APPINSIGHTS_CONNECTION_STRING.
 * If blank (local dev / test), all calls are no-ops.
 */

import { ApplicationInsights } from '@microsoft/applicationinsights-web'

const connStr = import.meta.env.VITE_APPINSIGHTS_CONNECTION_STRING as string | undefined

let _ai: ApplicationInsights | null = null

if (connStr) {
  _ai = new ApplicationInsights({
    config: {
      connectionString: connStr,
      enableAutoRouteTracking: true,
      disableFetchTracking: false,
      enableCorsCorrelation: true,
      enableRequestHeaderTracking: true,
      enableResponseHeaderTracking: true,
      // Prevent Permissions Policy violation: 'unload is not allowed'
      // Modern browsers (and Azure SWA) block the unload event via Permissions-Policy.
      // Use 'visibilitychange' (pagehide alternative) for flush instead.
      disablePageUnloadEvents: ['unload'],
    },
  })
  _ai.loadAppInsights()
  _ai.trackPageView()
}

export const appInsights = _ai

/** Track a named event with optional properties */
export function trackEvent(name: string, properties?: Record<string, string | number | boolean>) {
  _ai?.trackEvent({ name }, properties)
}

/** Track a page view */
export function trackPageView(name: string) {
  _ai?.trackPageView({ name })
}

/** Track an exception */
export function trackException(error: Error, properties?: Record<string, string>) {
  _ai?.trackException({ exception: error, properties })
}

/** Track a metric value */
export function trackMetric(name: string, value: number) {
  _ai?.trackMetric({ name, average: value })
}
