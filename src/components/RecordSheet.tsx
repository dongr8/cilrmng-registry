import { FILE_FIELD_KEYS, FIELD_BY_KEY, MEMBER_FIELDS, NIL, display } from "@/lib/member-schema";
import { CERTIFICATION_TEXT } from "@/lib/record-document";

export type SheetOrg = {
  orgName: string;
  shortName: string;
  tagline: string;
  logoUrl: string;
  supportEmail: string;
};

type RecordSheetProps = {
  org: SheetOrg;
  record: Record<string, string>;
  memberId: string;
  verifiedAt?: string;
  source?: string;
};

/** Ordered once: the filed columns first, then any remaining field that holds a value. */
function sheetFields(record: Record<string, string>) {
  const filed = FILE_FIELD_KEYS.map((key) => FIELD_BY_KEY[key]);
  const extra = MEMBER_FIELDS.filter(
    (field) => !FILE_FIELD_KEYS.includes(field.key) && (record[field.key] ?? "").trim().length > 0,
  );
  return [...filed, ...extra];
}

/**
 * Single-page A4 certificate used for guest views, guest links and admin
 * printouts. Fields are laid out two-per-row so the whole record fits one page.
 */
export default function RecordSheet({ org, record, memberId, verifiedAt, source }: RecordSheetProps) {
  const issued = verifiedAt ? new Date(verifiedAt) : new Date();
  const fields = sheetFields(record);
  const fullName = [record.firstName, record.secondName, record.thirdName].filter(Boolean).join(" ") || NIL;
  const token = `${memberId.replace(/[^A-Za-z0-9]/g, "").slice(-8).toUpperCase()}-${issued.getFullYear()}`;

  return (
    <div className="print-sheet a4-sheet relative mx-auto bg-white text-stone-900 shadow-[0_10px_40px_-20px_rgba(23,21,20,0.35)] print:shadow-none">
      {/* Tiled crest watermark across the whole sheet */}
      <div aria-hidden className="watermark-layer pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={org.logoUrl} alt="" className="w-[62%] max-w-[120mm] opacity-[0.10] grayscale" />
        </div>
        <div className="absolute inset-0 grid grid-cols-3 content-between gap-6 p-6">
          {Array.from({ length: 9 }).map((_, index) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={index} src={org.logoUrl} alt="" className="mx-auto w-[26mm] opacity-[0.05] grayscale" />
          ))}
        </div>
      </div>

      <div className="relative z-10 flex h-full flex-col">
        <header className="border-b-2 border-brand-600 pb-2">
          <div className="flex items-center gap-3">
            <div className="flex h-[14mm] w-[14mm] shrink-0 items-center justify-center overflow-hidden rounded-full border border-brand-200 bg-white p-[2px] sm:h-[19mm] sm:w-[19mm]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={org.logoUrl} alt={`${org.orgName} logo`} className="h-full w-full object-contain" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[9pt] font-bold uppercase leading-tight tracking-wide text-stone-900 sm:text-[9.5pt]">{org.orgName}</p>
              <p className="text-[7.5pt] italic leading-snug text-brand-700">{org.tagline}</p>
              <p className="text-[7pt] text-stone-500">{org.supportEmail} · www.cilrmng.org</p>
            </div>
            {/* desktop/print: label on the right */}
            <div className="ml-auto hidden shrink-0 text-right sm:block print:block">
              <p className="text-[8pt] font-bold uppercase tracking-[0.16em] text-brand-600">Certified Membership Record</p>
              <p className="font-mono text-[7pt] text-stone-500">Ref {token}</p>
            </div>
          </div>
          {/* mobile: label on its own full-width row — nothing can overlap */}
          <div className="mt-1.5 flex flex-wrap items-baseline justify-between gap-x-3 sm:hidden print:hidden">
            <p className="text-[8pt] font-bold uppercase tracking-[0.12em] text-brand-600">Certified Membership Record</p>
            <p className="font-mono text-[7pt] text-stone-500">Ref {token}</p>
          </div>
        </header>

        <section className="mt-2 flex flex-wrap items-end justify-between gap-2 border-b border-stone-200 pb-2">
          <div className="min-w-0">
            <p className="text-[7pt] font-semibold uppercase tracking-[0.16em] text-stone-400">Name · First · Second · Third</p>
            <p className="text-[13pt] font-bold uppercase leading-tight text-stone-900">{fullName}</p>
          </div>
          <div className="text-right">
            <p className="text-[7pt] font-semibold uppercase tracking-[0.16em] text-stone-400">Registration Number</p>
            <p className="font-mono text-[11.5pt] font-bold text-brand-700">{display(memberId)}</p>
          </div>
        </section>

        {/* Two fields per row keeps the full record on a single page */}
        <table className="mt-2 w-full table-fixed border-collapse text-[8pt]">
          <tbody>
            {Array.from({ length: Math.ceil(fields.length / 2) }).map((_, rowIndex) => {
              const left = fields[rowIndex * 2];
              const right = fields[rowIndex * 2 + 1];
              return (
                <tr key={rowIndex} className={rowIndex % 2 === 0 ? "bg-stone-50/60" : "bg-white"}>
                  <th scope="row" className="w-[17%] border border-stone-200 px-1.5 py-[1.1mm] text-left align-top text-[6.5pt] font-semibold uppercase leading-tight tracking-wide text-stone-500">
                    {left.label}
                  </th>
                  <td className={`w-[33%] border border-stone-200 px-1.5 py-[1.1mm] align-top leading-snug ${(record[left.key] ?? "").trim() ? "font-medium text-stone-900" : "italic text-stone-400"}`}>
                    {display(record[left.key])}
                  </td>
                  {right ? (
                    <>
                      <th scope="row" className="w-[17%] border border-stone-200 px-1.5 py-[1.1mm] text-left align-top text-[6.5pt] font-semibold uppercase leading-tight tracking-wide text-stone-500">
                        {right.label}
                      </th>
                      <td className={`w-[33%] border border-stone-200 px-1.5 py-[1.1mm] align-top leading-snug ${(record[right.key] ?? "").trim() ? "font-medium text-stone-900" : "italic text-stone-400"}`}>
                        {display(record[right.key])}
                      </td>
                    </>
                  ) : (
                    <td className="border border-stone-200 bg-stone-50/40" colSpan={2} />
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>

        <section className="certified-note mt-3 rounded border-2 border-red-600 px-3 py-[2.5mm] text-center">
          <p className="text-[9pt] font-bold leading-snug text-red-600">{CERTIFICATION_TEXT}</p>
        </section>

        <footer className="mt-auto flex items-end justify-between gap-4 border-t border-stone-200 pt-2 text-[6.5pt] text-stone-500">
          <div>
            <p>Issued {issued.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</p>
            <p>{source ?? "CILRMNG membership register"}</p>
          </div>
          <div className="text-right">
            <p className="mb-3 border-b border-stone-400 px-6" />
            <p className="text-[7.5pt] font-semibold uppercase tracking-[0.14em] text-stone-700">{org.shortName}</p>
            <p>Registrar · Membership Registry</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
