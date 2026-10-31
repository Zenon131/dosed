import { createApplication } from "@specific-dev/framework";
import * as schema from './db/schema/schema.js';
import { register as registerMedicationRoutes } from './routes/medications.js';
import { register as registerDoseRoutes } from './routes/doses.js';
import { register as registerStatsRoutes } from './routes/stats.js';
import { register as registerSnarkRoutes } from './routes/snark.js';
import { register as registerDeviceRoutes } from './routes/devices.js';
import { dispatchDueNotifications } from './services/notification_dispatcher.js';
import { register as registerUserRoutes } from './routes/user.js';

// Create application with schema for full database type support
export const app = await createApplication(schema);

// Export App type for use in route files
export type App = typeof app;

// Register all route modules
registerMedicationRoutes(app, app.fastify);
registerDoseRoutes(app, app.fastify);
registerStatsRoutes(app, app.fastify);
registerSnarkRoutes(app, app.fastify);
registerDeviceRoutes(app, app.fastify);
registerUserRoutes(app, app.fastify);

await app.run();
app.logger.info('Application running');

// Start the AI Notification Dispatcher loop
setInterval(() => {
  dispatchDueNotifications(app).catch(err => {
    app.logger.error({ err }, 'Notification Dispatcher Loop Error');
  });
}, 60000);