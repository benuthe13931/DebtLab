import { useEffect, useMemo, useState } from "react";
import { DateField } from "./components/DateField";
import { cloudStorageEnabled, loadCloudPaycheckPlan, saveCloudPaycheckPlan } from "./lib/cloudStorage";
import {
  estimateAnnualFederalTax,
  estimatePaycheck,
  estimateStateWithholding,
  type FilingStatus,
  type PayFrequency,
  type PaycheckInputs,
  type PaycheckResult,
} from "./lib/paycheck";

export type PaycheckScenario = {
  endDate: string;
  federalWithholdingPerPaycheck: number;
  hourlyRate: number;
  hoursPerWeek: number;
  id: string;
  imputedDentalPerPaycheck: number;
  imputedMedicalPerPaycheck: number;
  imputedOtherPerPaycheck: number;
  imputedVisionPerPaycheck: number;
  incomeType: "salary" | "hourly" | "contract" | "bonus" | "severance" | "one-time-w2" | "one-time-contract";
  inputs: PaycheckInputs;
  label: string;
  startDate: string;
  state: string;
};

type LegacyScenario = Omit<Partial<PaycheckScenario>, "incomeType"> & { effectiveDate?: string; incomeType?: PaycheckScenario["incomeType"] | "variable-w2" };

type TaxSettings = {
  additionalIncome: number;
  credits: number;
  deductionMethod: "standard" | "itemized";
  estimatedPayments: number;
  itemizedDeductions: number;
};

const defaultTaxSettings: TaxSettings = { additionalIncome: 0, credits: 0, deductionMethod: "standard", estimatedPayments: 0, itemizedDeductions: 0 };

const STATES = [
  ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"],
  ["CA", "California"], ["CO", "Colorado"], ["CT", "Connecticut"], ["DE", "Delaware"],
  ["DC", "District of Columbia"], ["FL", "Florida"], ["GA", "Georgia"], ["HI", "Hawaii"],
  ["ID", "Idaho"], ["IL", "Illinois"], ["IN", "Indiana"], ["IA", "Iowa"],
  ["KS", "Kansas"], ["KY", "Kentucky"], ["LA", "Louisiana"], ["ME", "Maine"],
  ["MD", "Maryland"], ["MA", "Massachusetts"], ["MI", "Michigan"], ["MN", "Minnesota"],
  ["MS", "Mississippi"], ["MO", "Missouri"], ["MT", "Montana"], ["NE", "Nebraska"],
  ["NV", "Nevada"], ["NH", "New Hampshire"], ["NJ", "New Jersey"], ["NM", "New Mexico"],
  ["NY", "New York"], ["NC", "North Carolina"], ["ND", "North Dakota"], ["OH", "Ohio"],
  ["OK", "Oklahoma"], ["OR", "Oregon"], ["PA", "Pennsylvania"], ["RI", "Rhode Island"],
  ["SC", "South Carolina"], ["SD", "South Dakota"], ["TN", "Tennessee"], ["TX", "Texas"],
  ["UT", "Utah"], ["VT", "Vermont"], ["VA", "Virginia"], ["WA", "Washington"],
  ["WV", "West Virginia"], ["WI", "Wisconsin"], ["WY", "Wyoming"],
] as const;

const defaultInputs: PaycheckInputs = {
  annualSalary: 0,
  dentalPerPaycheck: 0,
  filingStatus: "single",
  hsaPerPaycheck: 0,
  imputedIncomePerPaycheck: 0,
  medicalPerPaycheck: 0,
  otherPreTaxPerPaycheck: 0,
  payFrequency: "biweekly",
  postTaxBenefitsPerPaycheck: 0,
  roth401kPercent: 0,
  stateWithholdingPerPaycheck: 0,
  traditional401kPercent: 0,
  visionPerPaycheck: 0,
  w4AdditionalWithholding: 0,
  w4Credits: 0,
  w4Deductions: 0,
  w4OtherIncome: 0,
  w4Step2Checked: false,
};

const makeScenario = (index = 0, source?: PaycheckScenario): PaycheckScenario => ({
  endDate: "",
  federalWithholdingPerPaycheck: 0,
  hourlyRate: 0,
  hoursPerWeek: 40,
  id: crypto.randomUUID(),
  imputedDentalPerPaycheck: 0,
  imputedMedicalPerPaycheck: 0,
  imputedOtherPerPaycheck: 0,
  imputedVisionPerPaycheck: 0,
  incomeType: "salary",
  inputs: { ...(source?.inputs ?? defaultInputs) },
  label: `Salary ${index + 1}`,
  startDate: "",
  state: source?.state ?? "PA",
});

const normalizeScenarios = (value: unknown): PaycheckScenario[] => {
  if (!Array.isArray(value) || value.length === 0) return [makeScenario()];
  return value.map((item, index) => {
    const saved = (item ?? {}) as LegacyScenario;
    const legacyLabel = saved.label === "Current paycheck" || saved.label === "Future paycheck";
    return {
      endDate: saved.endDate ?? "",
      federalWithholdingPerPaycheck: saved.federalWithholdingPerPaycheck ?? 0,
      hourlyRate: saved.hourlyRate ?? 0,
      hoursPerWeek: saved.hoursPerWeek ?? 40,
      id: saved.id ?? crypto.randomUUID(),
      imputedDentalPerPaycheck: saved.imputedDentalPerPaycheck ?? 0,
      imputedMedicalPerPaycheck: saved.imputedMedicalPerPaycheck ?? 0,
      imputedOtherPerPaycheck: saved.imputedOtherPerPaycheck ?? 0,
      imputedVisionPerPaycheck: saved.imputedVisionPerPaycheck ?? 0,
      incomeType: saved.incomeType === "variable-w2" ? "salary" : saved.incomeType ?? "salary",
      inputs: { ...defaultInputs, ...(saved.inputs ?? {}) },
      label: legacyLabel || !saved.label ? `Salary ${index + 1}` : saved.label,
      startDate: saved.startDate ?? saved.effectiveDate ?? "",
      state: saved.state ?? "PA",
    };
  });
};

const money = (value: number) => new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
}).format(value);

const cardStyle = {
  background: "var(--app-surface, #fff)",
  border: "1px solid var(--app-border, #e2e8f0)",
  borderRadius: 18,
  padding: 20,
  boxShadow: "0 8px 24px rgba(15, 23, 42, 0.06)",
} as const;

const controlStyle = {
  boxSizing: "border-box",
  border: "1px solid var(--app-border-strong, #cbd5e1)",
  borderRadius: 10,
  padding: "10px 12px",
  background: "var(--app-input-bg, #fff)",
  color: "var(--app-text, #0f172a)",
  minWidth: 0,
  width: "100%",
} as const;

function TextField({ label, onChange, type = "text", value }: { label: string; onChange: (value: string) => void; type?: string; value: string }) {
  return (
    <label style={{ display: "grid", gap: 6, minWidth: 0 }}>
      <span style={{ fontSize: 13, fontWeight: 650 }}>{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} style={controlStyle} />
    </label>
  );
}

function NumericField({ label, onChange, prefix, suffix, value }: { label: string; onChange: (value: number) => void; prefix?: string; suffix?: string; value: number }) {
  const formatValue = (next: number) => prefix ? next.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : `${next}`;
  const [draft, setDraft] = useState(() => formatValue(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => { if (!focused) setDraft(prefix ? value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : `${value}`); }, [focused, prefix, value]);
  const commit = () => {
    const parsed = Number(draft.replace(/,/g, ""));
    const next = Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
    setFocused(false);
    setDraft(formatValue(next));
    onChange(next);
  };
  return (
    <label style={{ display: "grid", gap: 6, minWidth: 0 }}>
      <span style={{ fontSize: 13, fontWeight: 650 }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", border: "1px solid var(--app-border-strong, #cbd5e1)", borderRadius: 10, background: "var(--app-input-bg, #fff)", overflow: "hidden" }}>
        {prefix ? <span style={{ paddingLeft: 11, color: "var(--app-text-muted, #64748b)" }}>{prefix}</span> : null}
        <input inputMode="decimal" type="text" value={draft} onFocus={() => setFocused(true)} onChange={(event) => setDraft(event.target.value.replace(/[^0-9.,]/g, ""))} onBlur={commit} onKeyDown={(event) => { if (event.key === "Enter") commit(); }} style={{ width: "100%", minWidth: 0, border: 0, outline: 0, padding: 10, background: "transparent", color: "var(--app-text, #0f172a)" }} />
        {suffix ? <span style={{ paddingRight: 11, color: "var(--app-text-muted, #64748b)" }}>{suffix}</span> : null}
      </div>
    </label>
  );
}

function ResultLine({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: strong ? "12px 0 0" : "7px 0", borderTop: strong ? "1px solid var(--app-border, #e2e8f0)" : undefined }}>
      <span style={{ color: strong ? "var(--app-text, #0f172a)" : "var(--app-text-muted, #64748b)", fontWeight: strong ? 700 : 500 }}>{label}</span>
      <span style={{ fontWeight: strong ? 800 : 650 }}>{value}</span>
    </div>
  );
}

function ScenarioResult({ result }: { result: PaycheckResult }) {
  return (
    <div style={{ display: "grid", gap: 2 }}>
      <ResultLine label="Gross pay" value={money(result.grossPay)} />
      <ResultLine label="Pre-tax benefits" value={`−${money(result.benefitDeductions)}`} />
      <ResultLine label="Traditional 401(k)" value={`−${money(result.traditional401k)}`} />
      <ResultLine label="Roth 401(k)" value={`−${money(result.roth401k)}`} />
      <ResultLine label="Federal income tax" value={`−${money(result.federalIncomeTax)}`} />
      <ResultLine label="Social Security" value={`−${money(result.socialSecurityTax)}`} />
      <ResultLine label="Medicare" value={`−${money(result.medicareTax)}`} />
      <ResultLine label="State and local tax" value={`−${money(result.stateWithholding)}`} />
      <ResultLine label="Post-tax benefits" value={`−${money(result.postTaxBenefits)}`} />
      <ResultLine label="Estimated net paycheck" value={money(result.netPay)} strong />
      <ResultLine label="Estimated annual take-home" value={money(result.annualNet)} />
    </div>
  );
}

export function PaycheckPage({ onClose, userId }: { onClose: () => void; userId: string }) {
  const storageKey = `loan-sim:paycheck-scenarios:${userId}`;
  const readLocalPlan = () => {
    try { return JSON.parse(localStorage.getItem(storageKey) ?? "null") as unknown; } catch { return null; }
  };
  const [scenarios, setScenarios] = useState<PaycheckScenario[]>(() => {
    const saved = readLocalPlan();
    return normalizeScenarios(saved && !Array.isArray(saved) && typeof saved === "object" && "scenarios" in saved ? (saved as { scenarios: unknown }).scenarios : saved);
  });
  const [taxSettings, setTaxSettings] = useState<TaxSettings>(() => {
    const saved = readLocalPlan();
    return saved && !Array.isArray(saved) && typeof saved === "object" && "taxSettings" in saved ? { ...defaultTaxSettings, ...(saved as { taxSettings: Partial<TaxSettings> }).taxSettings } : defaultTaxSettings;
  });
  const [activeId, setActiveId] = useState(() => scenarios[0].id);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [pageTab, setPageTab] = useState<"paychecks" | "tax">("paychecks");
  const [cloudLoaded, setCloudLoaded] = useState(!cloudStorageEnabled);
  const [saveStatus, setSaveStatus] = useState("");
  const activeScenario = scenarios.find((scenario) => scenario.id === activeId) ?? scenarios[0];
  const isOneOff = (scenario: PaycheckScenario) => ["bonus", "severance", "one-time-w2", "one-time-contract"].includes(scenario.incomeType);
  const resolvedInputs = (scenario: PaycheckScenario): PaycheckInputs => {
    const annualSalary = scenario.incomeType === "hourly" ? scenario.hourlyRate * scenario.hoursPerWeek * 52 : scenario.inputs.annualSalary;
    const withoutState = { ...scenario.inputs, annualSalary, stateWithholdingPerPaycheck: 0 };
    const preliminary = estimatePaycheck(withoutState);
    return { ...withoutState, stateWithholdingPerPaycheck: estimateStateWithholding(scenario.state, preliminary.grossPay + withoutState.imputedIncomePerPaycheck) ?? 0 };
  };
  const activeResult = useMemo(() => estimatePaycheck(resolvedInputs(activeScenario)), [activeScenario]);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify({ scenarios, taxSettings }));
  }, [scenarios, storageKey, taxSettings]);

  useEffect(() => {
    if (!cloudStorageEnabled) return;
    let mounted = true;
    void loadCloudPaycheckPlan<unknown>(userId)
      .then((saved) => {
        if (!mounted) return;
        if (saved) {
          const storedScenarios = !Array.isArray(saved) && typeof saved === "object" && "scenarios" in saved ? (saved as { scenarios: unknown }).scenarios : saved;
          const normalized = normalizeScenarios(storedScenarios);
          setScenarios(normalized);
          setActiveId(normalized[0].id);
          if (!Array.isArray(saved) && typeof saved === "object" && "taxSettings" in saved) setTaxSettings({ ...defaultTaxSettings, ...(saved as { taxSettings: Partial<TaxSettings> }).taxSettings });
        }
      })
      .catch(() => undefined)
      .finally(() => { if (mounted) setCloudLoaded(true); });
    return () => { mounted = false; };
  }, [userId]);

  const saveEstimate = async () => {
    if (!cloudStorageEnabled || !cloudLoaded) { setSaveStatus("Saved in this browser."); return; }
    setSaveStatus("Saving...");
    try { await saveCloudPaycheckPlan(userId, { scenarios, taxSettings }); setSaveStatus("Saved."); }
    catch { setSaveStatus("Could not save. Try again."); }
  };

  const updateScenario = (update: Partial<PaycheckScenario>) => {
    setScenarios((current) => current.map((scenario) => scenario.id === activeScenario.id ? { ...scenario, ...update } : scenario));
  };
  const updateInputs = <K extends keyof PaycheckInputs>(key: K, value: PaycheckInputs[K]) => {
    updateScenario({ inputs: { ...activeScenario.inputs, [key]: value } });
  };
  const updateImputedIncome = (key: "imputedMedicalPerPaycheck" | "imputedDentalPerPaycheck" | "imputedVisionPerPaycheck" | "imputedOtherPerPaycheck", value: number) => {
    const next = { ...activeScenario, [key]: value };
    updateScenario({ [key]: value, inputs: { ...activeScenario.inputs, imputedIncomePerPaycheck: next.imputedMedicalPerPaycheck + next.imputedDentalPerPaycheck + next.imputedVisionPerPaycheck + next.imputedOtherPerPaycheck } });
  };
  const addScenario = (incomeType: PaycheckScenario["incomeType"], label: string) => {
    const next = makeScenario(scenarios.length, activeScenario);
    next.incomeType = incomeType;
    next.label = label;
    next.startDate = ["bonus", "severance", "one-time-w2", "one-time-contract"].includes(incomeType) ? new Date().toISOString().slice(0, 10) : "";
    setScenarios((current) => [...current, next]);
    setActiveId(next.id);
    setAddMenuOpen(false);
  };
  const deleteScenario = () => {
    if (scenarios.length === 1) return;
    const remaining = scenarios.filter((scenario) => scenario.id !== activeScenario.id);
    setScenarios(remaining);
    setActiveId(remaining[0].id);
  };
  const moveScenario = (draggedId: string, targetId: string) => {
    if (draggedId === targetId) return;
    setScenarios((current) => {
      const from = current.findIndex((scenario) => scenario.id === draggedId);
      const to = current.findIndex((scenario) => scenario.id === targetId);
      if (from < 0 || to < 0) return current;
      const reordered = [...current];
      const [dragged] = reordered.splice(from, 1);
      reordered.splice(to, 0, dragged);
      return reordered;
    });
  };
  const periodLabel = (scenario: PaycheckScenario) => {
    if (isOneOff(scenario)) return scenario.startDate || "Payment date not set";
    const start = scenario.startDate || "Start of year";
    const end = scenario.endDate || "Ongoing";
    return `${start} – ${end}`;
  };
  const activeStateEstimate = estimateStateWithholding(activeScenario.state, isOneOff(activeScenario) ? activeScenario.inputs.annualSalary : activeResult.grossPay + activeScenario.inputs.imputedIncomePerPaycheck);

  const annualTotals = useMemo(() => {
    const yearStart = new Date(2026, 0, 1);
    const yearEnd = new Date(2026, 11, 31);
    let federalWithholding = 0;
    let selfEmploymentIncome = 0;
    let w2TaxableWages = 0;
    let w2SocialSecurityWages = 0;
    for (const scenario of scenarios) {
      const start = scenario.startDate ? new Date(`${scenario.startDate}T00:00:00`) : yearStart;
      const end = scenario.endDate ? new Date(`${scenario.endDate}T00:00:00`) : yearEnd;
      const boundedStart = start < yearStart ? yearStart : start;
      const boundedEnd = end > yearEnd ? yearEnd : end;
      const fraction = isOneOff(scenario) ? 1 : boundedEnd < boundedStart ? 0 : (Math.floor((boundedEnd.getTime() - boundedStart.getTime()) / 86_400_000) + 1) / 365;
      const inputs = resolvedInputs(scenario);
      const result = estimatePaycheck(inputs);
      if (scenario.incomeType === "contract" || scenario.incomeType === "one-time-contract") selfEmploymentIncome += inputs.annualSalary * fraction;
      else {
        const periodMultiplier = isOneOff(scenario) ? 1 : result.periodsPerYear * fraction;
        const taxableWages = isOneOff(scenario) ? inputs.annualSalary + inputs.imputedIncomePerPaycheck : result.taxableFederalWages * periodMultiplier;
        w2TaxableWages += taxableWages;
        w2SocialSecurityWages += isOneOff(scenario) ? taxableWages : Math.max(0, result.grossPay + inputs.imputedIncomePerPaycheck - result.benefitDeductions) * periodMultiplier;
        federalWithholding += scenario.federalWithholdingPerPaycheck
          ? scenario.federalWithholdingPerPaycheck * (isOneOff(scenario) ? 1 : periodMultiplier)
          : isOneOff(scenario) ? inputs.annualSalary * 0.22 : result.federalIncomeTax * periodMultiplier;
      }
    }
    const result = estimateAnnualFederalTax({ ...taxSettings, federalWithholding, filingStatus: scenarios[0]?.inputs.filingStatus ?? "single", selfEmploymentIncome, w2SocialSecurityWages, w2TaxableWages });
    return { ...result, federalWithholding, selfEmploymentIncome, w2TaxableWages };
  }, [scenarios, taxSettings]);

  return (
    <main style={{ display: "grid", gap: 24, minWidth: 0 }}>
      <section style={{ ...cardStyle, display: "grid", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "grid", gap: 5, maxWidth: 780 }}>
            <h2 style={{ margin: 0, fontSize: 28 }}>Paycheck estimate</h2>
            <p style={{ margin: 0, color: "var(--app-text-muted, #64748b)", lineHeight: 1.55 }}>
              Build recurring pay estimates and dated one-time income for bonuses, severance, and contract work. The Annual Tax Estimate combines everything saved here.
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, position: "relative" }}>
            <button type="button" onClick={() => setAddMenuOpen((open) => !open)} style={{ border: "1px solid var(--app-accent, #2563eb)", background: "var(--app-accent, #2563eb)", color: "#fff", borderRadius: 10, padding: "10px 14px", fontWeight: 700, cursor: "pointer" }}>+ Add income ▾</button>
            {addMenuOpen ? <div style={{ position: "absolute", zIndex: 30, right: 52, top: "calc(100% + 7px)", width: 245, display: "grid", gap: 3, padding: 7, border: "1px solid var(--app-border, #e2e8f0)", borderRadius: 12, background: "var(--app-surface, #fff)", boxShadow: "0 16px 36px rgba(15, 23, 42, 0.18)" }}>{[["salary", "Salary"], ["hourly", "Hourly job"], ["contract", "Ongoing contract work"], ["bonus", "One-time bonus"], ["severance", "Severance payment"], ["one-time-w2", "Other one-time W-2 income"], ["one-time-contract", "One-time contract income"]].map(([type, label]) => <button key={type} type="button" onClick={() => addScenario(type as PaycheckScenario["incomeType"], label)} style={{ border: 0, borderRadius: 8, padding: "9px 10px", background: "transparent", color: "var(--app-text, #0f172a)", textAlign: "left", cursor: "pointer" }}>{label}</button>)}</div> : null}
            <button type="button" aria-label="Close paycheck estimate" onClick={onClose} style={{ border: "1px solid var(--app-border, #e2e8f0)", background: "var(--app-surface, #fff)", color: "var(--app-text, #0f172a)", borderRadius: 10, width: 42, fontSize: 24, cursor: "pointer" }}>×</button>
          </div>
        </div>
        {saveStatus ? <div style={{ fontSize: 12, color: "var(--app-text-muted, #64748b)", textAlign: "right" }}>{saveStatus}</div> : null}
        <div style={{ display: "flex", borderBottom: "1px solid var(--app-border, #e2e8f0)" }}>
          {(["paychecks", "tax"] as const).map((tab) => <button key={tab} type="button" onClick={() => setPageTab(tab)} style={{ flex: "1 1 0", border: "1px solid var(--app-border, #e2e8f0)", borderBottomColor: pageTab === tab ? "var(--app-surface, #fff)" : "var(--app-border, #e2e8f0)", borderRadius: "12px 12px 0 0", marginBottom: -1, padding: "11px 14px", background: pageTab === tab ? "var(--app-surface, #fff)" : "var(--app-surface-muted, #f8fafc)", color: "var(--app-text, #0f172a)", fontWeight: 750, cursor: "pointer" }}>{tab === "paychecks" ? "Paycheck estimate" : "Annual tax estimate"}</button>)}
        </div>
        {pageTab === "paychecks" ? (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {scenarios.map((scenario) => (
            <button key={scenario.id} draggable type="button" onDragStart={(event) => event.dataTransfer.setData("text/plain", scenario.id)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => moveScenario(event.dataTransfer.getData("text/plain"), scenario.id)} onClick={() => setActiveId(scenario.id)} style={{ display: "grid", gridTemplateColumns: "auto 1fr", columnGap: 8, textAlign: "left", border: scenario.id === activeScenario.id ? "1px solid var(--app-accent, #2563eb)" : "1px solid var(--app-border, #e2e8f0)", background: scenario.id === activeScenario.id ? "var(--app-accent-soft, #dbeafe)" : "var(--app-surface, #fff)", color: "var(--app-text, #0f172a)", borderRadius: 12, padding: "9px 13px", cursor: "grab" }}>
              <span aria-hidden="true" style={{ gridRow: "1 / 3", color: "var(--app-text-muted, #64748b)" }}>⋮⋮</span><strong>{scenario.label}</strong><span style={{ fontSize: 12, color: "var(--app-text-muted, #64748b)" }}>{periodLabel(scenario)}</span>
            </button>
          ))}
        </div>
        ) : null}
      </section>

      {pageTab === "paychecks" ? (
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.35fr) minmax(300px, 0.65fr)", gap: 24, alignItems: "start" }}>
        <section style={{ ...cardStyle, display: "grid", gap: 22, minWidth: 0 }}>
          <div style={{ display: "grid", gap: 12 }}>
            <h3 style={{ margin: 0, fontSize: 18 }}>Pay estimate</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              <TextField label="Period name" value={activeScenario.label} onChange={(label) => updateScenario({ label })} />
              <label style={{ display: "grid", gap: 6, minWidth: 0 }}><span style={{ fontSize: 13, fontWeight: 650 }}>Income type</span><select value={activeScenario.incomeType} onChange={(event) => updateScenario({ incomeType: event.target.value as PaycheckScenario["incomeType"] })} style={controlStyle}><option value="salary">Salary</option><option value="hourly">Hourly wages</option><option value="contract">Ongoing contract work</option><option value="bonus">One-time bonus</option><option value="severance">Severance payment</option><option value="one-time-w2">Other one-time W-2 income</option><option value="one-time-contract">One-time contract income</option></select></label>
              {isOneOff(activeScenario) ? <DateField id="income-payment-date" label="Payment date" value={activeScenario.startDate} onChange={(startDate) => updateScenario({ startDate })} /> : <><DateField id="income-start-date" label="Start date" value={activeScenario.startDate} onChange={(startDate) => updateScenario({ startDate })} /><DateField id="income-end-date" label="End date (optional)" minDate={activeScenario.startDate} value={activeScenario.endDate} onChange={(endDate) => updateScenario({ endDate })} /></>}
              {activeScenario.incomeType === "hourly" ? <><NumericField label="Hourly rate" prefix="$" value={activeScenario.hourlyRate} onChange={(hourlyRate) => updateScenario({ hourlyRate })} /><NumericField label="Average hours per week" value={activeScenario.hoursPerWeek} onChange={(hoursPerWeek) => updateScenario({ hoursPerWeek })} /></> : <NumericField label={isOneOff(activeScenario) ? "Payment amount" : activeScenario.incomeType === "salary" ? "Annual salary" : "Annualized net contract income"} prefix="$" value={activeScenario.inputs.annualSalary} onChange={(value) => updateInputs("annualSalary", value)} />}
              {!isOneOff(activeScenario) ? <label style={{ display: "grid", gap: 6, minWidth: 0 }}><span style={{ fontSize: 13, fontWeight: 650 }}>Pay frequency</span>
                <select value={activeScenario.inputs.payFrequency} onChange={(event) => updateInputs("payFrequency", event.target.value as PayFrequency)} style={controlStyle}>
                  <option value="weekly">Weekly</option><option value="biweekly">Biweekly</option><option value="semimonthly">Semimonthly</option><option value="monthly">Monthly</option>
                </select>
              </label> : null}
            </div>
          </div>

          <div style={{ display: "grid", gap: 14 }}>
            <h3 style={{ margin: 0, fontSize: 18 }}>Taxes</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              <label style={{ display: "grid", gap: 6 }}><span style={{ fontSize: 13, fontWeight: 650 }}>Federal filing status</span><select value={activeScenario.inputs.filingStatus} onChange={(event) => updateInputs("filingStatus", event.target.value as FilingStatus)} style={controlStyle}><option value="single">Single or married filing separately</option><option value="married">Married filing jointly</option><option value="head">Head of household</option></select></label>
              <label style={{ display: "grid", gap: 6 }}><span style={{ fontSize: 13, fontWeight: 650 }}>Work state</span><select value={activeScenario.state} onChange={(event) => updateScenario({ state: event.target.value })} style={controlStyle}>{STATES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></label>
              <div style={{ display: "grid", gap: 6 }}><span style={{ fontSize: 13, fontWeight: 650 }}>Estimated state withholding</span><div style={{ ...controlStyle, color: "var(--app-text-muted, #64748b)" }}>{activeStateEstimate === null ? "Automatic estimate not yet available for this state" : money(activeStateEstimate)}</div></div>
            </div>
            <details style={{ border: "1px solid var(--app-border, #e2e8f0)", borderRadius: 12, padding: 12 }}><summary style={{ cursor: "pointer", fontWeight: 700 }}>Additional income and withholding adjustments</summary><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginTop: 12 }}><NumericField label={isOneOff(activeScenario) ? "Federal tax withheld from this payment" : "Federal tax withheld per paycheck (optional override)"} prefix="$" value={activeScenario.federalWithholdingPerPaycheck} onChange={(federalWithholdingPerPaycheck) => updateScenario({ federalWithholdingPerPaycheck })} /><NumericField label="Other annual income used for withholding" prefix="$" value={activeScenario.inputs.w4OtherIncome} onChange={(value) => updateInputs("w4OtherIncome", value)} /><NumericField label="Extra tax per paycheck" prefix="$" value={activeScenario.inputs.w4AdditionalWithholding} onChange={(value) => updateInputs("w4AdditionalWithholding", value)} /></div></details>
          </div>

          <details style={{ border: "1px solid var(--app-border, #e2e8f0)", borderRadius: 12, padding: 12 }}><summary style={{ cursor: "pointer", fontWeight: 750 }}>Add pre-tax benefits</summary>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(155px, 1fr))", gap: 12, marginTop: 12 }}>
              <NumericField label="Medical per paycheck" prefix="$" value={activeScenario.inputs.medicalPerPaycheck} onChange={(value) => updateInputs("medicalPerPaycheck", value)} />
              <NumericField label="Dental per paycheck" prefix="$" value={activeScenario.inputs.dentalPerPaycheck} onChange={(value) => updateInputs("dentalPerPaycheck", value)} />
              <NumericField label="Vision per paycheck" prefix="$" value={activeScenario.inputs.visionPerPaycheck} onChange={(value) => updateInputs("visionPerPaycheck", value)} />
              <NumericField label="HSA per paycheck" prefix="$" value={activeScenario.inputs.hsaPerPaycheck} onChange={(value) => updateInputs("hsaPerPaycheck", value)} />
              <NumericField label="Other pre-tax benefits" prefix="$" value={activeScenario.inputs.otherPreTaxPerPaycheck} onChange={(value) => updateInputs("otherPreTaxPerPaycheck", value)} />
            </div>
          </details>

          <details style={{ border: "1px solid var(--app-border, #e2e8f0)", borderRadius: 12, padding: 12 }}><summary style={{ cursor: "pointer", fontWeight: 750 }}>Add taxable employer-paid benefits</summary><div style={{ margin: "8px 0 12px", color: "var(--app-text-muted, #64748b)", fontSize: 12, lineHeight: 1.5 }}>Use these for benefit amounts reported as imputed income. They increase taxable wages without increasing cash pay.</div><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}><NumericField label="Medical imputed income" prefix="$" value={activeScenario.imputedMedicalPerPaycheck} onChange={(value) => updateImputedIncome("imputedMedicalPerPaycheck", value)} /><NumericField label="Dental imputed income" prefix="$" value={activeScenario.imputedDentalPerPaycheck} onChange={(value) => updateImputedIncome("imputedDentalPerPaycheck", value)} /><NumericField label="Vision imputed income" prefix="$" value={activeScenario.imputedVisionPerPaycheck} onChange={(value) => updateImputedIncome("imputedVisionPerPaycheck", value)} /><NumericField label="Other imputed income" prefix="$" value={activeScenario.imputedOtherPerPaycheck} onChange={(value) => updateImputedIncome("imputedOtherPerPaycheck", value)} /></div></details>

          <details style={{ border: "1px solid var(--app-border, #e2e8f0)", borderRadius: 12, padding: 12 }}><summary style={{ cursor: "pointer", fontWeight: 750 }}>Add post-tax benefits</summary><div style={{ marginTop: 12 }}><NumericField label="Optional insurance and other post-tax deductions per paycheck" prefix="$" value={activeScenario.inputs.postTaxBenefitsPerPaycheck} onChange={(value) => updateInputs("postTaxBenefitsPerPaycheck", value)} /></div></details>

          <details style={{ border: "1px solid var(--app-border, #e2e8f0)", borderRadius: 12, padding: 12 }}><summary style={{ cursor: "pointer", fontWeight: 750 }}>Add retirement contributions</summary>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, marginTop: 12 }}>
              <NumericField label="Pre-tax 401(k)" suffix="%" value={activeScenario.inputs.traditional401kPercent} onChange={(value) => updateInputs("traditional401kPercent", value)} />
              <NumericField label="Roth 401(k)" suffix="%" value={activeScenario.inputs.roth401kPercent} onChange={(value) => updateInputs("roth401kPercent", value)} />
            </div>
          </details>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}><button type="button" onClick={() => void saveEstimate()} style={{ border: "1px solid var(--app-accent, #2563eb)", background: "var(--app-accent, #2563eb)", color: "#fff", borderRadius: 10, padding: "10px 14px", fontWeight: 700, cursor: "pointer" }}>Save pay estimate</button>{scenarios.length > 1 ? <button type="button" onClick={deleteScenario} style={{ border: "1px solid #ef4444", color: "var(--app-danger-text, #b91c1c)", background: "var(--app-danger-bg, #fff1f2)", borderRadius: 10, padding: "9px 12px", cursor: "pointer" }}>Delete pay estimate</button> : null}</div>
        </section>

        <section style={{ ...cardStyle, display: "grid", gap: 14, position: "sticky", top: 16 }}>
          <div><div style={{ color: "var(--app-text-muted, #64748b)", fontSize: 13 }}>{activeScenario.label}</div><div style={{ fontSize: 30, fontWeight: 850, letterSpacing: "-0.03em" }}>{money(isOneOff(activeScenario) ? activeScenario.inputs.annualSalary : activeScenario.incomeType === "contract" ? activeResult.grossPay : activeResult.netPay)}</div><div style={{ color: "var(--app-text-muted, #64748b)", fontSize: 13 }}>{isOneOff(activeScenario) ? "one-time gross payment" : activeScenario.incomeType === "contract" ? "average payment before taxes" : "estimated average take-home per paycheck"}</div></div>
          {activeScenario.incomeType === "contract" || activeScenario.incomeType === "one-time-contract" ? <div style={{ padding: 12, borderRadius: 12, background: "var(--app-surface-muted, #f8fafc)", color: "var(--app-text-muted, #64748b)", fontSize: 13, lineHeight: 1.5 }}>No payroll withholding is assumed for contract income. The Annual Tax Estimate tab includes its projected federal income and self-employment taxes.</div> : isOneOff(activeScenario) ? <div style={{ display: "grid", gap: 3 }}><ResultLine label="Estimated federal withholding" value={money(activeScenario.federalWithholdingPerPaycheck || activeScenario.inputs.annualSalary * 0.22)} /><ResultLine label="Estimated state withholding" value={activeStateEstimate === null ? "Not available" : money(activeStateEstimate)} /></div> : <ScenarioResult result={activeResult} />}
          <p style={{ margin: "8px 0 0", color: "var(--app-text-muted, #64748b)", fontSize: 12, lineHeight: 1.5 }}>Federal estimates use the 2026 IRS payroll withholding method. Enter state and local tax from a paystub or official state calculator.</p>
        </section>
      </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(300px, 0.8fr)", gap: 24, alignItems: "start" }}>
          <section style={{ ...cardStyle, display: "grid", gap: 18 }}>
            <div><h3 style={{ margin: 0, fontSize: 22 }}>2026 federal tax estimate</h3><p style={{ margin: "6px 0 0", color: "var(--app-text-muted, #64748b)", lineHeight: 1.5 }}>This combines the dated W-2 and contract income periods above. Reorder the periods on the Paycheck Estimate tab; their dates determine how much of each income source is included.</p></div>
            <label style={{ display: "grid", gap: 6, maxWidth: 380 }}><span style={{ fontSize: 13, fontWeight: 650 }}>Filing status</span><select value={scenarios[0]?.inputs.filingStatus ?? "single"} onChange={(event) => setScenarios((current) => current.map((scenario) => ({ ...scenario, inputs: { ...scenario.inputs, filingStatus: event.target.value as FilingStatus } })))} style={controlStyle}><option value="single">Single or married filing separately</option><option value="married">Married filing jointly</option><option value="head">Head of household</option></select></label>
            <div style={{ display: "grid", gap: 10 }}><strong>Deduction</strong><div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}><label style={{ display: "flex", gap: 8 }}><input type="radio" checked={taxSettings.deductionMethod === "standard"} onChange={() => setTaxSettings((current) => ({ ...current, deductionMethod: "standard" }))} />Use standard deduction</label><label style={{ display: "flex", gap: 8 }}><input type="radio" checked={taxSettings.deductionMethod === "itemized"} onChange={() => setTaxSettings((current) => ({ ...current, deductionMethod: "itemized" }))} />Use itemized deductions</label></div>{taxSettings.deductionMethod === "itemized" ? <NumericField label="Estimated itemized deduction amount" prefix="$" value={taxSettings.itemizedDeductions} onChange={(itemizedDeductions) => setTaxSettings((current) => ({ ...current, itemizedDeductions }))} /> : <div style={{ color: "var(--app-text-muted, #64748b)", fontSize: 13 }}>The 2026 standard deduction is applied automatically for your filing status.</div>}</div>
            <details style={{ border: "1px solid var(--app-border, #e2e8f0)", borderRadius: 12, padding: 12 }}><summary style={{ cursor: "pointer", fontWeight: 750 }}>Additional income, credits, and payments</summary><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, marginTop: 12 }}><NumericField label="Other taxable income" prefix="$" value={taxSettings.additionalIncome} onChange={(additionalIncome) => setTaxSettings((current) => ({ ...current, additionalIncome }))} /><NumericField label="Federal tax credits" prefix="$" value={taxSettings.credits} onChange={(credits) => setTaxSettings((current) => ({ ...current, credits }))} /><NumericField label="Estimated tax payments" prefix="$" value={taxSettings.estimatedPayments} onChange={(estimatedPayments) => setTaxSettings((current) => ({ ...current, estimatedPayments }))} /></div></details>
            <div style={{ display: "grid", gap: 8, padding: 14, borderRadius: 12, background: "var(--app-surface-muted, #f8fafc)" }}><ResultLine label="Projected W-2 taxable wages" value={money(annualTotals.w2TaxableWages)} /><ResultLine label="Projected contract income" value={money(annualTotals.selfEmploymentIncome)} /><ResultLine label="Projected federal withholding" value={money(annualTotals.federalWithholding)} /></div>
          </section>
          <section style={{ ...cardStyle, display: "grid", gap: 12, position: "sticky", top: 16 }}>
            <div style={{ padding: 14, borderRadius: 14, background: annualTotals.projectedBalance >= 0 ? "var(--app-positive-bg, #ecfdf5)" : "var(--app-negative-bg, #fff1f2)", color: annualTotals.projectedBalance >= 0 ? "var(--app-positive-text, #15803d)" : "var(--app-negative-text, #be123c)" }}><div style={{ fontSize: 13, fontWeight: 700 }}>{annualTotals.projectedBalance >= 0 ? "Estimated federal refund" : "Estimated federal amount owed"}</div><div style={{ fontSize: 30, fontWeight: 850 }}>{money(Math.abs(annualTotals.projectedBalance))}</div></div>
            <ResultLine label="Taxable income" value={money(annualTotals.taxableIncome)} /><ResultLine label="Deduction used" value={money(annualTotals.deduction)} /><ResultLine label="Federal income tax" value={money(annualTotals.federalIncomeTax)} /><ResultLine label="Self-employment tax" value={money(annualTotals.selfEmploymentTax)} /><ResultLine label="Total estimated federal tax" value={money(annualTotals.totalFederalTax)} strong /><ResultLine label="Withholding and payments" value={money(annualTotals.paymentsAndWithholding)} />
            <p style={{ margin: "8px 0 0", color: "var(--app-text-muted, #64748b)", fontSize: 12, lineHeight: 1.5 }}>Estimate for planning only. It does not yet model every credit, deduction, capital gain, or state return.</p>
          </section>
        </div>
      )}
    </main>
  );
}
