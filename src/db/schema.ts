import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export type MemberData = Record<string, string>;

export const settings = pgTable("settings", {
  id: integer("id").primaryKey(),
  orgName: text("org_name").notNull().default("Chartered Institute of Loan & Risk Management of Nigeria"),
  shortName: text("short_name").notNull().default("CILRMNG"),
  tagline: text("tagline").notNull().default("Minimizing Risks, Maximizing Opportunities"),
  logoUrl: text("logo_url").notNull().default("/images/cilrm-logo.png"),
  supportEmail: text("support_email").notNull().default("info@cilrmng.org"),
  primaryColor: text("primary_color").notNull().default("#EA580C"),
  requireVerification: boolean("require_verification").notNull().default(true),
  guestSearchFields: jsonb("guest_search_fields")
    .$type<string[]>()
    .notNull()
    .default(["memberId", "firstName", "secondName", "thirdName", "email", "phone"]),
  /** Feedback destinations — entered manually by the root admin. */
  feedbackEmail: text("feedback_email").notNull().default(""),
  feedbackWhatsapp: text("feedback_whatsapp").notNull().default(""),
  autoBackup: boolean("auto_backup").notNull().default(true),
  backupFrequency: text("backup_frequency").notNull().default("daily"),
  lastAutoBackupAt: timestamp("last_auto_backup_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const admins = pgTable(
  "admins",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    /** Single sign-in email — personal or office, any provider. */
    email: text("email").notNull(),
    /** Role/title within the institute, e.g. "Registrar". */
    position: text("position").notNull().default(""),
    phone: text("phone").notNull().default(""),
    passwordHash: text("password_hash").notNull(),
    /** scrypt hash of the one-time recovery code (self-service password reset). */
    recoveryHash: text("recovery_hash").notNull().default(""),
    role: text("role").notNull().default("admin"),
    /** active = approved. New admins created by root are approved immediately. */
    status: text("status").notNull().default("active"),
    createdBy: integer("created_by"),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("admins_email_unique").on(table.email)],
);

export const adminSessions = pgTable(
  "admin_sessions",
  {
    token: text("token").primaryKey(),
    adminId: integer("admin_id")
      .notNull()
      .references(() => admins.id, { onDelete: "cascade" }),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("admin_sessions_admin_idx").on(table.adminId)],
);

export const imports = pgTable("imports", {
  id: serial("id").primaryKey(),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull().default("csv"),
  source: text("source").notNull().default("upload"),
  status: text("status").notNull().default("completed"),
  rowsTotal: integer("rows_total").notNull().default(0),
  rowsImported: integer("rows_imported").notNull().default(0),
  rowsUpdated: integer("rows_updated").notNull().default(0),
  rowsSkipped: integer("rows_skipped").notNull().default(0),
  rowsFailed: integer("rows_failed").notNull().default(0),
  columnCount: integer("column_count").notNull().default(0),
  createdBy: integer("created_by"),
  createdByName: text("created_by_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const members = pgTable(
  "members",
  {
    id: serial("id").primaryKey(),
    /** Registration / membership number — editable by root admin only. */
    memberId: text("member_id").notNull(),
    /** Original NAME cell, exactly as uploaded. */
    name: text("name").notNull().default(""),
    firstName: text("first_name").notNull().default(""),
    secondName: text("second_name").notNull().default(""),
    thirdName: text("third_name").notNull().default(""),
    fullName: text("full_name").notNull().default(""),
    email: text("email").notNull().default(""),
    phone: text("phone").notNull().default(""),
    contactAddress: text("contact_address").notNull().default(""),
    certificateCollected: text("certificate_collected").notNull().default(""),
    yearOfReg: text("year_of_reg").notNull().default(""),
    grade: text("grade").notNull().default(""),
    category: text("category").notNull().default(""),
    status: text("status").notNull().default("Active"),
    region: text("region").notNull().default(""),
    /** Original uploaded row, preserved exactly as received. */
    data: jsonb("data").$type<MemberData>().notNull().default({}),
    importId: integer("import_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("members_member_id_unique").on(table.memberId),
    index("members_name_idx").on(table.name),
    index("members_third_name_idx").on(table.thirdName),
    index("members_first_name_idx").on(table.firstName),
    index("members_year_idx").on(table.yearOfReg),
    index("members_email_idx").on(table.email),
    index("members_phone_idx").on(table.phone),
    index("members_status_idx").on(table.status),
    index("members_category_idx").on(table.category),
    index("members_updated_idx").on(table.updatedAt),
  ],
);

/** Admin-generated read-only links sent to a guest from Settings. */
export const guestLinks = pgTable(
  "guest_links",
  {
    id: serial("id").primaryKey(),
    token: text("token").notNull(),
    memberRecordId: integer("member_record_id").notNull(),
    memberId: text("member_id").notNull(),
    memberName: text("member_name").notNull().default(""),
    note: text("note").notNull().default(""),
    createdBy: integer("created_by"),
    createdByName: text("created_by_name").notNull().default("system"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    viewCount: integer("view_count").notNull().default(0),
    lastViewedAt: timestamp("last_viewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("guest_links_token_unique").on(table.token), index("guest_links_member_idx").on(table.memberRecordId)],
);

/** Anonymous guest heartbeats — powers the "guests online" counter. */
export const guestPresence = pgTable(
  "guest_presence",
  {
    token: text("token").primaryKey(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("guest_presence_seen_idx").on(table.lastSeenAt)],
);

export const backups = pgTable("backups", {
  id: serial("id").primaryKey(),
  label: text("label").notNull(),
  kind: text("kind").notNull().default("manual"),
  location: text("location").notNull().default("vault"),
  rowCount: integer("row_count").notNull().default(0),
  sizeBytes: integer("size_bytes").notNull().default(0),
  checksum: text("checksum").notNull().default(""),
  payload: jsonb("payload").$type<{ members: MemberData[]; settings?: Record<string, unknown> }>(),
  createdBy: integer("created_by"),
  createdByName: text("created_by_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  actorId: integer("actor_id"),
  actorName: text("actor_name").notNull().default("system"),
  action: text("action").notNull(),
  detail: text("detail").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Admin = typeof admins.$inferSelect;
export type Member = typeof members.$inferSelect;
export type ImportRow = typeof imports.$inferSelect;
export type BackupRow = typeof backups.$inferSelect;
export type SettingsRow = typeof settings.$inferSelect;
export type AuditLogRow = typeof auditLogs.$inferSelect;
export type GuestLinkRow = typeof guestLinks.$inferSelect;
