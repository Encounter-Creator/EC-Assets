"use client";

import { Download, FileSpreadsheet, PlusCircle, Upload } from "lucide-react";
import { useMemo, useState } from "react";

import type { SettingsWorkspaceData } from "@/lib/settings";
import { cn } from "@/lib/utils";

type AssetIntakePanelProps = {
  isAdmin: boolean;
  userId: string | null;
  workspace: SettingsWorkspaceData;
  onRefresh: () => Promise<void>;
  onFeedback: (feedback: { tone: "success" | "error" | "info"; message: string } | null) => void;
};

type CsvFieldKey = "name" | "serial_number" | "location" | "department" | "code";
type CsvMapping = Record<CsvFieldKey, string>;

type ParsedCsv = {
  headers: string[];
  rows: Record<string, string>[];
};

type ImportRowResult = {
  rowNumber: number;
  name: string;
  serialNumber: string;
  location: string;
  department: string;
  finalCode: string | null;
  result: "ready" | "created" | "skipped";
  reason?: string;
};

type ImportSummary = {
  total: number;
  ready: number;
  created: number;
  skipped: number;
};

const CSV_HEADER_ALIASES: Record<CsvFieldKey, string[]> = {
  name: ["name", "asset name", "item name"],
  serial_number: ["serial_number", "serial number", "serial", "sn"],
  location: ["location", "current location", "site"],
  department: ["department", "dept"],
  code: ["code", "asset code", "tag"],
};

function getMappingStorageKey(userId: string) {
  return `asset-intake-mapping:${userId}`;
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function parseCsvText(text: string): ParsedCsv {
  const rows: string[][] = [];
  let currentCell = "";
  let currentRow: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const nextCharacter = text[index + 1];

    if (character === "\"") {
      if (inQuotes && nextCharacter === "\"") {
        currentCell += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === "," && !inQuotes) {
      currentRow.push(currentCell);
      currentCell = "";
      continue;
    }

    if ((character === "\n" || character === "\r") && !inQuotes) {
      if (character === "\r" && nextCharacter === "\n") {
        index += 1;
      }
      currentRow.push(currentCell);
      if (currentRow.some((cell) => cell.trim().length > 0)) {
        rows.push(currentRow.map((cell) => cell.trim()));
      }
      currentRow = [];
      currentCell = "";
      continue;
    }

    currentCell += character;
  }

  currentRow.push(currentCell);
  if (currentRow.some((cell) => cell.trim().length > 0)) {
    rows.push(currentRow.map((cell) => cell.trim()));
  }

  if (rows.length === 0) {
    return { headers: [], rows: [] };
  }

  const [headerRow, ...dataRows] = rows;
  const headers = headerRow.map((header) => header.trim());
  const objectRows = dataRows.map((row) =>
    Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])),
  );

  return { headers, rows: objectRows };
}

function suggestMapping(headers: string[]) {
  const mapping: CsvMapping = {
    name: "",
    serial_number: "",
    location: "",
    department: "",
    code: "",
  };

  for (const [field, aliases] of Object.entries(CSV_HEADER_ALIASES) as Array<[CsvFieldKey, string[]]>) {
    const matchedHeader = headers.find((header) => aliases.includes(normalizeHeader(header)));
    if (matchedHeader) {
      mapping[field] = matchedHeader;
    }
  }

  return mapping;
}

export function AssetIntakePanel({ isAdmin, userId, workspace, onRefresh, onFeedback }: AssetIntakePanelProps) {
  const [name, setName] = useState("");
  const [serialNumber, setSerialNumber] = useState("NA");
  const [locationId, setLocationId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [code, setCode] = useState("");
  const [creating, setCreating] = useState(false);

  const [csvFileName, setCsvFileName] = useState("");
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([]);
  const [csvMapping, setCsvMapping] = useState<CsvMapping>({
    name: "",
    serial_number: "",
    location: "",
    department: "",
    code: "",
  });
  const [previewRows, setPreviewRows] = useState<ImportRowResult[]>([]);
  const [previewSummary, setPreviewSummary] = useState<ImportSummary | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [importing, setImporting] = useState(false);

  const activeLocations = useMemo(() => workspace.locations.filter((entry) => entry.active), [workspace.locations]);
  const activeDepartments = useMemo(() => workspace.departments.filter((entry) => entry.active), [workspace.departments]);

  const mappedRequiredFieldsReady = csvMapping.name && csvMapping.serial_number && csvMapping.location && csvMapping.department;

  if (!isAdmin) {
    return (
      <div className="rounded-[1rem] border border-dashed border-primary/14 px-4 py-10 text-center text-sm text-muted-foreground">
        Asset Intake is available to admins only.
      </div>
    );
  }

  const handleCreateAsset = async () => {
    const locationName = activeLocations.find((entry) => entry.id === locationId)?.name ?? "";
    const departmentName = activeDepartments.find((entry) => entry.id === departmentId)?.name ?? "";

    if (!name.trim() || !locationName || !departmentName) {
      onFeedback({ tone: "error", message: "Enter name, location, and department before creating an asset." });
      return;
    }

    setCreating(true);
    onFeedback(null);
    try {
      const response = await fetch("/api/admin/assets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          serialNumber,
          locationName,
          departmentName,
          code,
        }),
      });

      const payload = (await response.json()) as { error?: string; message?: string; asset?: { code: string } };
      if (!response.ok) {
        throw new Error(payload.error ?? "Asset creation failed.");
      }

      setName("");
      setSerialNumber("NA");
      setLocationId("");
      setDepartmentId("");
      setCode("");
      onFeedback({ tone: "success", message: `${payload.message ?? "Asset created."} Code: ${payload.asset?.code ?? "Generated"}` });
      await onRefresh();
    } catch (error) {
      onFeedback({ tone: "error", message: error instanceof Error ? error.message : "Asset creation failed." });
    } finally {
      setCreating(false);
    }
  };

  const handleCsvFileChange = async (file: File | null) => {
    if (!file) return;

    try {
      const parsed = parseCsvText(await file.text());
      const suggested = suggestMapping(parsed.headers);
      let nextMapping = suggested;

      if (userId) {
        const storedMappingRaw = window.localStorage.getItem(getMappingStorageKey(userId));
        if (storedMappingRaw) {
          try {
            const storedMapping = JSON.parse(storedMappingRaw) as Partial<CsvMapping>;
            nextMapping = { ...suggested };
            for (const field of Object.keys(nextMapping) as CsvFieldKey[]) {
              const storedHeader = storedMapping[field];
              if (storedHeader && parsed.headers.includes(storedHeader)) {
                nextMapping[field] = storedHeader;
              }
            }
          } catch {
            nextMapping = suggested;
          }
        }
      }

      setCsvFileName(file.name);
      setCsvHeaders(parsed.headers);
      setCsvRows(parsed.rows);
      setCsvMapping(nextMapping);
      setPreviewRows([]);
      setPreviewSummary(null);
      onFeedback({ tone: "info", message: `${file.name} loaded with ${parsed.rows.length} row${parsed.rows.length === 1 ? "" : "s"}. Review the field mapping next.` });
    } catch (error) {
      onFeedback({ tone: "error", message: error instanceof Error ? error.message : "CSV could not be parsed." });
    }
  };

  const requestPreview = async () => {
    if (!mappedRequiredFieldsReady) {
      onFeedback({ tone: "error", message: "Map the required CSV fields before previewing." });
      return;
    }

    setPreviewing(true);
    onFeedback(null);
    try {
      const response = await fetch("/api/admin/assets/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rows: csvRows,
          mapping: csvMapping,
          dryRun: true,
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        message?: string;
        rows?: ImportRowResult[];
        summary?: ImportSummary;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Preview could not be generated.");
      }

      setPreviewRows(payload.rows ?? []);
      setPreviewSummary(payload.summary ?? null);
      onFeedback({ tone: "success", message: payload.message ?? "Preview generated." });
    } catch (error) {
      onFeedback({ tone: "error", message: error instanceof Error ? error.message : "Preview could not be generated." });
    } finally {
      setPreviewing(false);
    }
  };

  const importCsvRows = async () => {
    if (!userId) return;

    setImporting(true);
    onFeedback(null);
    try {
      const response = await fetch("/api/admin/assets/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rows: csvRows,
          mapping: csvMapping,
          dryRun: false,
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        message?: string;
        rows?: ImportRowResult[];
        summary?: ImportSummary;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Asset import failed.");
      }

      window.localStorage.setItem(getMappingStorageKey(userId), JSON.stringify(csvMapping));
      setPreviewRows(payload.rows ?? []);
      setPreviewSummary(payload.summary ?? null);
      onFeedback({ tone: "success", message: payload.message ?? "Asset import completed." });
      await onRefresh();
    } catch (error) {
      onFeedback({ tone: "error", message: error instanceof Error ? error.message : "Asset import failed." });
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const template = [
      "name,serial_number,location,department,code",
      "Camera Body,NA,Centurion,Production,",
      "Wireless Mic,WM-00482,Krugersdorp,Audio,",
    ].join("\n");

    const blob = new Blob([template], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "asset-intake-template.csv";
    link.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-[1.2rem] border border-primary/12 bg-card/35 p-4">
        <div className="app-kicker">Asset Intake</div>
        <div className="mt-2 text-sm text-muted-foreground">Create single assets or import a human-readable CSV with column mapping and preview.</div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-[1.2rem] border border-primary/12 bg-card/35 p-4">
          <div className="flex items-center gap-2 text-foreground">
            <PlusCircle size={18} className="text-primary" />
            <div className="font-display text-xl glow-soft">Create Asset</div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Name" value={name} onChange={setName} placeholder="Camera Body" />
            <Field label="Serial number" value={serialNumber} onChange={setSerialNumber} placeholder="NA" />
            <SelectField
              label="Location"
              value={locationId}
              onChange={setLocationId}
              options={[
                { label: "Choose location", value: "" },
                ...activeLocations.map((entry) => ({ label: entry.name, value: entry.id })),
              ]}
            />
            <SelectField
              label="Department"
              value={departmentId}
              onChange={setDepartmentId}
              options={[
                { label: "Choose department", value: "" },
                ...activeDepartments.map((entry) => ({ label: entry.name, value: entry.id })),
              ]}
            />
            <Field label="Code" value={code} onChange={setCode} placeholder="Leave blank to auto-generate" />
          </div>
          <button
            type="button"
            onClick={() => void handleCreateAsset()}
            disabled={creating}
            className="matrix-button mt-4 inline-flex h-11 items-center justify-center rounded-[1rem] px-4 text-sm font-semibold uppercase tracking-[0.14em] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {creating ? "Creating Asset" : "Create Asset"}
          </button>
        </div>

        <div className="rounded-[1.2rem] border border-primary/12 bg-card/35 p-4">
          <div className="flex items-center gap-2 text-foreground">
            <FileSpreadsheet size={18} className="text-primary" />
            <div className="font-display text-xl glow-soft">Import CSV</div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={downloadTemplate}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-[1rem] border border-primary/18 bg-card/55 px-4 text-sm font-medium text-foreground transition-colors hover:bg-primary/8 hover:text-primary"
            >
              <Download size={15} />
              Download CSV Template
            </button>
            <label className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-[1rem] border border-primary/18 bg-card/55 px-4 text-sm font-medium text-foreground transition-colors hover:bg-primary/8 hover:text-primary">
              <Upload size={15} />
              Upload CSV
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(event) => void handleCsvFileChange(event.target.files?.[0] ?? null)}
              />
            </label>
          </div>
          <div className="mt-3 text-sm text-muted-foreground">
            {csvFileName ? `${csvFileName} | ${csvRows.length} row${csvRows.length === 1 ? "" : "s"} loaded` : "No CSV loaded yet."}
          </div>
        </div>
      </div>

      {csvHeaders.length > 0 && (
        <div className="rounded-[1.2rem] border border-primary/12 bg-card/35 p-4">
          <div className="app-kicker">CSV field mapping</div>
          <div className="mt-2 text-sm text-muted-foreground">Review the detected CSV headers and map each required field before previewing the import.</div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {(["name", "serial_number", "location", "department", "code"] as CsvFieldKey[]).map((field) => (
              <SelectField
                key={field}
                label={field === "serial_number" ? "Serial number" : field.charAt(0).toUpperCase() + field.slice(1).replace("_", " ")}
                value={csvMapping[field]}
                onChange={(value) => setCsvMapping((current) => ({ ...current, [field]: value }))}
                options={[
                  { label: field === "code" ? "Unmapped / auto-generate" : "Choose column", value: "" },
                  ...csvHeaders.map((header) => ({ label: header, value: header })),
                ]}
              />
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void requestPreview()}
              disabled={previewing || !mappedRequiredFieldsReady}
              className="matrix-button inline-flex h-11 items-center justify-center rounded-[1rem] px-4 text-sm font-semibold uppercase tracking-[0.14em] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {previewing ? "Generating Preview" : "Preview Import"}
            </button>
            <button
              type="button"
              onClick={() => void importCsvRows()}
              disabled={importing || !previewSummary || previewSummary.ready === 0}
              className="inline-flex h-11 items-center justify-center rounded-[1rem] border border-primary/18 bg-card/55 px-4 text-sm font-medium text-foreground transition-colors hover:bg-primary/8 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {importing ? "Importing Assets" : "Confirm Import"}
            </button>
          </div>
        </div>
      )}

      {previewSummary ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Rows" value={String(previewSummary.total)} />
          <SummaryCard label="Ready" value={String(previewSummary.ready)} />
          <SummaryCard label="Created" value={String(previewSummary.created)} />
          <SummaryCard label="Skipped" value={String(previewSummary.skipped)} />
        </div>
      ) : null}

      {previewRows.length > 0 ? (
        <div className="rounded-[1.2rem] border border-primary/12 bg-card/35 p-4">
          <div className="app-kicker">Import preview</div>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-primary/12">
                  {["Row", "Name", "Code", "Location", "Department", "Result", "Reason"].map((column) => (
                    <th key={column} className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row) => (
                  <tr key={`${row.rowNumber}-${row.finalCode ?? row.name}`} className="border-b border-primary/8 align-top">
                    <td className="px-3 py-3 text-foreground">{row.rowNumber}</td>
                    <td className="px-3 py-3 text-foreground">{row.name || "-"}</td>
                    <td className="px-3 py-3 text-foreground">{row.finalCode ?? "-"}</td>
                    <td className="px-3 py-3 text-foreground">{row.location || "-"}</td>
                    <td className="px-3 py-3 text-foreground">{row.department || "-"}</td>
                    <td className="px-3 py-3">
                      <span
                        className={cn(
                          "inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]",
                          row.result === "created" && "border-primary/24 bg-primary/10 text-primary",
                          row.result === "ready" && "border-sky-500/24 bg-sky-500/10 text-sky-300",
                          row.result === "skipped" && "border-rose-500/24 bg-rose-500/10 text-rose-300",
                        )}
                      >
                        {row.result}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">{row.reason ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-11 rounded-[1.25rem] border border-primary/14 bg-card/55 px-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary/30"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-[1.25rem] border border-primary/14 bg-card/55 px-4 text-sm text-foreground outline-none transition-colors focus:border-primary/30"
      >
        {options.map((option) => (
          <option key={`${label}-${option.value || option.label}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1rem] border border-primary/12 bg-card/45 px-4 py-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="mt-2 font-display text-3xl text-foreground glow-soft">{value}</div>
    </div>
  );
}
