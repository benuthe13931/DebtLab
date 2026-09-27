import { useEffect, useMemo, useState } from "react";
import { cloudStorageEnabled, loadCloudPaycheckPlan, saveCloudPaycheckPlan } from "./lib/cloudStorage";
import {
  estimatePaycheck,
  type FilingStatus,
  type PayFrequency,
  type PaycheckInputs,
  type PaycheckResult,
} from "./lib/paycheck";

export type PaycheckScenario = {
  effectiveDate: string;
  id: string;
  inputs: PaycheckInputs;
  label: string;
  state: string;
};

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
  annualSalary: 75_000,
  dentalPerPaycheck: 0,
  filingStatus: "single",
  hsaPerPaycheck: 0,
  medicalPerPaycheck: 0,
  otherPreTaxPerPaycheck: 0,
  payFrequency: "biweekly",
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

const makeScenario = (): PaycheckScenario => ({
  effectiveDate: new Date().toISOString().slice(0, 10),
  id: crypto.randomUUID(),
  inputs: { ...defaultInputs },
  label: "Current paycheck",
  state: "PA",
});

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

function NumericField({
  label,
  onChange,
  prefix,
  suffix,
  value,
}: {
  label: string;
  onChange: (value: number) => void;
  prefix?: string;
  suffix?: string;
  value: number;
}) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 13, fontWeight: 650, color: "var(--app-heading, #334155)" }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", border: "1px solid var(--app-border-strong, #cbd5e1)", borderRadius: 10, background: "var(--app-input-bg, #fff)", overflow: "hidden" }}>
        {prefix ? <span style={{ paddingLeft: 11, color: "var(--app-text-muted, #64748b)" }}>{prefix}</span> : null}
        <input
          min="0"
          step="0.01"
          type="number"
          value={value}
          onChange={(event) => onChange(Number(event.target.value) || 0)}
          style={{ width: "100%", border: 0, outline: 0, padding: "10px", background: "transparent", color: "var(--app-text, #0f172a)" }}
        />
        {suffix ? <span style={{ paddingRight: 11, color: "var(--app-text-muted, #64748b)" }}>{suffix}</span> : null}
      </div>
    </label>
  );
}

function ResultLine({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: strong ? "12px 0 0" : "7px 0", borderTop: strong ? "1px solid var(--app-border, #e2e8f0)" : undefined }}>
      <span style={{ color: strong ? "var(--app-text, #0f172a)" : "var(--app-text-muted, #64748b)", fontWeight: strong ? 700 : 500 }}>{label}</span>
      <span style={{ fontWeight: strong ? 800 : 650, color: "var(--app-text, #0f172a)" }}>{value}</span>
    </div>
  );
}

function ScenarioResult({ result }: { result: PaycheckResult }) {
  return (
    <div style={{ display: "grid", gap: 2 }}>
      <ResultLine label="Gross pay" value={money(result.grossPay)} />
      <ResultLine label="Pre-tax benefits + HSA" value={`−${money(result.benefitDeductions)}`} />
      <ResultLine label="Traditional 401(k)" value={`−${money(result.traditional401k)}`} />
      <ResultLine label="Roth 401(k)" value={`−${money(result.roth401k)}`} />
      <ResultLine label="Federal income tax" value={`−${money(result.federalIncomeTax)}`} />
      <ResultLine label="Social Security" value={`−${money(result.socialSecurityTax)}`} />
      <ResultLine label="Medicare" value={`−${money(result.medicareTax)}`} />
      <ResultLine label="State/local withholding" value={`−${money(result.stateWithholding)}`} />
      <ResultLine label="Estimated net paycheck" value={money(result.netPay)} strong />
      <ResultLine label="Estimated annual take-home" value={money(result.annualNet)} />
    </div>
  );
}

export function PaycheckPage({ userId }: { userId: string }) {
  const storageKey = `loan-sim:paycheck-scenarios:${userId}`;
  const [scenarios, setScenarios] = useState<PaycheckScenario[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return JSON.parse(saved) as PaycheckScenario[];
    } catch {
      // Start clean if a previous local draft cannot be parsed.
    }
    return [makeScenario()];
  });
  const [activeId, setActiveId] = useState(() => scenarios[0]?.id ?? "");
  const [saveStatus, setSaveStatus] = useState("");
  const activeScenario = scenarios.find((scenario) => scenario.id === activeId) ?? scenarios[0];
  const activeResult = useMemo(
    () => estimatePaycheck(activeScenario?.inputs ?? defaultInputs),
    [activeScenario],
  );

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(scenarios));
  }, [scenarios, storageKey]);

  useEffect(() => {
    if (!cloudStorageEnabled) return;
    let mounted = true;
    void loadCloudPaycheckPlan<PaycheckScenario[]>(userId)
      .then((saved) => {
        if (!mounted || !saved?.length) return;
        setScenarios(saved);
        setActiveId(saved[0].id);
        setSaveStatus("Loaded from cloud.");
      })
      .catch((error: unknown) => {
        if (mounted) setSaveStatus(error instanceof Error ? error.message : "Could not load the cloud paycheck plan.");
      });
    return () => { mounted = false; };
  }, [userId]);

  const saveToCloud = async () => {
    setSaveStatus("Saving…");
    try {
      await saveCloudPaycheckPlan(userId, scenarios);
      setSaveStatus("Saved to cloud.");
    } catch (error) {
      setSaveStatus(error instanceof Error ? error.message : "Could not save the paycheck plan.");
    }
  };

  const updateScenario = (update: Partial<PaycheckScenario>) => {
    setScenarios((current) => current.map((scenario) => scenario.id === activeScenario.id ? { ...scenario, ...update } : scenario));
  };
  const updateInputs = <K extends keyof PaycheckInputs>(key: K, value: PaycheckInputs[K]) => {
    updateScenario({ inputs: { ...activeScenario.inputs, [key]: value } });
  };
  const addFutureScenario = () => {
    const nextDate = new Date();
    nextDate.setMonth(nextDate.getMonth() + 1);
    const next: PaycheckScenario = {
      ...activeScenario,
      effectiveDate: nextDate.toISOString().slice(0, 10),
      id: crypto.randomUUID(),
      inputs: { ...activeScenario.inputs },
      label: "Future paycheck",
    };
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

  return (
    <main style={{ display: "grid", gap: 24 }}>
      <section style={{ ...cardStyle, display: "grid", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "grid", gap: 5, maxWidth: 820 }}>
            <h2 style={{ margin: 0, fontSize: 28 }}>Paycheck estimate</h2>
            <p style={{ margin: 0, color: "var(--app-text-muted, #64748b)", lineHeight: 1.55 }}>
              Model today’s paycheck and dated future changes before using take-home pay in a debt plan. Calculations use the 2026 IRS automated payroll withholding method and 2026 federal payroll-tax limits.
            </p>
          </div>
          <button type="button" onClick={addFutureScenario} style={{ border: "1px solid var(--app-accent, #2563eb)", background: "var(--app-accent, #2563eb)", color: "#fff", borderRadius: 10, padding: "10px 14px", fontWeight: 700, cursor: "pointer" }}>
            Add future change
          </button>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {scenarios.map((scenario) => (
            <button key={scenario.id} type="button" onClick={() => setActiveId(scenario.id)} style={{ border: scenario.id === activeScenario.id ? "1px solid var(--app-accent, #2563eb)" : "1px solid var(--app-border, #e2e8f0)", background: scenario.id === activeScenario.id ? "var(--app-accent-soft, #dbeafe)" : "var(--app-surface, #fff)", color: "var(--app-text, #0f172a)", borderRadius: 999, padding: "8px 12px", cursor: "pointer" }}>
              {scenario.label} · {scenario.effectiveDate}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {cloudStorageEnabled ? <button type="button" onClick={() => void saveToCloud()} style={{ border: "1px solid var(--app-border, #e2e8f0)", background: "var(--app-surface, #fff)", color: "var(--app-text, #0f172a)", borderRadius: 10, padding: "8px 12px", fontWeight: 650, cursor: "pointer" }}>Save paycheck plan</button> : null}
          <span style={{ color: "var(--app-text-muted, #64748b)", fontSize: 12 }}>{saveStatus || (cloudStorageEnabled ? "Changes are kept locally until saved to cloud." : "Changes are saved in this browser.")}</span>
        </div>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(330px, 1fr))", gap: 24, alignItems: "start" }}>
        <section style={{ ...cardStyle, display: "grid", gap: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 650 }}>Scenario name</span>
              <input value={activeScenario.label} onChange={(event) => updateScenario({ label: event.target.value })} style={{ border: "1px solid var(--app-border-strong, #cbd5e1)", borderRadius: 10, padding: "10px 12px", background: "var(--app-input-bg, #fff)", color: "var(--app-text, #0f172a)" }} />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 650 }}>Effective date</span>
              <input type="date" value={activeScenario.effectiveDate} onChange={(event) => updateScenario({ effectiveDate: event.target.value })} style={{ border: "1px solid var(--app-border-strong, #cbd5e1)", borderRadius: 10, padding: "10px 12px", background: "var(--app-input-bg, #fff)", color: "var(--app-text, #0f172a)" }} />
            </label>
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            <h3 style={{ margin: 0, fontSize: 18 }}>Pay and tax setup</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
              <NumericField label="Annual salary" prefix="$" value={activeScenario.inputs.annualSalary} onChange={(value) => updateInputs("annualSalary", value)} />
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 650 }}>Pay frequency</span>
                <select value={activeScenario.inputs.payFrequency} onChange={(event) => updateInputs("payFrequency", event.target.value as PayFrequency)} style={{ border: "1px solid var(--app-border-strong, #cbd5e1)", borderRadius: 10, padding: "10px 12px", background: "var(--app-input-bg, #fff)", color: "var(--app-text, #0f172a)" }}>
                  <option value="weekly">Weekly (52)</option><option value="biweekly">Every two weeks (26)</option><option value="semimonthly">Twice monthly (24)</option><option value="monthly">Monthly (12)</option>
                </select>
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 650 }}>Federal filing status</span>
                <select value={activeScenario.inputs.filingStatus} onChange={(event) => updateInputs("filingStatus", event.target.value as FilingStatus)} style={{ border: "1px solid var(--app-border-strong, #cbd5e1)", borderRadius: 10, padding: "10px 12px", background: "var(--app-input-bg, #fff)", color: "var(--app-text, #0f172a)" }}>
                  <option value="single">Single / married filing separately</option><option value="married">Married filing jointly</option><option value="head">Head of household</option>
                </select>
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 650 }}>Work state</span>
                <select value={activeScenario.state} onChange={(event) => updateScenario({ state: event.target.value })} style={{ border: "1px solid var(--app-border-strong, #cbd5e1)", borderRadius: 10, padding: "10px 12px", background: "var(--app-input-bg, #fff)", color: "var(--app-text, #0f172a)" }}>
                  {STATES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
                </select>
              </label>
            </div>
            <label style={{ display: "flex", gap: 9, alignItems: "center", fontSize: 14 }}>
              <input type="checkbox" checked={activeScenario.inputs.w4Step2Checked} onChange={(event) => updateInputs("w4Step2Checked", event.target.checked)} />
              W-4 Step 2 checkbox is checked for multiple jobs or a working spouse
            </label>
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            <h3 style={{ margin: 0, fontSize: 18 }}>Pre-tax benefits per paycheck</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(155px, 1fr))", gap: 12 }}>
              <NumericField label="Medical" prefix="$" value={activeScenario.inputs.medicalPerPaycheck} onChange={(value) => updateInputs("medicalPerPaycheck", value)} />
              <NumericField label="Dental" prefix="$" value={activeScenario.inputs.dentalPerPaycheck} onChange={(value) => updateInputs("dentalPerPaycheck", value)} />
              <NumericField label="Vision" prefix="$" value={activeScenario.inputs.visionPerPaycheck} onChange={(value) => updateInputs("visionPerPaycheck", value)} />
              <NumericField label="HSA" prefix="$" value={activeScenario.inputs.hsaPerPaycheck} onChange={(value) => updateInputs("hsaPerPaycheck", value)} />
              <NumericField label="Other Section 125" prefix="$" value={activeScenario.inputs.otherPreTaxPerPaycheck} onChange={(value) => updateInputs("otherPreTaxPerPaycheck", value)} />
            </div>
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            <h3 style={{ margin: 0, fontSize: 18 }}>Retirement</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <NumericField label="Traditional 401(k)" suffix="%" value={activeScenario.inputs.traditional401kPercent} onChange={(value) => updateInputs("traditional401kPercent", value)} />
              <NumericField label="Roth 401(k)" suffix="%" value={activeScenario.inputs.roth401kPercent} onChange={(value) => updateInputs("roth401kPercent", value)} />
            </div>
            <div style={{ fontSize: 12, color: "var(--app-text-muted, #64748b)", lineHeight: 1.5 }}>
              Traditional contributions reduce federal withholding wages. Traditional and Roth contributions remain subject to Social Security and Medicare.
            </div>
          </div>

          <details>
            <summary style={{ cursor: "pointer", fontWeight: 700 }}>W-4 adjustments and state withholding</summary>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginTop: 14 }}>
              <NumericField label="Step 3 credits (annual)" prefix="$" value={activeScenario.inputs.w4Credits} onChange={(value) => updateInputs("w4Credits", value)} />
              <NumericField label="Step 4(a) other income" prefix="$" value={activeScenario.inputs.w4OtherIncome} onChange={(value) => updateInputs("w4OtherIncome", value)} />
              <NumericField label="Step 4(b) deductions" prefix="$" value={activeScenario.inputs.w4Deductions} onChange={(value) => updateInputs("w4Deductions", value)} />
              <NumericField label="Step 4(c) extra per check" prefix="$" value={activeScenario.inputs.w4AdditionalWithholding} onChange={(value) => updateInputs("w4AdditionalWithholding", value)} />
              <NumericField label={`${activeScenario.state} state/local per check`} prefix="$" value={activeScenario.inputs.stateWithholdingPerPaycheck} onChange={(value) => updateInputs("stateWithholdingPerPaycheck", value)} />
            </div>
          </details>

          {scenarios.length > 1 ? <button type="button" onClick={deleteScenario} style={{ justifySelf: "start", border: "1px solid #ef4444", color: "#b91c1c", background: "var(--app-surface, #fff)", borderRadius: 10, padding: "9px 12px", cursor: "pointer" }}>Delete this scenario</button> : null}
        </section>

        <div style={{ display: "grid", gap: 18, position: "sticky", top: 16 }}>
          <section style={{ ...cardStyle, display: "grid", gap: 14 }}>
            <div>
              <div style={{ color: "var(--app-text-muted, #64748b)", fontSize: 13 }}>{activeScenario.label}</div>
              <div style={{ fontSize: 30, fontWeight: 850, letterSpacing: "-0.03em" }}>{money(activeResult.netPay)}</div>
              <div style={{ color: "var(--app-text-muted, #64748b)", fontSize: 13 }}>estimated average take-home per paycheck</div>
            </div>
            {activeScenario.id !== scenarios[0].id ? <div style={{ padding: "10px 12px", borderRadius: 12, background: netDelta >= 0 ? "var(--app-positive-bg, #ecfdf5)" : "var(--app-negative-bg, #fff1f2)", color: netDelta >= 0 ? "var(--app-positive-text, #15803d)" : "var(--app-negative-text, #be123c)", fontWeight: 700 }}>{netDelta >= 0 ? "+" : ""}{money(netDelta)} per paycheck versus current</div> : null}
            <ScenarioResult result={activeResult} />
          </section>

          <section style={{ ...cardStyle, display: "grid", gap: 8, fontSize: 13, lineHeight: 1.55 }}>
            <strong>Accuracy boundary</strong>
            <span style={{ color: "var(--app-text-muted, #64748b)" }}>
              Federal withholding follows 2026 IRS Publication 15-T. Social Security uses the 2026 $184,500 wage base; Medicare includes the employee rate and Additional Medicare Tax threshold. Above those thresholds, this page shows an annual average, while individual checks will change when the threshold is crossed. State and local withholding must currently be entered from a paystub or official state calculator and is deliberately not guessed.
            </span>
            <span style={{ color: "var(--app-text-muted, #64748b)" }}>Draft scenarios are saved in this browser. They are not yet used by debt projections.</span>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <a href="https://www.irs.gov/publications/p15t" target="_blank" rel="noreferrer" style={{ color: "var(--app-accent, #2563eb)" }}>IRS Publication 15-T</a>
              <a href="https://www.ssa.gov/oact/cola/cbb.html" target="_blank" rel="noreferrer" style={{ color: "var(--app-accent, #2563eb)" }}>SSA wage base</a>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
