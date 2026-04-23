/**
 * Central metric instrument registry for EventKart API.
 *
 * All OTEL metric instruments are defined here so that domain modules
 * can import and emit metrics without coupling to OTEL internals.
 *
 * Instruments are safe to use even when no MeterProvider is configured —
 * they become no-ops via the OTEL API's default behavior.
 *
 * IMPORTANT: This module must be imported AFTER `initTelemetry()` runs
 * (guaranteed by the dynamic import in server.ts).
 */
import { metrics } from "@opentelemetry/api";

const meter = metrics.getMeter("eventkart-api", "1.0.0");

// ── HTTP Request Metrics ────────────────────────────────────────────

export const httpRequestDuration = meter.createHistogram(
	"http.server.request.duration",
	{
		description: "HTTP server request duration",
		unit: "ms",
		advice: {
			explicitBucketBoundaries: [
				5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000,
			],
		},
	},
);

export const httpRequestTotal = meter.createCounter(
	"http.server.request.total",
	{
		description: "Total HTTP server requests",
	},
);

// ── Auth / OTP Metrics ──────────────────────────────────────────────

export const otpSendTotal = meter.createCounter("auth.otp.send.total", {
	description: "Total OTP send attempts",
});

export const otpVerifyTotal = meter.createCounter("auth.otp.verify.total", {
	description: "Total OTP verification attempts",
});

// ── Conversion Funnel ───────────────────────────────────────────────

/**
 * Tracks steps in the conversion funnel.
 * Attribute: `step` = "otp_sent" | "otp_verified" | "booking_created" | "payment_confirmed"
 */
export const funnelStepTotal = meter.createCounter("funnel.step.total", {
	description: "Conversion funnel step events",
});

// ── Booking Metrics (future — instruments ready for Module 1.x) ────

export const bookingCreateDuration = meter.createHistogram(
	"booking.create.duration",
	{
		description: "Booking creation duration",
		unit: "ms",
		advice: {
			explicitBucketBoundaries: [
				10, 25, 50, 100, 250, 500, 1000, 2500, 5000,
			],
		},
	},
);

export const bookingCreateTotal = meter.createCounter(
	"booking.create.total",
	{
		description: "Total booking creation attempts",
	},
);

// ── Payment Metrics (future — instruments ready for Module 2.x) ────

export const paymentOrderDuration = meter.createHistogram(
	"payment.order.duration",
	{
		description: "Payment order creation duration",
		unit: "ms",
		advice: {
			explicitBucketBoundaries: [
				50, 100, 250, 500, 1000, 2500, 5000, 10000,
			],
		},
	},
);

export const paymentOrderTotal = meter.createCounter(
	"payment.order.total",
	{
		description: "Total payment order creation attempts",
	},
);

export const paymentConfirmDuration = meter.createHistogram(
	"payment.confirm.duration",
	{
		description:
			"Payment confirmation end-to-end duration (webhook → booking state update)",
		unit: "ms",
		advice: {
			explicitBucketBoundaries: [
				100, 250, 500, 1000, 2500, 5000, 10000, 30000,
			],
		},
	},
);

// ── Webhook Metrics (future — instruments ready for Module 2.x) ────

export const webhookAckDuration = meter.createHistogram(
	"webhook.ack.duration",
	{
		description: "Webhook ACK latency (receive → 200 response)",
		unit: "ms",
		advice: {
			explicitBucketBoundaries: [1, 5, 10, 25, 50, 100, 500, 1000, 5000],
		},
	},
);

export const webhookProcessDuration = meter.createHistogram(
	"webhook.process.duration",
	{
		description: "Webhook processing duration (ACK → completion)",
		unit: "ms",
		advice: {
			explicitBucketBoundaries: [
				100, 500, 1000, 2500, 5000, 10000, 30000, 60000,
			],
		},
	},
);

// ── Queue Metrics (I-0.4.6 — BullMQ observability via polling) ──────

export const queueDepth = meter.createObservableGauge("queue.depth", {
	description: "Current queue depth (waiting + active jobs)",
});

export const queueOldestJobAge = meter.createObservableGauge(
	"queue.oldest_job_age",
	{
		description: "Age of oldest waiting job in queue",
		unit: "s",
	},
);

export const queueDelayedJobs = meter.createObservableGauge(
	"queue.delayed_jobs",
	{
		description: "Jobs delayed for retry (backoff) per queue",
	},
);

export const queueFailedJobs = meter.createObservableGauge(
	"queue.failed_jobs",
	{
		description: "Failed jobs per queue (awaiting retry or exhausted)",
	},
);

export const queueDlqDepth = meter.createObservableGauge("queue.dlq.depth", {
	description: "Total dead-letter queue depth",
});

// ── Database Metrics ────────────────────────────────────────────────
// NOTE: postgres.js does not expose pool wait time or connection stats.
// DB pool monitoring requires PgBouncer-level instrumentation or a
// different driver. These instruments cover what we CAN observe.

export const dbSlowQueryTotal = meter.createCounter("db.slow_query.total", {
	description: "Total slow database queries (>100ms)",
});

export const dbQueryDuration = meter.createHistogram("db.query.duration", {
	description: "Database query duration",
	unit: "ms",
	advice: {
		explicitBucketBoundaries: [1, 5, 10, 25, 50, 100, 250, 500, 1000],
	},
});

// ── Redis Metrics ───────────────────────────────────────────────────
// Collected via periodic INFO command polling (see plugins/metrics.ts).

export const redisMemoryUsage = meter.createObservableGauge(
	"redis.memory.used_bytes",
	{
		description: "Redis server memory usage",
		unit: "By",
	},
);

export const redisEvictedKeys = meter.createObservableCounter(
	"redis.evicted_keys.total",
	{
		description: "Total Redis evicted keys (monotonic)",
	},
);

export const redisConnectedClients = meter.createObservableGauge(
	"redis.connected_clients",
	{
		description: "Number of connected Redis clients",
	},
);

// ── Email Metrics (future — instruments ready for communications) ──

export const emailSendTotal = meter.createCounter("email.send.total", {
	description: "Total email send attempts",
});
