import type { MemberRecord } from "@/lib/member-schema";

/**
 * Duplicate detection for uploads.
 * A row is a duplicate when ANY of these already exists in the register:
 *   • registration / membership number
 *   • full name (first + second + third, order-insensitive)
 *   • phone number (any number in a multi-number cell, last 10 digits)
 *   • e-mail address (any address in a multi-address cell)
 * Duplicates are ignored — only genuinely new rows are uploaded.
 */

export type Fingerprint = {
  regNumbers: string[];
  names: string[];
  phones: string[];
  emails: string[];
};

export function normalizeReg(value: string): string {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function normalizeName(...parts: (string | undefined)[]): string {
  const words = parts
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .sort();
  return words.join(" ");
}

export function normalizePhones(value: string): string[] {
  return (value ?? "")
    .split(/[,/;|]+/)
    .map((part) => part.replace(/\D/g, ""))
    .filter((digits) => digits.length >= 7)
    // compare on the last 10 digits so 0803... and +234803... match
    .map((digits) => digits.slice(-10));
}

export function normalizeEmails(value: string): string[] {
  return (value ?? "")
    .split(/[,;\s]+/)
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part.includes("@") && part.length > 4);
}

export function fingerprintOf(record: {
  memberId?: string;
  name?: string;
  firstName?: string;
  secondName?: string;
  thirdName?: string;
  phone?: string;
  email?: string;
}): Fingerprint {
  const reg = normalizeReg(record.memberId ?? "");
  const name =
    normalizeName(record.firstName, record.secondName, record.thirdName) || normalizeName(record.name);
  return {
    regNumbers: reg ? [reg] : [],
    names: name ? [name] : [],
    phones: normalizePhones(record.phone ?? ""),
    emails: normalizeEmails(record.email ?? ""),
  };
}

/** Running index of everything already seen (database rows + earlier rows in this upload). */
export class DuplicateIndex {
  private regs = new Set<string>();
  private names = new Set<string>();
  private phones = new Set<string>();
  private emails = new Set<string>();

  add(fingerprint: Fingerprint): void {
    for (const value of fingerprint.regNumbers) this.regs.add(value);
    for (const value of fingerprint.names) this.names.add(value);
    for (const value of fingerprint.phones) this.phones.add(value);
    for (const value of fingerprint.emails) this.emails.add(value);
  }

  /** Returns the field that matched, or null when the row is new. */
  match(fingerprint: Fingerprint): "registration number" | "name" | "phone" | "email" | null {
    if (fingerprint.regNumbers.some((value) => this.regs.has(value))) return "registration number";
    if (fingerprint.names.some((value) => this.names.has(value))) return "name";
    if (fingerprint.phones.some((value) => this.phones.has(value))) return "phone";
    if (fingerprint.emails.some((value) => this.emails.has(value))) return "email";
    return null;
  }

  get size(): number {
    return this.regs.size;
  }
}

export type DuplicateCheck = {
  unique: MemberRecord[];
  duplicates: { record: MemberRecord; reason: string }[];
};

/** Split a batch into new rows and ignored duplicates using a prepared index. */
export function splitDuplicates(rows: MemberRecord[], index: DuplicateIndex): DuplicateCheck {
  const unique: MemberRecord[] = [];
  const duplicates: { record: MemberRecord; reason: string }[] = [];
  for (const record of rows) {
    const fingerprint = fingerprintOf(record);
    const reason = index.match(fingerprint);
    if (reason) {
      duplicates.push({ record, reason });
      continue;
    }
    index.add(fingerprint);
    unique.push(record);
  }
  return { unique, duplicates };
}
