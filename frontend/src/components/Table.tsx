import React from "react";

export type Col<T> = {
  key: keyof T;
  label: string;
  mono?: boolean;
  render?: (row: T) => React.ReactNode;
};

export function Table<T extends Record<string, any>>(props: {
  rows: T[];
  cols: Col<T>[];
  onRowClick?: (row: T) => void;
}) {
  const [sortKey, setSortKey] = React.useState<keyof T | null>(null);
  const [sortDir, setSortDir] = React.useState<1 | -1>(1);

  function toggleSort(k: keyof T) {
    if (sortKey === k) setSortDir((d) => (d === 1 ? -1 : 1));
    else {
      setSortKey(k);
      setSortDir(1);
    }
  }

  const sorted = React.useMemo(() => {
    const rows = [...props.rows];
    if (!sortKey) return rows;

    rows.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];

      if (av == null && bv == null) return 0;
      if (av == null) return -1 * sortDir;
      if (bv == null) return 1 * sortDir;

      if (typeof av === "number" && typeof bv === "number") return (av - bv) * sortDir;

      return String(av).localeCompare(String(bv)) * sortDir;
    });

    return rows;
  }, [props.rows, sortKey, sortDir]);

  const clickable = !!props.onRowClick;

  return (
    <div className="tableWrap">
      <table className={`table ${clickable ? "tableClickable" : ""}`}>
        <thead>
          <tr>
            {props.cols.map((c) => (
              <th key={`${String(c.key)}-${c.label}`} onClick={() => toggleSort(c.key)}>
                {c.label}
                {sortKey === c.key ? (sortDir === 1 ? " ↑" : " ↓") : ""}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {sorted.map((r, i) => (
            <tr key={i} onClick={() => props.onRowClick?.(r)}>
              {props.cols.map((c) => (
                <td key={`${String(c.key)}-${c.label}`} className={c.mono ? "mono" : ""}>
                  {c.render ? c.render(r) : String(r[c.key] ?? "")}
                </td>
              ))}
            </tr>
          ))}

          {sorted.length === 0 ? (
            <tr>
              <td colSpan={props.cols.length}>
                <span className="small">Sin registros.</span>
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
