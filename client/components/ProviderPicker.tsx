import { useId } from "react";
import { CheckCircle2, ExternalLink, KeyRound } from "lucide-react";
import {
  AI_PROVIDERS,
  providerConfigured,
  providerModel,
} from "@/lib/providers";
import type { AiProvider, EnvStatus } from "@/lib/types";
import { cn, ui } from "@/lib/ui-classes";

export function ProviderPicker({
  value,
  onChange,
  env,
  disabled,
}: {
  value: AiProvider;
  onChange: (value: AiProvider) => void;
  env: EnvStatus;
  disabled?: boolean;
}) {
  const name = useId();
  return (
    <div className={cn(ui.field.group, ui.subjects.full)}>
      <span className={ui.field.label}>AI 제공자</span>
      <div className={ui.subjects.grid} role="group" aria-label="AI 제공자">
        {AI_PROVIDERS.map((provider) => (
          <label
            key={provider.id}
            className={cn(
              ui.subjects.choice,
              value === provider.id && ui.subjects.selected,
              disabled && ui.subjects.disabled,
            )}
          >
            <input
              className={ui.subjects.radio}
              type="radio"
              name={name}
              checked={value === provider.id}
              disabled={disabled}
              onChange={() => onChange(provider.id)}
            />
            <span className={ui.subjects.copy}>
              <strong>{provider.label}</strong>
              <span className={ui.text.muted13}>
                {providerModel(env, provider.id)} ·{" "}
                {providerConfigured(env, provider.id)
                  ? "키 등록됨"
                  : "키 미설정"}
              </span>
            </span>
            {value === provider.id && <CheckCircle2 size={17} />}
          </label>
        ))}
      </div>
    </div>
  );
}

export function ApiSettings({ env }: { env: EnvStatus }) {
  return (
    <section className={ui.subjects.section} aria-label="API 설정">
      <h2 className={ui.study.heading}>AI API</h2>
      <div className={ui.subjects.grid}>
        {AI_PROVIDERS.map((provider) => (
          <article key={provider.id} className={ui.subjects.card}>
            <div className={ui.study.actions}>
              <KeyRound size={18} />
              <strong>{provider.label}</strong>
            </div>
            <span>
              {providerConfigured(env, provider.id) ? "키 등록됨" : "키 미설정"}
              {env.defaultProvider === provider.id ? " · 기본 제공자" : ""}
            </span>
            <span className={ui.text.muted13}>{provider.key}</span>
            <span className={ui.subjects.copy}>
              {providerModel(env, provider.id)}
            </span>
            <a
              href={provider.docs}
              target="_blank"
              rel="noreferrer"
              className={ui.button.secondary}
            >
              공식 API 문서
              <ExternalLink size={14} />
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}
