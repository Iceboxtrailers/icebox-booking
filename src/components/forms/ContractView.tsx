import type { ContractLine, Run } from "@/lib/providers/signature/contract-text";

function Runs({ runs }: { runs: Run[] }) {
  return (
    <>
      {runs.map((run, i) =>
        typeof run === "string" ? (
          <span key={i}>{run}</span>
        ) : (
          <strong key={i} className="font-semibold text-foreground">
            {run.bold}
          </strong>
        ),
      )}
    </>
  );
}

// A line of blanks ("Nom : ______") is longer than a phone's width: it may break anywhere.
const lineClass = "[overflow-wrap:anywhere]";

// Shaded rows of a label and its value, the way the PDF draws them.
function Rows({ rows }: { rows: { label: string; value: React.ReactNode }[] }) {
  return (
    <dl className="divide-y divide-white rounded-md bg-tint">
      {rows.map((row) => (
        <div key={row.label} className="grid grid-cols-[6.5rem_1fr] gap-x-3 px-3 py-1.5 sm:grid-cols-[9rem_1fr]">
          <dt className="text-muted">{row.label}</dt>
          <dd className="m-0 min-w-0">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

// The contract as the client reads it before signing: the same blocks the PDF is drawn from (contract-text.ts).
export function ContractView({ lines }: { lines: ContractLine[] }) {
  return (
    <div className="space-y-2 text-[12px] leading-relaxed text-body">
      {lines.map((line, i) => {
        if (line.type === "page") {
          return (
            <div key={i} className="border-t border-border-light pt-4 first:border-0 first:pt-0">
              <div className="text-[10px] uppercase tracking-wide text-muted">{line.eyebrow}</div>
              <div className="font-heading text-[16px] leading-tight text-navy">{line.title}</div>
            </div>
          );
        }
        if (line.type === "heading") {
          return (
            <div key={i} className="pt-1 text-[12.5px] font-semibold text-navy">
              {line.text}
            </div>
          );
        }
        if (line.type === "paragraph") {
          return (
            <div key={i}>
              {line.lines.map((runs, j) => (
                <p key={j} className={lineClass}>
                  <Runs runs={runs} />
                </p>
              ))}
            </div>
          );
        }
        if (line.type === "note") {
          return (
            <p key={i} className="text-[11px] text-muted">
              {line.text}
            </p>
          );
        }
        if (line.type === "table") {
          return (
            <Rows
              key={i}
              rows={line.rows.map((row) => ({
                label: row.label,
                value: row.lines.map((runs, j) => (
                  <p key={j} className={lineClass}>
                    <Runs runs={runs} />
                  </p>
                )),
              }))}
            />
          );
        }
        if (line.type === "amounts") {
          return (
            <dl key={i} className="divide-y divide-white rounded-md bg-tint">
              {line.rows.map((row) => (
                <div key={row.label} className={`flex justify-between gap-3 px-3 py-1.5 ${row.strong ? "font-semibold text-foreground" : ""}`}>
                  <dt>{row.label}</dt>
                  <dd className="m-0 whitespace-nowrap tabular-nums">{row.amount}</dd>
                </div>
              ))}
            </dl>
          );
        }
        if (line.type === "signatures") {
          return (
            <div key={i} className="space-y-2">
              <div className="pt-1 text-[12.5px] font-semibold text-navy">{line.heading}</div>
              <p>
                <Runs runs={line.intro} />
              </p>
              <div className="grid gap-px rounded-md bg-white sm:grid-cols-2">
                {line.parties.map((party) => (
                  <div key={party.title} className="bg-tint px-3 py-1.5">
                    <div className="text-muted">{party.title}</div>
                    {party.fields.map((field) => (
                      <p key={field.label} className={lineClass}>
                        {field.label} : {"_".repeat(field.blank)}
                      </p>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}
