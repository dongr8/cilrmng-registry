/**
 * CILRMNG register schema — modelled directly on the institute's Excel file:
 *   NAME | Registration Number | Certificate Collected | Year of Reg |
 *   CONTACT ADDRESS | TEL. NO | E-MAIL ADDRESS
 *
 * The single NAME column is automatically split into First / Second / Third
 * name while the original NAME text is preserved exactly as uploaded.
 * Missing values always display as "Nil".
 */

export const MEMBER_FIELDS = [
  { key: "name", label: "Name", group: "Name", aliases: ["name", "fullname", "membername", "names", "surnameandothernames"], sample: "OLOWOOKERE OLUWASEYI ISAAC" },
  { key: "firstName", label: "First Name", group: "Name", aliases: ["firstname", "givenname", "fname", "forename", "first"], sample: "OLOWOOKERE" },
  { key: "secondName", label: "Second Name", group: "Name", aliases: ["secondname", "middlename", "middlenames", "othernames", "othername", "second"], sample: "OLUWASEYI" },
  { key: "thirdName", label: "Third Name", group: "Name", aliases: ["thirdname", "surname", "lastname", "familyname", "lname", "last", "third"], sample: "ISAAC" },
  { key: "memberId", label: "Registration Number", group: "Registration", aliases: ["registrationnumber", "regnumber", "regno", "registrationno", "membershipnumber", "membershipno", "memberid", "membernumber", "id", "regnum"], sample: "3932/SILRM" },
  { key: "certificateCollected", label: "Certificate Collected", group: "Registration", aliases: ["certificatecollected", "certificate", "certcollected", "collected", "certificatestatus"], sample: "Yes" },
  { key: "yearOfReg", label: "Year of Reg", group: "Registration", aliases: ["yearofreg", "yearofregistration", "year", "regyear", "yearregistered", "datejoined", "joined"], sample: "2008" },
  { key: "contactAddress", label: "Contact Address", group: "Contact", aliases: ["contactaddress", "address", "postaladdress", "officeaddress", "residentialaddress", "contact"], sample: "10, OLABIRORO STREET, OFF ALLEN AVENUE, IKEJA LAGOS" },
  { key: "phone", label: "Tel. No", group: "Contact", aliases: ["telno", "tel", "telephone", "phone", "phonenumber", "mobile", "gsm", "telno.", "phoneno"], sample: "8034297656" },
  { key: "email", label: "E-mail Address", group: "Contact", aliases: ["emailaddress", "email", "e-mailaddress", "mail", "e-mail"], sample: "lincolm202@yahoo.com" },
  { key: "grade", label: "Membership Grade", group: "Membership", aliases: ["membershipgrade", "grade", "designation", "cadre"], sample: "SILRM" },
  { key: "category", label: "Membership Category", group: "Membership", aliases: ["membershipcategory", "category", "membercategory", "type", "membershiptype"], sample: "SILRM" },
  { key: "status", label: "Membership Status", group: "Membership", aliases: ["membershipstatus", "status", "memberstatus", "state", "duesstatus", "dues"], sample: "Active" },
  { key: "region", label: "State / Region", group: "Location", aliases: ["state", "region", "province", "location", "city", "branch", "chapter"], sample: "Lagos" },
  { key: "title", label: "Title", group: "Other", aliases: ["title", "salutation", "honorific"], sample: "Mr" },
  { key: "gender", label: "Gender", group: "Other", aliases: ["gender", "sex"], sample: "Male" },
  { key: "dateOfBirth", label: "Date of Birth", group: "Other", aliases: ["dateofbirth", "dob", "birthdate", "birthday"], sample: "1981-04-12" },
  { key: "nationality", label: "Nationality", group: "Other", aliases: ["nationality", "country", "citizenship"], sample: "Nigerian" },
  { key: "employer", label: "Employer / Organisation", group: "Other", aliases: ["employer", "organisation", "organization", "company", "workplace", "bank"], sample: "First Bank of Nigeria Plc" },
  { key: "profession", label: "Profession", group: "Other", aliases: ["profession", "occupation", "jobtitle", "discipline"], sample: "Credit Risk Analyst" },
] as const;

export type FieldKey = (typeof MEMBER_FIELDS)[number]["key"];
export type MemberRecord = Record<string, string>;

export const FIELD_KEYS = MEMBER_FIELDS.map((field) => field.key) as FieldKey[];
export const MAX_COLUMNS = 20;
export const MAX_ROWS = 100000;
export const NIL = "Nil";

/** Columns that appear in the institute's own spreadsheet, in file order. */
export const FILE_FIELD_KEYS: FieldKey[] = [
  "name",
  "memberId",
  "certificateCollected",
  "yearOfReg",
  "contactAddress",
  "phone",
  "email",
];

export const FIELD_BY_KEY: Record<FieldKey, (typeof MEMBER_FIELDS)[number]> = MEMBER_FIELDS.reduce(
  (acc, field) => {
    acc[field.key] = field;
    return acc;
  },
  {} as Record<FieldKey, (typeof MEMBER_FIELDS)[number]>,
);

export function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const ALIAS_LOOKUP: Record<string, FieldKey> = {};
for (const field of MEMBER_FIELDS) {
  ALIAS_LOOKUP[normalizeKey(field.key)] = field.key;
  ALIAS_LOOKUP[normalizeKey(field.label)] = field.key;
  for (const alias of field.aliases) ALIAS_LOOKUP[normalizeKey(alias)] = field.key;
}

export function autoMapHeaders(headers: string[]): Record<string, FieldKey | ""> {
  const mapping: Record<string, FieldKey | ""> = {};
  const used = new Set<FieldKey>();
  for (const header of headers) {
    const matched = ALIAS_LOOKUP[normalizeKey(header)] ?? "";
    if (matched && used.has(matched)) {
      mapping[header] = "";
      continue;
    }
    mapping[header] = matched;
    if (matched) used.add(matched);
  }
  return mapping;
}

/**
 * Split one NAME cell into First / Second / Third name, keeping the order
 * exactly as written in the file. Four or more words collapse into Third name
 * so nothing from the original cell is ever lost.
 */
export function splitName(value: string): { firstName: string; secondName: string; thirdName: string } {
  const cleaned = (value ?? "").replace(/\s+/g, " ").trim();
  if (!cleaned) return { firstName: "", secondName: "", thirdName: "" };
  const parts = cleaned.split(" ");
  if (parts.length === 1) return { firstName: parts[0], secondName: "", thirdName: "" };
  if (parts.length === 2) return { firstName: parts[0], secondName: parts[1], thirdName: "" };
  return { firstName: parts[0], secondName: parts[1], thirdName: parts.slice(2).join(" ") };
}

/** Grade suffix carried inside the registration number, e.g. 3932/SILRM → SILRM. */
export function gradeFromRegNumber(regNumber: string): string {
  const match = (regNumber ?? "").toUpperCase().match(/([A-Z]{3,8})\s*$/);
  return match ? match[1] : "";
}

export function yearFromRegNumber(regNumber: string): string {
  const match = (regNumber ?? "").match(/\b(19|20)\d{2}\b/);
  return match ? match[0] : "";
}

const NIGERIAN_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno", "Cross River",
  "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina",
  "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau",
  "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara", "Abuja", "FCT",
];

/** Best-effort state detection from the free-text contact address. */
export function regionFromAddress(address: string): string {
  const haystack = (address ?? "").toUpperCase();
  if (!haystack) return "";
  for (const state of NIGERIAN_STATES) {
    if (haystack.includes(state.toUpperCase())) return state === "FCT" ? "Abuja" : state;
  }
  return "";
}

function cleanValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";
    return value.toISOString().slice(0, 10);
  }
  const text = String(value).replace(/\s+/g, " ").trim();
  if (!text) return "";
  const lowered = text.toLowerCase();
  if (lowered === "undefined" || lowered === "null" || text === "-" || lowered === "n/a" || lowered === "nil") return "";
  return text;
}

/** Fill derived fields (names, grade, state) without ever overwriting file data. */
export function enrichRecord(record: MemberRecord): MemberRecord {
  const hasSplitNames = Boolean(record.firstName || record.secondName || record.thirdName);
  if (record.name && !hasSplitNames) {
    const split = splitName(record.name);
    record.firstName = split.firstName;
    record.secondName = split.secondName;
    record.thirdName = split.thirdName;
  }
  if (!record.name) {
    record.name = [record.firstName, record.secondName, record.thirdName].filter(Boolean).join(" ");
  }
  if (!record.grade && record.memberId) record.grade = gradeFromRegNumber(record.memberId);
  if (!record.category && record.grade) record.category = record.grade;
  if (!record.region && record.contactAddress) record.region = regionFromAddress(record.contactAddress);
  if (!record.yearOfReg && record.memberId) record.yearOfReg = yearFromRegNumber(record.memberId);
  if (!record.status) record.status = "Active";
  return record;
}

export function buildRecord(
  raw: Record<string, unknown>,
  mapping: Record<string, FieldKey | "">,
): MemberRecord {
  const record: MemberRecord = {};
  for (const field of FIELD_KEYS) record[field] = "";
  for (const [header, key] of Object.entries(mapping)) {
    if (!key) continue;
    const value = cleanValue(raw[header]);
    if (value && !record[key]) record[key] = value;
  }
  return enrichRecord(record);
}

/** Display name reads First Name → Second Name → Third Name. */
export function fullNameOf(record: MemberRecord, fallback = ""): string {
  const parts = [record.firstName, record.secondName, record.thirdName]
    .map((part) => (part ?? "").trim())
    .filter(Boolean);
  if (parts.length) return parts.join(" ");
  return (record.name ?? "").trim() || fallback;
}

export function display(value: string | undefined | null): string {
  const text = (value ?? "").trim();
  return text ? text : NIL;
}

const SEARCH_SPLIT = /[\s,]+/;

export function matchesQuery(record: MemberRecord, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const haystack = [
    record.memberId,
    record.name,
    record.firstName,
    record.secondName,
    record.thirdName,
    record.email,
    record.phone,
    record.contactAddress,
    record.grade,
    record.category,
    record.status,
    record.region,
    record.yearOfReg,
  ]
    .join(" ")
    .toLowerCase();
  return needle.split(SEARCH_SPLIT).every((token) => haystack.includes(token));
}

export function maskValue(value: string, visible = 2): string {
  if (!value) return NIL;
  if (value.length <= visible) return "•".repeat(value.length);
  return `${"•".repeat(Math.max(2, value.length - visible))}${value.slice(-visible)}`;
}

export function maskEmail(email: string): string {
  if (!email) return NIL;
  const first = email.split(/[,/;]/)[0].trim();
  if (!first.includes("@")) return "•••";
  const [user, domain] = first.split("@");
  return `${user.slice(0, 1)}${"•".repeat(Math.max(2, user.length - 1))}@${domain}`;
}

export function maskPhone(phone: string): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (!digits) return phone ? "•••" : NIL;
  return `••• ${digits.slice(-2)}`;
}

export function maskAddress(address: string): string {
  const text = (address ?? "").trim();
  if (!text) return NIL;
  const region = regionFromAddress(text);
  return region ? `••• ${region}` : "•••";
}

export function phoneTail(phone: string, length = 4): string {
  return (phone ?? "").replace(/\D/g, "").slice(-length);
}

/** Every phone number in a multi-number cell, e.g. "8033358081, 08073153404". */
export function phoneTails(phone: string, length = 4): string[] {
  return (phone ?? "")
    .split(/[,/;|]+/)
    .map((part) => part.replace(/\D/g, ""))
    .filter((digits) => digits.length >= 6)
    .map((digits) => digits.slice(-length));
}

export function emailList(email: string): string[] {
  return (email ?? "")
    .split(/[,/;\s]+/)
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part.includes("@"));
}

/** Template mirrors the institute's own sheet exactly. */
export const SAMPLE_HEADERS = ["NAME", "Registration Number", "Certificate Collected", "Year of Reg", "CONTACT ADDRESS", "TEL. NO", "E-MAIL ADDRESS"];

const SAMPLE_ROWS = [
  ["OLOWOOKERE OLUWASEYI ISAAC", "3932/SILRM", "", "", "10, OLABIRORO STREET, OFF ALLEN AVENUE, IKEJA LAGOS", "8034297656", "lincolm202@yahoo.com"],
  ["IKENZE AUGUSTINE IFEANYI", "2743/SILRM", "", "", "P.M.B 80067", "8023854484", "zenkaf@yahoo.com"],
  ["UZOMBAH N. INNOCENT", "1A/SILRM", "", "", "41, IJOKO ROAD, OLORI, AKUTE, OGUN STATE.", "8033762820", "innobee2000@yahoo.com"],
  ["IDEM VICTOR EMMANUEL", "2333/SICRM", "", "", "C/O FIRST BANK OF NIG. PLC, UYO-ABAK ROAD, UYO, AKWA IBOM", "7066864594, 7031177721", "victorix76@yahoo.com"],
  ["SALAWU MOHAMMED", "326/MICRM", "Yes", "2006", "P.O.BOX 5279, IKEJA- LAGOS.", "8033340904", "msalawu@yahoo.com"],
];

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function generateSampleCsv(): string {
  const lines = [SAMPLE_HEADERS.map(csvEscape).join(",")];
  for (const row of SAMPLE_ROWS) lines.push(row.map(csvEscape).join(","));
  return lines.join("\r\n");
}

export const DUPLICATE_STRATEGIES = [
  { value: "skip", label: "Skip existing members" },
  { value: "update", label: "Update existing members" },
  { value: "replace", label: "Replace entire register with this file" },
] as const;

export type DuplicateStrategy = (typeof DUPLICATE_STRATEGIES)[number]["value"];

export const MEMBER_STATUSES = ["Active", "Pending", "Expired", "Suspended", "Deceased"] as const;
export const MEMBER_CATEGORIES = ["MICRM", "SICRM", "SILRM", "FICRM", "ACILRM", "Corporate", "Honorary"] as const;

export function statusTone(status: string): string {
  switch (status.toLowerCase()) {
    case "active":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200";
    case "pending":
      return "bg-amber-50 text-amber-700 ring-amber-200";
    case "expired":
      return "bg-rose-50 text-rose-700 ring-rose-200";
    case "suspended":
      return "bg-slate-100 text-slate-600 ring-slate-200";
    default:
      return "bg-orange-50 text-orange-700 ring-orange-200";
  }
}
