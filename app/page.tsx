"use client";
import { useState } from "react";

// ─────────────────────────────────────────────
// CONFIG — use environment variables for secrets
// ─────────────────────────────────────────────
const CONFIG = {
  airtable: {
    baseId: process.env.NEXT_PUBLIC_AIRTABLE_BASE_ID || "",
    tableName: "Responses",
    token: process.env.AIRTABLE_TOKEN || "",
  },

  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || "",
    chatId: process.env.TELEGRAM_CHAT_ID || "",
  },
};
// ─────────────────────────────────────────────

const STEPS = [
  "profile",
  "outbound",
  "pain",
  "apis",
  "pricing",
  "value",
  "contact",
  "done",
];
const STEP_LABELS = [
  "Your role",
  "Outbound today",
  "Pain points",
  "API familiarity",
  "Pricing",
  "What matters",
  "Stay in touch",
];

async function submitToAirtable(answers: Record<string, any>) {
  const fields = {
    Name: answers.name || "",
    Email: answers.email || "",
    LinkedIn: answers.linkedIn || "",
    Role: answers.role || "",
    "Team Size": answers.teamSize || "",
    "Current Tools": (answers.currentTools || []).join(", "),
    "Leads Per Month": answers.leadsPerMonth || "",
    "Pain Points": (answers.pains || []).join(", "),
    "Apollo Familiarity": String(answers.apolloFamiliarity || ""),
    "Gemini Familiarity": String(answers.geminiFamiliarity || ""),
    "Has Apollo Key": answers.hasApolloKey || "",
    "Has Gemini Key": answers.hasGeminiKey || "",
    "Willing To Pay": answers.willingToPay25 || "",
    "BYOK Comfort": answers.byokComfort || "",
    "Valued Features": (answers.valuedFeatures || []).join(", "),
    "Biggest Win": answers.biggestWin || "",
  };

  const res = await fetch(
    `https://api.airtable.com/v0/${CONFIG.airtable.baseId}/${encodeURIComponent(CONFIG.airtable.tableName)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CONFIG.airtable.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fields }),
    },
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Airtable error: ${err}`);
  }
  return res.json();
}

async function notifyTelegram(answers: Record<string, any>) {
  const score =
    answers.willingToPay25 === "Yes, immediately"
      ? "🟢 HOT"
      : answers.willingToPay25 === "Yes, after a free trial"
        ? "🟡 WARM"
        : answers.willingToPay25?.startsWith("Maybe")
          ? "🟠 MAYBE"
          : "🔴 NO";

  const text = [
    `💡 *New Light Survey Response* ${score}`,
    ``,
    `👤 ${answers.name || "Anonymous"} · ${answers.role}`,
    `📧 ${answers.email}`,
    answers.linkedIn ? `🔗 ${answers.linkedIn}` : null,
    ``,
    `🏢 Team: ${answers.teamSize}  |  Leads/mo: ${answers.leadsPerMonth}`,
    `🛠 Stack: ${(answers.currentTools || []).join(", ")}`,
    ``,
    `💸 Pay $25: ${answers.willingToPay25}`,
    `🔑 BYOK: ${answers.byokComfort}`,
    `Apollo key: ${answers.hasApolloKey}`,
    `Gemini key: ${answers.hasGeminiKey}`,
    ``,
    `😤 Pains: ${(answers.pains || []).join(" · ")}`,
    `⭐ Wants: ${(answers.valuedFeatures || []).join(" · ")}`,
    answers.biggestWin ? `\n💬 "${answers.biggestWin}"` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const res = await fetch(
    `https://api.telegram.org/bot${CONFIG.telegram.botToken}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CONFIG.telegram.chatId,
        text,
        parse_mode: "Markdown",
      }),
    },
  );

  if (!res.ok) {
    const err = await res.text();
    console.warn("Telegram notify failed:", err);
    // Non-fatal — don't throw, Airtable is the source of truth
  }
}

// ── UI Components ─────────────────────────────

function PipelineProgress({
  current,
  total,
}: {
  current: number;
  total: number;
}) {
  return (
    <div className="pipeline-wrap">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="pipe-segment">
          <div
            className={`pipe-node ${i < current ? "done" : i === current ? "active" : "idle"}`}
          >
            {i < current ? (
              <svg width="10" height="10" viewBox="0 0 10 10">
                <polyline
                  points="1.5,5 4,7.5 8.5,2.5"
                  stroke="#0F0F13"
                  strokeWidth="1.8"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <span className="pipe-num">{i + 1}</span>
            )}
          </div>
          {i < total - 1 && (
            <div className={`pipe-line ${i < current ? "done" : "idle"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

function Tag({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`tag ${selected ? "tag-selected" : "tag-idle"}`}
    >
      {label}
    </button>
  );
}

function MultiSelect({
  options,
  selected,
  onChange,
  max,
}: {
  options: string[];
  selected: string[];
  onChange: (val: string[]) => void;
  max?: number;
}) {
  const toggle = (val: string) => {
    if (selected.includes(val))
      onChange(selected.filter((v: string) => v !== val));
    else if (!max || selected.length < max) onChange([...selected, val]);
  };
  return (
    <div className="tag-group">
      {options.map((o) => (
        <Tag
          key={o}
          label={o}
          selected={selected.includes(o)}
          onClick={() => toggle(o)}
        />
      ))}
    </div>
  );
}

function SingleSelect({
  options,
  selected,
  onChange,
}: {
  options: string[];
  selected: string;
  onChange: (val: string) => void;
}) {
  return (
    <div className="tag-group">
      {options.map((o: string) => (
        <Tag
          key={o}
          label={o}
          selected={selected === o}
          onClick={() => onChange(o)}
        />
      ))}
    </div>
  );
}

function ScaleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (val: number) => void;
}) {
  return (
    <div className="scale-row">
      <span className="scale-label">{label}</span>
      <div className="scale-dots">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => onChange(n)}
            className={`scale-dot ${value === n ? "scale-dot-active" : ""}`}
          />
        ))}
        <span className="scale-hint">{value ? `${value}/5` : ""}</span>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────

export default function LightSurvey() {
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [answers, setAnswers] = useState({
    role: "",
    teamSize: "",
    currentTools: [],
    leadsPerMonth: "",
    pains: [],
    apolloFamiliarity: 0,
    geminiFamiliarity: 0,
    hasApolloKey: "",
    hasGeminiKey: "",
    willingToPay25: "",
    byokComfort: "",
    valuedFeatures: [],
    biggestWin: "",
    name: "",
    email: "",
    linkedIn: "",
  });

  const set = (key: string, val: any) =>
    setAnswers((a) => ({ ...a, [key]: val }));

  const canNext = () => {
    switch (step) {
      case 0:
        return answers.role && answers.teamSize;
      case 1:
        return answers.currentTools.length > 0 && answers.leadsPerMonth;
      case 2:
        return answers.pains.length > 0;
      case 3:
        return (
          answers.apolloFamiliarity > 0 &&
          answers.geminiFamiliarity > 0 &&
          answers.hasApolloKey &&
          answers.hasGeminiKey
        );
      case 4:
        return answers.willingToPay25 && answers.byokComfort;
      case 5:
        return answers.valuedFeatures.length > 0;
      case 6:
        return answers.email;
      default:
        return true;
    }
  };

  const next = () => {
    if (canNext()) setStep((s) => s + 1);
  };
  const prev = () => setStep((s) => Math.max(s - 1, 0));

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await submitToAirtable(answers);
      await notifyTelegram(answers);
      setStep(STEPS.length - 1);
    } catch (err) {
      setSubmitError(
        (err instanceof Error ? err.message : String(err)) ||
          "Something went wrong. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const isDone = step === STEPS.length - 1;
  const isContact = step === 6;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Inter+Tight:wght@600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body, #root { background: #0C0C12; min-height: 100vh; font-family: 'Inter', system-ui, sans-serif; color: #EEEEF5; }

        .outer { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; padding: 40px 16px 80px; }

        .brand { display: flex; align-items: center; gap: 8px; margin-bottom: 36px; align-self: flex-start; max-width: 600px; width: 100%; }
        .brand-dot { width: 8px; height: 8px; border-radius: 50%; background: #7C6FFF; }
        .brand-name { font-family: 'Inter Tight', sans-serif; font-size: 15px; font-weight: 700; letter-spacing: 0.08em; color: #EEEEF5; text-transform: uppercase; }
        .brand-tag { font-size: 12px; color: #54546A; margin-left: 4px; font-weight: 400; letter-spacing: 0; text-transform: none; }

        .card { width: 100%; max-width: 600px; background: #13131C; border: 1px solid #22222E; border-radius: 16px; padding: 40px; }

        .pipeline-wrap { display: flex; align-items: center; margin-bottom: 36px; }
        .pipe-segment { display: flex; align-items: center; flex: 1; }
        .pipe-node { width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all 0.2s ease; }
        .pipe-node.done { background: #7C6FFF; }
        .pipe-node.active { background: #7C6FFF; box-shadow: 0 0 0 4px rgba(124,111,255,0.18); }
        .pipe-node.idle { background: #1E1E2A; border: 1px solid #2E2E3E; }
        .pipe-num { font-size: 10px; font-weight: 600; color: #44445A; }
        .pipe-line { flex: 1; height: 1px; margin: 0 3px; transition: background 0.3s ease; }
        .pipe-line.done { background: #7C6FFF; }
        .pipe-line.idle { background: #22222E; }

        .step-meta { margin-bottom: 6px; font-size: 11px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: #7C6FFF; }
        .step-title { font-family: 'Inter Tight', sans-serif; font-size: 22px; font-weight: 700; color: #EEEEF5; margin-bottom: 6px; line-height: 1.3; }
        .step-sub { font-size: 14px; color: #6B6B82; margin-bottom: 28px; line-height: 1.6; }

        .tag-group { display: flex; flex-wrap: wrap; gap: 8px; }
        .tag { border: 1px solid #2A2A38; background: #17171F; color: #AAAABC; padding: 8px 14px; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.15s ease; font-family: inherit; }
        .tag:hover { border-color: #7C6FFF; color: #EEEEF5; }
        .tag-selected { border-color: #7C6FFF; background: rgba(124,111,255,0.12); color: #A89EFF; }

        .scale-block { display: flex; flex-direction: column; gap: 16px; }
        .scale-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
        .scale-label { font-size: 14px; color: #AAAABC; flex: 1; }
        .scale-dots { display: flex; align-items: center; gap: 8px; }
        .scale-dot { width: 20px; height: 20px; border-radius: 50%; border: 1.5px solid #2E2E3E; background: transparent; cursor: pointer; transition: all 0.15s; }
        .scale-dot:hover { border-color: #7C6FFF; }
        .scale-dot-active { background: #7C6FFF; border-color: #7C6FFF; }
        .scale-hint { font-size: 12px; color: #44445A; min-width: 28px; text-align: right; }

        .field-label { font-size: 13px; font-weight: 500; color: #7A7A90; margin-bottom: 8px; display: block; }
        .field-wrap { margin-bottom: 4px; }

        input[type="text"], input[type="email"], textarea {
          width: 100%; background: #0F0F18; border: 1px solid #22222E; border-radius: 8px; padding: 12px 14px;
          font-size: 14px; color: #EEEEF5; font-family: inherit; transition: border-color 0.15s; outline: none; resize: vertical;
        }
        input[type="text"]:focus, input[type="email"]:focus, textarea:focus { border-color: #7C6FFF; }
        input::placeholder, textarea::placeholder { color: #3A3A50; }

        .divider { height: 1px; background: #1C1C26; margin: 24px 0; }

        .highlight-box { background: rgba(124,111,255,0.07); border: 1px solid rgba(124,111,255,0.2); border-radius: 10px; padding: 16px 18px; margin-bottom: 24px; }
        .highlight-label { font-size: 11px; font-weight: 600; color: #7C6FFF; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 6px; }
        .highlight-text { font-size: 14px; color: #AAAABC; line-height: 1.6; }
        .highlight-price { font-family: 'Inter Tight', sans-serif; font-size: 28px; font-weight: 700; color: #EEEEF5; margin: 6px 0 2px; }
        .highlight-price span { font-size: 14px; font-weight: 400; color: #6B6B82; }

        .btn-row { display: flex; gap: 10px; margin-top: 32px; align-items: center; }
        .btn-primary { padding: 12px 24px; background: #7C6FFF; color: #fff; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; font-family: inherit; transition: all 0.15s; display: flex; align-items: center; gap: 6px; }
        .btn-primary:hover { background: #9187FF; }
        .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
        .btn-ghost { padding: 12px 18px; background: transparent; color: #54546A; border: 1px solid #22222E; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; font-family: inherit; transition: all 0.15s; }
        .btn-ghost:hover { color: #AAAABC; border-color: #3A3A50; }

        .error-box { background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.25); border-radius: 8px; padding: 12px 16px; margin-top: 16px; font-size: 13px; color: #F87171; line-height: 1.5; }

        .spinner { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 0.6s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        .done-glyph { width: 56px; height: 56px; border-radius: 50%; background: rgba(124,111,255,0.15); display: flex; align-items: center; justify-content: center; margin-bottom: 20px; }
        .done-title { font-family: 'Inter Tight', sans-serif; font-size: 26px; font-weight: 700; color: #EEEEF5; margin-bottom: 10px; }
        .done-sub { font-size: 15px; color: #6B6B82; line-height: 1.7; max-width: 440px; }

        .summary-grid { margin-top: 28px; display: flex; flex-direction: column; gap: 8px; }
        .summary-row { display: flex; justify-content: space-between; font-size: 13px; padding: 10px 14px; background: #0F0F18; border-radius: 8px; border: 1px solid #1C1C28; }
        .summary-key { color: #54546A; }
        .summary-val { color: #AAAABC; font-weight: 500; text-align: right; max-width: 65%; }

        .signal-pill { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; margin-bottom: 16px; }
        .signal-hot { background: rgba(34,211,162,0.1); color: #22D3A2; border: 1px solid rgba(34,211,162,0.25); }
        .signal-warm { background: rgba(251,191,36,0.1); color: #FBBF24; border: 1px solid rgba(251,191,36,0.25); }
        .signal-cold { background: rgba(239,68,68,0.1); color: #F87171; border: 1px solid rgba(239,68,68,0.25); }
      `}</style>

      <div className="outer">
        <div className="brand">
          <div className="brand-dot" />
          <span className="brand-name">
            Light<span className="brand-tag"> · Early access survey</span>
          </span>
        </div>

        <div className="card">
          {!isDone && (
            <PipelineProgress current={step} total={STEP_LABELS.length} />
          )}

          {/* Step 0 — Profile */}
          {step === 0 && (
            <div>
              <div className="step-meta">Step 1 of 7</div>
              <div className="step-title">Tell us about yourself</div>
              <div className="step-sub">
                Helps us understand who Light is being built for.
              </div>
              <div className="field-wrap">
                <label className="field-label">What's your role?</label>
                <SingleSelect
                  selected={answers.role}
                  onChange={(v: string) => set("role", v)}
                  options={[
                    "Founder / CEO",
                    "Head of Sales",
                    "AE / SDR",
                    "Growth / Marketing",
                    "RevOps",
                    "Freelance / Consultant",
                    "Other",
                  ]}
                />
              </div>
              <div className="divider" />
              <div className="field-wrap">
                <label className="field-label">
                  How big is your sales / GTM team?
                </label>
                <SingleSelect
                  selected={answers.teamSize}
                  onChange={(v: string) => set("teamSize", v)}
                  options={["Just me", "2–5", "6–15", "16–50", "50+"]}
                />
              </div>
            </div>
          )}

          {/* Step 1 — Outbound today */}
          {step === 1 && (
            <div>
              <div className="step-meta">Step 2 of 7</div>
              <div className="step-title">How you run outbound today</div>
              <div className="step-sub">
                Select all tools that are part of your current stack.
              </div>
              <div className="field-wrap">
                <label className="field-label">
                  Tools you currently use (pick all that apply)
                </label>
                <MultiSelect
                  selected={answers.currentTools}
                  onChange={(v: string[]) => set("currentTools", v)}
                  options={[
                    "Apollo.io",
                    "Instantly",
                    "Smartlead",
                    "Clay",
                    "Outreach",
                    "Salesloft",
                    "HubSpot Sequences",
                    "Manual / Sheets",
                    "LinkedIn Sales Nav",
                    "ZoomInfo",
                    "None yet",
                  ]}
                />
              </div>
              <div className="divider" />
              <div className="field-wrap">
                <label className="field-label">
                  How many net-new leads do you target per month?
                </label>
                <SingleSelect
                  selected={answers.leadsPerMonth}
                  onChange={(v: string) => set("leadsPerMonth", v)}
                  options={[
                    "Under 100",
                    "100–500",
                    "500–1,000",
                    "1,000–5,000",
                    "5,000+",
                  ]}
                />
              </div>
            </div>
          )}

          {/* Step 2 — Pain points */}
          {step === 2 && (
            <div>
              <div className="step-meta">Step 3 of 7</div>
              <div className="step-title">
                Where does your outbound break down?
              </div>
              <div className="step-sub">Pick your top 1–3 frustrations.</div>
              <MultiSelect
                max={3}
                selected={answers.pains}
                onChange={(v: string[]) => set("pains", v)}
                options={[
                  "Emails feel generic, low reply rates",
                  "Manual research takes too long",
                  "Can't afford agency or SDR hire",
                  "Tools are too expensive for my volume",
                  "Leads go stale before I get to them",
                  "No idea which leads to prioritise",
                  "LinkedIn outreach is a black box",
                  "My sequences lack personalisation",
                  "Too many tools to stitch together",
                  "Deliverability issues / landing in spam",
                ]}
              />
            </div>
          )}

          {/* Step 3 — APIs */}
          {step === 3 && (
            <div>
              <div className="step-meta">Step 4 of 7</div>
              <div className="step-title">API familiarity</div>
              <div className="step-sub">
                Light runs on your own API keys — you keep control, we keep
                costs low.
              </div>
              <div className="scale-block" style={{ marginBottom: 24 }}>
                <ScaleRow
                  label="How familiar are you with Apollo.io's API?"
                  value={answers.apolloFamiliarity}
                  onChange={(v: number) => set("apolloFamiliarity", v)}
                />
                <ScaleRow
                  label="How familiar are you with Google Gemini's API?"
                  value={answers.geminiFamiliarity}
                  onChange={(v: number) => set("geminiFamiliarity", v)}
                />
              </div>
              <div className="divider" />
              <div className="field-wrap" style={{ marginBottom: 20 }}>
                <label className="field-label">
                  Do you already have an Apollo API key?
                </label>
                <SingleSelect
                  selected={answers.hasApolloKey}
                  onChange={(v: string) => set("hasApolloKey", v)}
                  options={[
                    "Yes, active",
                    "I have Apollo but no API key",
                    "No, but I'd get one",
                    "No, and I'm not sure I would",
                  ]}
                />
              </div>
              <div className="field-wrap">
                <label className="field-label">
                  Do you already have a Gemini API key?
                </label>
                <SingleSelect
                  selected={answers.hasGeminiKey}
                  onChange={(v: string) => set("hasGeminiKey", v)}
                  options={[
                    "Yes, active",
                    "No, but I'd get one (it's free to start)",
                    "No, and I'm not sure I would",
                  ]}
                />
              </div>
            </div>
          )}

          {/* Step 4 — Pricing */}
          {step === 4 && (
            <div>
              <div className="step-meta">Step 5 of 7</div>
              <div className="step-title">The pricing question</div>
              <div className="step-sub">
                No fluff. Here's exactly what we're considering.
              </div>
              <div className="highlight-box">
                <div className="highlight-label">Proposed model</div>
                <div className="highlight-price">
                  $25 <span>/ month platform fee</span>
                </div>
                <div className="highlight-text" style={{ marginTop: 6 }}>
                  You connect your own Apollo and Gemini keys. Light runs the
                  research, scoring, writing, and sending pipeline on top — up
                  to 500 managed leads included.
                </div>
              </div>
              <div className="field-wrap" style={{ marginBottom: 20 }}>
                <label className="field-label">
                  Would you pay $25/mo given you supply your own API keys?
                </label>
                <SingleSelect
                  selected={answers.willingToPay25}
                  onChange={(v: string) => set("willingToPay25", v)}
                  options={[
                    "Yes, immediately",
                    "Yes, after a free trial",
                    "Maybe — depends on results",
                    "No, price is too high",
                    "No, I won't use my own keys",
                  ]}
                />
              </div>
              <div className="divider" />
              <div className="field-wrap">
                <label className="field-label">
                  How do you feel about the BYOK model?
                </label>
                <SingleSelect
                  selected={answers.byokComfort}
                  onChange={(v: string) => set("byokComfort", v)}
                  options={[
                    "Prefer it — I own my data",
                    "Fine with it, no strong feeling",
                    "Slightly uncomfortable — prefer hosted",
                    "Dealbreaker — I won't manage keys",
                  ]}
                />
              </div>
            </div>
          )}

          {/* Step 5 — Value */}
          {step === 5 && (
            <div>
              <div className="step-meta">Step 6 of 7</div>
              <div className="step-title">What would make it a no-brainer?</div>
              <div className="step-sub">
                Pick up to 3 features that would make Light a must-have.
              </div>
              <div className="field-wrap" style={{ marginBottom: 24 }}>
                <MultiSelect
                  max={3}
                  selected={answers.valuedFeatures}
                  onChange={(v: string[]) => set("valuedFeatures", v)}
                  options={[
                    "AI-written hyper-personalised emails",
                    "Automatic lead scoring + prioritisation",
                    "Signal detection (funding, hiring, tech)",
                    "LinkedIn outreach automation",
                    "Reply classification + draft responses",
                    "Lookalike discovery from best customers",
                    "Deliverability monitoring",
                    "Multi-mailbox rotation",
                    "Campaign analytics + A/B testing",
                    "CRM sync (HubSpot, Salesforce)",
                  ]}
                />
              </div>
              <div className="divider" />
              <div className="field-wrap">
                <label className="field-label">
                  In one sentence — what outcome would justify the spend?
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Book 3 qualified meetings per week without hiring an SDR"
                  value={answers.biggestWin}
                  onChange={(e) => set("biggestWin", e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Step 6 — Contact */}
          {step === 6 && (
            <div>
              <div className="step-meta">Step 7 of 7</div>
              <div className="step-title">Stay in the loop</div>
              <div className="step-sub">
                We'll share early access before public launch. No spam, ever.
              </div>
              <div
                style={{ display: "flex", flexDirection: "column", gap: 16 }}
              >
                <div className="field-wrap">
                  <label className="field-label">Your name</label>
                  <input
                    type="text"
                    placeholder="Alex Morgan"
                    value={answers.name}
                    onChange={(e) => set("name", e.target.value)}
                  />
                </div>
                <div className="field-wrap">
                  <label className="field-label">Work email *</label>
                  <input
                    type="email"
                    placeholder="alex@company.com"
                    value={answers.email}
                    onChange={(e) => set("email", e.target.value)}
                  />
                </div>
                <div className="field-wrap">
                  <label className="field-label">LinkedIn (optional)</label>
                  <input
                    type="text"
                    placeholder="linkedin.com/in/alexmorgan"
                    value={answers.linkedIn}
                    onChange={(e) => set("linkedIn", e.target.value)}
                  />
                </div>
              </div>
              {submitError && <div className="error-box">⚠ {submitError}</div>}
            </div>
          )}

          {/* Done */}
          {isDone &&
            (() => {
              const signal =
                answers.willingToPay25 === "Yes, immediately"
                  ? "hot"
                  : answers.willingToPay25 === "Yes, after a free trial"
                    ? "warm"
                    : "cold";
              return (
                <div>
                  <div className="done-glyph">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M5 13L9 17L19 7"
                        stroke="#7C6FFF"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <div className={`signal-pill signal-${signal}`}>
                    {signal === "hot"
                      ? "🟢 Hot lead"
                      : signal === "warm"
                        ? "🟡 Warm lead"
                        : "🔴 Not converting now"}
                  </div>
                  <div className="done-title">You're in.</div>
                  <div className="done-sub">
                    Thanks
                    {answers.name ? `, ${answers.name.split(" ")[0]}` : ""}.
                    Your answers go directly into what we build first. We'll
                    reach out before public launch.
                  </div>
                  <div className="summary-grid">
                    {[
                      ["Role", answers.role],
                      ["Team", answers.teamSize],
                      ["Leads/mo", answers.leadsPerMonth],
                      ["Would pay $25", answers.willingToPay25],
                      ["BYOK", answers.byokComfort],
                      ["Apollo key", answers.hasApolloKey],
                      ["Gemini key", answers.hasGeminiKey],
                      ["Pains", (answers.pains || []).join(", ")],
                      ["Wants", (answers.valuedFeatures || []).join(", ")],
                      ["Biggest win", answers.biggestWin],
                    ]
                      .filter(([, v]) => v)
                      .map(([k, v]) => (
                        <div className="summary-row" key={k}>
                          <span className="summary-key">{k}</span>
                          <span className="summary-val">{v}</span>
                        </div>
                      ))}
                  </div>
                </div>
              );
            })()}

          {/* Navigation */}
          {!isDone && (
            <div className="btn-row">
              {step > 0 && (
                <button className="btn-ghost" onClick={prev}>
                  Back
                </button>
              )}
              <button
                className="btn-primary"
                onClick={isContact ? handleSubmit : next}
                disabled={!canNext() || submitting}
              >
                {submitting ? <div className="spinner" /> : null}
                {isContact
                  ? submitting
                    ? "Submitting…"
                    : "Submit"
                  : "Continue"}
                {!isContact && !submitting && (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path
                      d="M3 7H11M11 7L7.5 3.5M11 7L7.5 10.5"
                      stroke="white"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </button>
            </div>
          )}
        </div>

        {!isDone && (
          <div
            style={{
              marginTop: 20,
              fontSize: 12,
              color: "#2E2E3E",
              textAlign: "center",
            }}
          >
            Takes about 3 minutes · Your answers stay private
          </div>
        )}
      </div>
    </>
  );
}
