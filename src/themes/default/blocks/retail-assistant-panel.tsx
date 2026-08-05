'use client';

import { useEffect, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  LoaderCircle,
  ScanLine,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';

type PanelMode = {
  title: string;
  prompt: string;
  result: {
    need: string;
    match: string;
    action: string;
  };
};

type AssistantPanel = {
  eyebrow: string;
  title: string;
  description: string;
  input_label: string;
  output_label: string;
  generate_label: string;
  generating_label: string;
  edit_hint: string;
  compliance: string;
  result_labels: {
    need: string;
    match: string;
    action: string;
  };
  modes: PanelMode[];
};

const modeIcons = [FileText, ScanLine, Sparkles];

export function RetailAssistantPanel({ panel }: { panel: AssistantPanel }) {
  const [activeMode, setActiveMode] = useState(0);
  const [prompt, setPrompt] = useState(panel.modes[0]?.prompt ?? '');
  const [showResult, setShowResult] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  const mode = panel.modes[activeMode] ?? panel.modes[0];

  useEffect(() => {
    setPrompt(mode?.prompt ?? '');
    setShowResult(true);
    setIsGenerating(false);
  }, [mode]);

  const generate = () => {
    if (!prompt.trim() || isGenerating) return;

    setIsGenerating(true);
    setShowResult(false);
    window.setTimeout(() => {
      setIsGenerating(false);
      setShowResult(true);
    }, 650);
  };

  return (
    <div
      id="assistant-panel"
      className="border-foreground/10 relative mx-auto mt-12 max-w-6xl overflow-hidden rounded-3xl border bg-white/85 p-2 text-left shadow-2xl shadow-blue-950/10 backdrop-blur dark:bg-zinc-950/80"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-blue-500/10 to-transparent" />
      <div className="bg-background/90 relative rounded-[1.25rem] border p-4 sm:p-6 lg:p-8">
        <div className="mb-6 flex flex-col justify-between gap-4 border-b pb-6 md:flex-row md:items-end">
          <div>
            <div className="text-primary mb-2 flex items-center gap-2 text-xs font-semibold tracking-[0.18em] uppercase">
              <Sparkles className="size-4" />
              {panel.eyebrow}
            </div>
            <h2 className="text-xl font-semibold sm:text-2xl">{panel.title}</h2>
            <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
              {panel.description}
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400">
            <ShieldCheck className="size-4" />
            {panel.compliance}
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="bg-muted/25 rounded-2xl border p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap gap-2">
              {panel.modes.map((item, index) => {
                const Icon = modeIcons[index] ?? Sparkles;
                return (
                  <button
                    key={item.title}
                    type="button"
                    onClick={() => setActiveMode(index)}
                    className={cn(
                      'flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                      activeMode === index
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'bg-background hover:border-primary/50'
                    )}
                  >
                    <Icon className="size-3.5" />
                    {item.title}
                  </button>
                );
              })}
            </div>

            <label
              className="mb-2 block text-sm font-medium"
              htmlFor="retail-assistant-input"
            >
              {panel.input_label}
            </label>
            <textarea
              id="retail-assistant-input"
              value={prompt}
              onChange={(event) => {
                setPrompt(event.target.value);
                setShowResult(false);
              }}
              className="border-input bg-background focus-visible:ring-ring min-h-48 w-full resize-none rounded-xl border px-4 py-3 text-sm leading-6 outline-none focus-visible:ring-2"
            />
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-muted-foreground text-xs">
                {panel.edit_hint}
              </span>
              <Button
                onClick={generate}
                disabled={!prompt.trim() || isGenerating}
              >
                {isGenerating ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                {isGenerating ? panel.generating_label : panel.generate_label}
              </Button>
            </div>
          </div>

          <div className="relative min-h-80 overflow-hidden rounded-2xl border bg-gradient-to-br from-blue-50/80 to-white p-4 sm:p-5 dark:from-blue-950/30 dark:to-zinc-950">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium">
                <CheckCircle2 className="size-4 text-emerald-600" />
                {panel.output_label}
              </div>
              <span className="bg-background/80 text-muted-foreground rounded-full border px-2.5 py-1 text-[11px]">
                AI
              </span>
            </div>

            {isGenerating ? (
              <div className="text-muted-foreground flex min-h-64 items-center justify-center">
                <LoaderCircle className="mr-2 size-5 animate-spin" />
                {panel.generating_label}
              </div>
            ) : showResult ? (
              <div className="space-y-3">
                {(
                  [
                    ['need', panel.result_labels.need],
                    ['match', panel.result_labels.match],
                    ['action', panel.result_labels.action],
                  ] as const
                ).map(([key, label], index) => (
                  <div
                    key={key}
                    className="animate-in fade-in slide-in-from-bottom-2 bg-background/85 rounded-xl border p-4 shadow-sm"
                    style={{ animationDelay: `${index * 80}ms` }}
                  >
                    <div className="text-primary mb-1.5 flex items-center gap-2 text-xs font-semibold">
                      <span className="bg-primary/10 flex size-5 items-center justify-center rounded-full">
                        {index + 1}
                      </span>
                      {label}
                    </div>
                    <p className="text-sm leading-6">{mode.result[key]}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-muted-foreground flex min-h-64 flex-col items-center justify-center px-8 text-center">
                <ArrowRight className="mb-3 size-6" />
                <p className="text-sm">{panel.edit_hint}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
