import {
	DOCUMENT_STATUSES,
	VERIFICATION_DOCUMENT_TYPES,
} from "@repo/shared/constants";
import {
	index,
	integer,
	pgEnum,
	pgTable,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { organizers } from "./organizers.js";
import { users } from "./users.js";

export const verificationDocumentTypeEnum = pgEnum(
	"verification_document_type",
	VERIFICATION_DOCUMENT_TYPES,
);

export const documentStatusEnum = pgEnum("document_status", DOCUMENT_STATUSES);

export const verificationDocuments = pgTable(
	"verification_documents",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizerId: uuid("organizer_id")
			.notNull()
			.references(() => organizers.id, { onDelete: "cascade" }),
		documentType: verificationDocumentTypeEnum("document_type").notNull(),
		storageKey: varchar("storage_key", { length: 500 }).notNull(),
		fileName: varchar("file_name", { length: 255 }).notNull(),
		contentType: varchar("content_type", { length: 100 }).notNull(),
		fileSize: integer("file_size"),
		status: documentStatusEnum("status").notNull().default("pending"),
		uploadedBy: uuid("uploaded_by").references(() => users.id, {
			onDelete: "set null",
		}),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("verification_documents_organizer_idx").on(table.organizerId),
		index("verification_documents_organizer_type_idx").on(
			table.organizerId,
			table.documentType,
			table.status,
		),
	],
);
