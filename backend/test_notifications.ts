
import { app } from "./src/index.js";
import { dispatchDueNotifications } from "./src/services/notification_dispatcher.js";
import { medications, devices } from "./src/db/schema/schema.js";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

async function runTest() {
  const deviceId = "test-device-123";
  const pushToken = "ExponentPushToken[abc123xyz]";
  
  // Setup device
  await app.db.insert(devices).values({
    id: deviceId,
    push_token: pushToken
  }).onConflictDoUpdate({
    target: [devices.id],
    set: { push_token: pushToken }
  });

  // Setup med due NOW
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  
  await app.db.insert(medications).values({
    id: randomUUID(),
    device_id: deviceId,
    name: "Test Med",
    dosage: "10mg",
    frequency: "once_daily",
    times: JSON.stringify([timeStr]),
    color: "#FF0000"
  });

  console.log(`Created med due at ${timeStr}. Triggering dispatcher...`);
  await dispatchDueNotifications(app);
  console.log("Dispatcher run complete.");
}

runTest().catch(console.error);
