import { useEffect, useMemo, useRef, useState } from "react";
import { cloudStorageEnabled, loadCloudPaycheckPlan, saveCloudPaycheckPlan } from "./lib/cloudStorage";
import {
  estimatePaycheck,
  type FilingStatus,
  type PayFrequency,
  type PaycheckInputs,
  type PaycheckResult,
} from "./lib/paycheck";

export type PaycheckScenario = {
  endDate: string;
  id: string;
  inputs: PaycheckInputs;
  label: string;
  startDate: string;
  state: string;
};

type LegacyScenario = Partial<PaycheckScenario> & { effectiveDate?: string };

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
  id: crypto.randomUUID(),
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
      id: saved.id ?? crypto.randomUUID(),
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
  return (
    <label style={{ display: "grid", gap: 6, minWidth: 0 }}>
      <span style={{ fontSize: 13, fontWeight: 650 }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", border: "1px solid var(--app-border-strong, #cbd5e1)", borderRadius: 10, background: "var(--app-input-bg, #fff)", overflow: "hidden" }}>
        {prefix ? <span style={{ paddingLeft: 11, color: "var(--app-text-muted, #64748b)" }}>{prefix}</span> : null}
        <input min="0" step="0.01" type="number" value={value} onChange={(event) => onChange(Number(event.target.value) || 0)} style={{ width: "100%", minWidth: 0, border: 0, outline: 0, padding: 10, background: "transparent", color: "var(--app-text, #0f172a)" }} />
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
  const [scenarios, setScenarios] = useState<PaycheckScenario[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? normalizeScenarios(JSON.parse(saved)) : [makeScenario()];
    } catch {
      return [makeScenario()];
    }
  });
  const [activeId, setActiveId] = useState(() => scenarios[0].id);
  const [taxTab, setTaxTab] = useState<"federal" | "state">("federal");
  const [cloudLoaded, setCloudLoaded] = useState(!cloudStorageEnabled);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeScenario = scenarios.find((scenario) => scenario.id === activeId) ?? scenarios[0];
  const activeResult = useMemo(() => estimatePaycheck(activeScenario.inputs), [activeScenario]);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(scenarios));
  }, [scenarios, storageKey]);

  useEffect(() => {
    if (!cloudStorageEnabled) return;
    let mounted = true;
    void loadCloudPaycheckPlan<unknown>(userId)
      .then((saved) => {
        if (!mounted) return;
        if (saved) {
          const normalized = normalizeScenarios(saved);
          setScenarios(normalized);
          setActiveId(normalized[0].id);
        }
      })
      .catch(() => undefined)
      .finally(() => { if (mounted) setCloudLoaded(true); });
    return () => { mounted = false; };
  }, [userId]);

  useEffect(() => {
    if (!cloudStorageEnabled || !cloudLoaded) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { void saveCloudPaycheckPlan(userId, scenarios).catch(() => undefined); }, 700);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [cloudLoaded, scenarios, userId]);

  const updateScenario = (update: Partial<PaycheckScenario>) => {
    setScenarios((current) => current.map((scenario) => scenario.id === activeScenario.id ? { ...scenario, ...update } : scenario));
  };
  const updateInputs = <K extends keyof PaycheckInputs>(key: K, value: PaycheckInputs[K]) => {
    updateScenario({ inputs: { ...activeScenario.inputs, [key]: value } });
  };
  const addScenario = () => {
    const next = makeScenario(scenarios.length, activeScenario);
    setScenarios((current) => [...current, next]);
    setActiveId(next.id);
  };
  const deleteScenario = () => {
    if (scenarios.length === 1) return;
    const remaining = scenarios.filter((scenario) => scenario.id !== activeScenario.id);
    setScenarios(remaining);
    setActiveId(remaining[0].id);
  };

  const baselineResult = estimatePaycheck(scenarios[0].inputs);
  const netDelta = activeResult.netPay - baselineResult.netPay;
  const periodLabel = (scenario: PaycheckScenario) => {
    const start = scenario.startDate || "Start of year";
    const end = scenario.endDate || "Ongoing";
    return `${start} – ${end}`;
  };

  return (
    <main style={{ display: "grid", gap: 24, minWidth: 0 }}>
      <section style={{ ...cardStyle, display: "grid", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "grid", gap: 5, maxWidth: 780 }}>
            <h2 style={{ margin: 0, fontSize: 28 }}>Paycheck estimate</h2>
            <p style={{ margin: 0, color: "var(--app-text-muted, #64748b)", lineHeight: 1.55 }}>
              Add salary periods to see how changes in pay, taxes, benefits, and retirement contributions affect take-home pay. A blank start date means the beginning of the year; a blank end date means the salary continues.
            </p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" onClick={addScenario} style={{ border: 0, background: "var(--app-accent, #2563eb)", color: "#fff", borderRadius: 10, padding: "10px 14px", fontWeight: 700, cursor: "pointer" }}>Add salary period</button>
            <button type="button" aria-label="Close paycheck estimate" onClick={onClose} style={{ border: "1px solid var(--app-border, #e2e8f0)", background: "var(--app-surface, #fff)", color: "var(--app-text, #0f172a)", borderRadius: 10, width: 42, fontSize: 24, cursor: "pointer" }}>×</button>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {scenarios.map((scenario) => (
            <button key={scenario.id} type="button" onClick={() => setActiveId(scenario.id)} style={{ display: "grid", gap: 2, textAlign: "left", border: scenario.id === activeScenario.id ? "1px solid var(--app-accent, #2563eb)" : "1px solid var(--app-border, #e2e8f0)", background: scenario.id === activeScenario.id ? "var(--app-accent-soft, #dbeafe)" : "var(--app-surface, #fff)", color: "var(--app-text, #0f172a)", borderRadius: 12, padding: "9px 13px", cursor: "pointer" }}>
              <strong>{scenario.label}</strong><span style={{ fontSize: 12, color: "var(--app-text-muted, #64748b)" }}>{periodLabel(scenario)}</span>
            </button>
          ))}
        </div>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.35fr) minmax(300px, 0.65fr)", gap: 24, alignItems: "start" }}>
        <section style={{ ...cardStyle, display: "grid", gap: 22, minWidth: 0 }}>
          <div style={{ display: "grid", gap: 12 }}>
            <h3 style={{ margin: 0, fontSize: 18 }}>Salary period</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
              <TextField label="Period name" value={activeScenario.label} onChange={(label) => updateScenario({ label })} />
              <TextField label="Salary start date" type="date" value={activeScenario.startDate} onChange={(startDate) => updateScenario({ startDate })} />
              <TextField label="Salary end date (optional)" type="date" value={activeScenario.endDate} onChange={(endDate) => updateScenario({ endDate })} />
              <NumericField label="Annual salary" prefix="$" value={activeScenario.inputs.annualSalary} onChange={(value) => updateInputs("annualSalary", value)} />
              <label style={{ display: "grid", gap: 6, minWidth: 0 }}><span style={{ fontSize: 13, fontWeight: 650 }}>Pay frequency</span>
                <select value={activeScenario.inputs.payFrequency} onChange={(event) => updateInputs("payFrequency", event.target.value as PayFrequency)} style={controlStyle}>
                  <option value="weekly">Weekly</option><option value="biweekly">Biweekly</option><option value="semimonthly">Semimonthly</option><option value="monthly">Monthly</option>
                </select>
              </label>
            </div>
          </div>

          <div style={{ display: "grid", gap: 14 }}>
            <div style={{ display: "flex", borderBottom: "1px solid var(--app-border, #e2e8f0)" }}>
              {(["federal", "state"] as const).map((tab) => <button key={tab} type="button" onClick={() => setTaxTab(tab)} style={{ flex: "1 1 0", border: 0, borderBottom: taxTab === tab ? "3px solid var(--app-accent, #2563eb)" : "3px solid transparent", background: "transparent", color: "var(--app-text, #0f172a)", padding: "11px 14px", fontWeight: 750, cursor: "pointer" }}>{tab === "federal" ? "Federal taxes" : "State taxes"}</button>)}
            </div>
            {taxTab === "federal" ? (
              <div style={{ display: "grid", gap: 14 }}>
                <label style={{ display: "grid", gap: 6, maxWidth: 360 }}><span style={{ fontSize: 13, fontWeight: 650 }}>Federal filing status</span>
                  <select value={activeScenario.inputs.filingStatus} onChange={(event) => updateInputs("filingStatus", event.target.value as FilingStatus)} style={controlStyle}>
                    <option value="single">Single or married filing separately</option><option value="married">Married filing jointly</option><option value="head">Head of household</option>
                  </select>
                </label>
                <label style={{ display: "flex", gap: 9, alignItems: "center", fontSize: 14 }}><input type="checkbox" checked={activeScenario.inputs.w4Step2Checked} onChange={(event) => updateInputs("w4Step2Checked", event.target.checked)} />Use higher withholding for multiple jobs or a working spouse</label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>
                  <NumericField label="Annual tax credits" prefix="$" value={activeScenario.inputs.w4Credits} onChange={(value) => updateInputs("w4Credits", value)} />
                  <NumericField label="Other annual income" prefix="$" value={activeScenario.inputs.w4OtherIncome} onChange={(value) => updateInputs("w4OtherIncome", value)} />
                  <NumericField label="Additional annual deductions" prefix="$" value={activeScenario.inputs.w4Deductions} onChange={(value) => updateInputs("w4Deductions", value)} />
                  <NumericField label="Extra tax per paycheck" prefix="$" value={activeScenario.inputs.w4AdditionalWithholding} onChange={(value) => updateInputs("w4AdditionalWithholding", value)} />
                </div>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                <label style={{ display: "grid", gap: 6 }}><span style={{ fontSize: 13, fontWeight: 650 }}>Work state</span><select value={activeScenario.state} onChange={(event) => updateScenario({ state: event.target.value })} style={controlStyle}>{STATES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></label>
                <NumericField label="State and local tax per paycheck" prefix="$" value={activeScenario.inputs.stateWithholdingPerPaycheck} onChange={(value) => updateInputs("stateWithholdingPerPaycheck", value)} />
              </div>
            )}
          </div>

          <div style={{ display: "grid", gap: 12 }}><h3 style={{ margin: 0, fontSize: 18 }}>Pre-tax benefits</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(155px, 1fr))", gap: 12 }}>
              <NumericField label="Medical per paycheck" prefix="$" value={activeScenario.inputs.medicalPerPaycheck} onChange={(value) => updateInputs("medicalPerPaycheck", value)} />
              <NumericField label="Dental per paycheck" prefix="$" value={activeScenario.inputs.dentalPerPaycheck} onChange={(value) => updateInputs("dentalPerPaycheck", value)} />
              <NumericField label="Vision per paycheck" prefix="$" value={activeScenario.inputs.visionPerPaycheck} onChange={(value) => updateInputs("visionPerPaycheck", value)} />
              <NumericField label="HSA per paycheck" prefix="$" value={activeScenario.inputs.hsaPerPaycheck} onChange={(value) => updateInputs("hsaPerPaycheck", value)} />
              <NumericField label="Other pre-tax benefits" prefix="$" value={activeScenario.inputs.otherPreTaxPerPaycheck} onChange={(value) => updateInputs("otherPreTaxPerPaycheck", value)} />
            </div>
          </div>

          <div style={{ display: "grid", gap: 12 }}><h3 style={{ margin: 0, fontSize: 18 }}>Post-tax benefits</h3>
            <NumericField label="Optional insurance and other post-tax deductions per paycheck" prefix="$" value={activeScenario.inputs.postTaxBenefitsPerPaycheck} onChange={(value) => updateInputs("postTaxBenefitsPerPaycheck", value)} />
          </div>

          <div style={{ display: "grid", gap: 12 }}><h3 style={{ margin: 0, fontSize: 18 }}>Retirement</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>
              <NumericField label="Pre-tax 401(k)" suffix="%" value={activeScenario.inputs.traditional401kPercent} onChange={(value) => updateInputs("traditional401kPercent", value)} />
              <NumericField label="Roth 401(k)" suffix="%" value={activeScenario.inputs.roth401kPercent} onChange={(value) => updateInputs("roth401kPercent", value)} />
            </div>
          </div>
          {scenarios.length > 1 ? <button type="button" onClick={deleteScenario} style={{ justifySelf: "start", border: "1px solid #ef4444", color: "#b91c1c", background: "transparent", borderRadius: 10, padding: "9px 12px", cursor: "pointer" }}>Delete salary period</button> : null}
        </section>

        <section style={{ ...cardStyle, display: "grid", gap: 14, position: "sticky", top: 16 }}>
          <div><div style={{ color: "var(--app-text-muted, #64748b)", fontSize: 13 }}>{activeScenario.label}</div><div style={{ fontSize: 30, fontWeight: 850, letterSpacing: "-0.03em" }}>{money(activeResult.netPay)}</div><div style={{ color: "var(--app-text-muted, #64748b)", fontSize: 13 }}>estimated average take-home per paycheck</div></div>
          {activeScenario.id !== scenarios[0].id ? <div style={{ padding: "10px 12px", borderRadius: 12, background: netDelta >= 0 ? "var(--app-positive-bg, #ecfdf5)" : "var(--app-negative-bg, #fff1f2)", color: netDelta >= 0 ? "var(--app-positive-text, #15803d)" : "var(--app-negative-text, #be123c)", fontWeight: 700 }}>{netDelta >= 0 ? "+" : ""}{money(netDelta)} per paycheck versus {scenarios[0].label}</div> : null}
          <ScenarioResult result={activeResult} />
          <p style={{ margin: "8px 0 0", color: "var(--app-text-muted, #64748b)", fontSize: 12, lineHeight: 1.5 }}>Federal estimates use the 2026 IRS payroll withholding method. Enter state and local tax from a paystub or official state calculator.</p>
        </section>
      </div>
    </main>
  );
}
