import type { FastifyServerOptions } from "fastify";

interface LoggerConfig {
	LOG_LEVEL: string;
	LOG_PRETTY?: boolean;
	OTEL_SERVICE_NAME: string;
}

export function createLoggerOptions(
	config: LoggerConfig,
): FastifyServerOptions["logger"] {
	return {
		level: config.LOG_LEVEL,
		redact: {
			paths: [
				"req.headers.authorization",
				"req.headers.cookie",
				"req.headers['x-internal-key']",
				"password",
				"token",
				"secret",
				"creditCard",
			],
			censor: "[REDACTED]",
		},
		serializers: {
			req(request) {
				return {
					method: request.method,
					url: request.url,
					hostname: request.hostname,
					remoteAddress: request.ip,
					remotePort: request.socket?.remotePort,
				};
			},
			res(reply) {
				return {
					statusCode: reply.statusCode,
				};
			},
		},
		formatters: {
			level(label: string) {
				return { level: label };
			},
		},
		timestamp: () => `,"time":"${new Date().toISOString()}"`,
		base: {
			service: config.OTEL_SERVICE_NAME,
		},
		...(config.LOG_PRETTY
			? {
					transport: {
						target: "pino-pretty",
						options: {
							colorize: true,
							translateTime: "SYS:HH:MM:ss.l",
							ignore: "pid,hostname",
						},
					},
				}
			: {}),
	};
}
