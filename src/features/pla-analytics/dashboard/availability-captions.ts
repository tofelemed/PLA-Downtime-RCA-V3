/**
 * QA PLA re-test: the dashboard shows two availabilities; each says what it is measured on, so they are not
 * read as one figure. The OEE availability is a component of the calculated periods' OEE; the downtime
 * tile's scheduled availability comes from the stop records of the window.
 */
export const OEE_AVAILABILITY_CAPTION = 'OEE component of the calculated periods (not the downtime scheduled availability)';
export const SCHEDULED_AVAILABILITY_CAPTION = 'Run time ÷ scheduled time, from the stop records of the window (not the OEE availability)';
