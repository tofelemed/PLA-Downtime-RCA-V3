import { lazy } from 'react';

/** The MQTT wizard and panel load on first use (their own chunk; the PI console stays lean). */
export const LazyMqttWizardBody = lazy(() => import('./mqtt-wizard-body').then((module) => ({ default: module.MqttWizardBody })));
export const LazyMqttConnectionPanel = lazy(() => import('./mqtt-connection-panel').then((module) => ({ default: module.MqttConnectionPanel })));
