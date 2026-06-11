import { describe, test, expect } from "bun:test";
import { api, expectStatus } from "./helpers";

describe("API Integration Tests", () => {
  // Shared state for CRUD tests
  let medicationId: string;
  let doseId: string;

  describe("Medications", () => {
    test("Create a medication", async () => {
      const res = await api("/api/medications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Aspirin",
          dosage: "500mg",
          frequency: "twice_daily",
          times: ["08:00", "20:00"],
          color: "#FF5733",
          notes: "Take with food",
        }),
      });
      await expectStatus(res, 201);
      const data = await res.json();
      expect(data.id).toBeDefined();
      expect(data.name).toBe("Aspirin");
      expect(data.dosage).toBe("500mg");
      expect(data.frequency).toBe("twice_daily");
      medicationId = data.id;
    });

    test("Create medication with missing required field should fail", async () => {
      const res = await api("/api/medications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Ibuprofen",
          dosage: "200mg",
          // missing frequency, times, color
        }),
      });
      await expectStatus(res, 400);
    });

    test("Get all medications", async () => {
      const res = await api("/api/medications");
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data.medications).toBeDefined();
      expect(Array.isArray(data.medications)).toBe(true);
      expect(data.medications.length).toBeGreaterThan(0);
    });

    test("Get medication by ID", async () => {
      const res = await api(`/api/medications/${medicationId}`);
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data.id).toBe(medicationId);
      expect(data.name).toBe("Aspirin");
    });

    test("Get non-existent medication should return 404", async () => {
      const res = await api(
        "/api/medications/00000000-0000-0000-0000-000000000000"
      );
      await expectStatus(res, 404);
    });

    test("Get medication with invalid UUID format should fail", async () => {
      const res = await api("/api/medications/invalid-uuid");
      await expectStatus(res, 400);
    });

    test("Update a medication", async () => {
      const res = await api(`/api/medications/${medicationId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Aspirin Updated",
          dosage: "750mg",
          frequency: "three_times_daily",
          times: ["08:00", "14:00", "20:00"],
          color: "#FF0000",
        }),
      });
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data.name).toBe("Aspirin Updated");
      expect(data.dosage).toBe("750mg");
    });

    test("Update non-existent medication should return 404", async () => {
      const res = await api(
        "/api/medications/00000000-0000-0000-0000-000000000000",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "Ghost Medication",
          }),
        }
      );
      await expectStatus(res, 404);
    });

    test("Update medication with invalid UUID format should fail", async () => {
      const res = await api("/api/medications/invalid-uuid", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Updated Med",
        }),
      });
      await expectStatus(res, 400);
    });

    test("Delete a medication", async () => {
      const res = await api(`/api/medications/${medicationId}`, {
        method: "DELETE",
      });
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    test("Get deleted medication should return 404", async () => {
      const res = await api(`/api/medications/${medicationId}`);
      await expectStatus(res, 404);
    });

    test("Delete non-existent medication should return 404", async () => {
      const res = await api(
        "/api/medications/00000000-0000-0000-0000-000000000000",
        {
          method: "DELETE",
        }
      );
      await expectStatus(res, 404);
    });

    test("Delete medication with invalid UUID format should fail", async () => {
      const res = await api("/api/medications/invalid-uuid", {
        method: "DELETE",
      });
      await expectStatus(res, 400);
    });

    test("Create medication with all frequency types", async () => {
      const frequencies = [
        "once_daily",
        "twice_daily",
        "three_times_daily",
        "four_times_daily",
        "as_needed",
      ];

      for (const freq of frequencies) {
        const res = await api("/api/medications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: `Med-${freq}`,
            dosage: "100mg",
            frequency: freq,
            times: freq === "as_needed" ? [] : ["09:00"],
            color: "#000000",
          }),
        });
        await expectStatus(res, 201);
        const data = await res.json();
        expect(data.frequency).toBe(freq);
      }
    });
  });

  describe("Doses", () => {
    test("Create a medication for dose logging", async () => {
      const res = await api("/api/medications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Lisinopril",
          dosage: "10mg",
          frequency: "once_daily",
          times: ["09:00"],
          color: "#0000FF",
        }),
      });
      await expectStatus(res, 201);
      const data = await res.json();
      medicationId = data.id;
    });

    test("Log a dose", async () => {
      const res = await api("/api/doses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          medication_id: medicationId,
          scheduled_time: "09:00",
        }),
      });
      await expectStatus(res, 201);
      const data = await res.json();
      expect(data.id).toBeDefined();
      expect(data.medication_id).toBe(medicationId);
      doseId = data.id;
    });

    test("Log dose without scheduled_time", async () => {
      const res = await api("/api/doses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          medication_id: medicationId,
        }),
      });
      await expectStatus(res, 201);
      const data = await res.json();
      expect(data.id).toBeDefined();
      expect(data.medication_id).toBe(medicationId);
    });

    test("Log dose without medication_id should fail", async () => {
      const res = await api("/api/doses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduled_time: "09:00",
        }),
      });
      await expectStatus(res, 400);
    });

    test("Log dose with non-existent medication should fail", async () => {
      const res = await api("/api/doses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          medication_id: "00000000-0000-0000-0000-000000000000",
          scheduled_time: "09:00",
        }),
      });
      await expectStatus(res, 404);
    });

    test("Get doses for today", async () => {
      const today = new Date().toISOString().split("T")[0];
      const res = await api(`/api/doses/today?date=${today}`);
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data.doses).toBeDefined();
      expect(Array.isArray(data.doses)).toBe(true);
    });

    test("Get doses with invalid date format should fail", async () => {
      const res = await api("/api/doses/today?date=2024/01/01");
      await expectStatus(res, 400);
    });

    test("Delete a dose", async () => {
      const res = await api(`/api/doses/${doseId}`, {
        method: "DELETE",
      });
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    test("Delete non-existent dose should return 404", async () => {
      const res = await api(
        "/api/doses/00000000-0000-0000-0000-000000000000",
        {
          method: "DELETE",
        }
      );
      await expectStatus(res, 404);
    });

    test("Delete dose with invalid UUID format should fail", async () => {
      const res = await api("/api/doses/invalid-uuid", {
        method: "DELETE",
      });
      await expectStatus(res, 400);
    });
  });

  describe("Stats", () => {
    test("Get stats with valid date", async () => {
      const today = new Date().toISOString().split("T")[0];
      const res = await api(`/api/stats?date=${today}`);
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data.days).toBeDefined();
      expect(Array.isArray(data.days)).toBe(true);
      expect(data.current_streak).toBeDefined();
      expect(typeof data.current_streak).toBe("number");
      expect(data.total_taken_7d).toBeDefined();
      expect(typeof data.total_taken_7d).toBe("number");
      expect(data.total_expected_7d).toBeDefined();
      expect(typeof data.total_expected_7d).toBe("number");
    });

    test("Get stats with invalid date format should fail", async () => {
      const res = await api("/api/stats?date=2024/01/01");
      await expectStatus(res, 400);
    });

    test("Get stats with missing date parameter should fail", async () => {
      const res = await api("/api/stats");
      await expectStatus(res, 400);
    });
  });

  describe("Snark", () => {
    test("Get snarky message for missed medication", async () => {
      const res = await api("/api/snark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          medication_name: "Lisinopril",
          context: "missed",
          minutes_late: 120,
        }),
      });
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data.message).toBeDefined();
      expect(typeof data.message).toBe("string");
    });

    test("Get snarky message for due now", async () => {
      const res = await api("/api/snark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          medication_name: "Aspirin",
          context: "due_now",
        }),
      });
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data.message).toBeDefined();
    });

    test("Get snarky message for taken", async () => {
      const res = await api("/api/snark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          medication_name: "Ibuprofen",
          context: "taken",
        }),
      });
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data.message).toBeDefined();
    });

    test("Get snarky message for streak", async () => {
      const res = await api("/api/snark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          medication_name: "Vitamin D",
          context: "streak",
        }),
      });
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data.message).toBeDefined();
    });

    test("Get snark without required fields should fail", async () => {
      const res = await api("/api/snark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          medication_name: "Aspirin",
          // missing context
        }),
      });
      await expectStatus(res, 400);
    });

    test("Get snark with invalid context should fail", async () => {
      const res = await api("/api/snark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          medication_name: "Aspirin",
          context: "invalid_context",
        }),
      });
      await expectStatus(res, 400);
    });

    test("Generate snarky notification with all fields", async () => {
      const res = await api("/api/snark/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "John",
          medName: "Metformin",
          dosage: "500mg",
        }),
      });
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data.body).toBeDefined();
      expect(typeof data.body).toBe("string");
    });

    test("Generate snarky notification with only required field", async () => {
      const res = await api("/api/snark/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          medName: "Atorvastatin",
        }),
      });
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data.body).toBeDefined();
      expect(typeof data.body).toBe("string");
    });

    test("Generate snark without required medName field should fail", async () => {
      const res = await api("/api/snark/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "John",
          dosage: "500mg",
        }),
      });
      await expectStatus(res, 400);
    });
  });
});
