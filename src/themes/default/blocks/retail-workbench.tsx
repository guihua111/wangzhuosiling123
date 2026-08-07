'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  Plus,
  Search,
  Sparkles,
} from 'lucide-react';

import { Link } from '@/core/i18n/navigation';
import { SmartIcon } from '@/shared/blocks/common';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';
import { Section } from '@/shared/types/blocks/landing';

type WorkbenchModule = {
  id: string;
  title: string;
  description: string;
  icon: string;
  url?: string;
};

type LedgerRow = {
  name: string;
  industry: string;
  cashflow: string;
  loan: string;
  followup: string;
  priority: string;
  segment: string;
};

type MaterialItem = {
  title: string;
  description: string;
  complete: boolean;
};

export function RetailWorkbench({ section }: { section: Section }) {
  const modules = (section.modules ?? []) as WorkbenchModule[];
  const copy = section.copy as any;
  const [activeId, setActiveId] = useState(
    (section.default_module as string) ?? modules[0]?.id ?? 'ledger'
  );
  const [ledgerQuery, setLedgerQuery] = useState('');
  const [ledgerFilter, setLedgerFilter] = useState('all');
  const [ocrReviewed, setOcrReviewed] = useState(false);
  const [selectedMaterialName, setSelectedMaterialName] = useState('');
  const materialInputRef = useRef<HTMLInputElement>(null);
  const [interviewText, setInterviewText] = useState(
    copy.interview.sample as string
  );
  const [interviewReady, setInterviewReady] = useState(true);
  const [matchReady, setMatchReady] = useState(true);
  const [scriptScenario, setScriptScenario] = useState(0);
  const [materialChecked, setMaterialChecked] = useState<Set<number>>(
    new Set(
      (copy.materials.items as MaterialItem[])
        .map((item, index) => (item.complete ? index : -1))
        .filter((index) => index >= 0)
    )
  );
  const [taskTitle, setTaskTitle] = useState('');
  const [tasks, setTasks] = useState<string[]>(copy.followup.tasks as string[]);
  const [savedMessage, setSavedMessage] = useState('');

  useEffect(() => {
    const moduleId = new URL(window.location.href).searchParams.get('module');
    if (moduleId && modules.some((item) => item.id === moduleId)) {
      setActiveId(moduleId);
    } else if (
      section.default_module &&
      modules.some((item) => item.id === section.default_module)
    ) {
      setActiveId(section.default_module as string);
    }
  }, [modules, section.default_module]);

  const activeModule =
    modules.find((item) => item.id === activeId) ?? modules[0];

  const ledgerRows = useMemo(() => {
    const query = ledgerQuery.trim().toLowerCase();
    return (copy.ledger.rows as LedgerRow[]).filter((row) => {
      const matchesQuery =
        !query || `${row.name} ${row.industry}`.toLowerCase().includes(query);
      const matchesFilter =
        ledgerFilter === 'all' || row.segment === ledgerFilter;
      return matchesQuery && matchesFilter;
    });
  }, [copy.ledger.rows, ledgerFilter, ledgerQuery]);

  const ledgerResultCount =
    ledgerFilter === 'all' && !ledgerQuery.trim()
      ? Number(copy.ledger.total_count) || ledgerRows.length
      : ledgerRows.length;

  const activateModule = (id: string) => {
    setActiveId(id);
    setSavedMessage('');
    const url = new URL(window.location.href);
    url.searchParams.set('module', id);
    window.history.replaceState({}, '', url);
  };

  const save = () => {
    setSavedMessage(copy.shared.saved);
  };

  const renderLedger = () => (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <input
            value={ledgerQuery}
            onChange={(event) => setLedgerQuery(event.target.value)}
            placeholder={copy.ledger.search_placeholder}
            className="border-input bg-background focus:ring-primary/30 h-10 w-full rounded-lg border pr-3 pl-9 text-sm outline-none focus:ring-2"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          {copy.ledger.filters.map((filter: any) => (
            <button
              type="button"
              key={filter.id}
              onClick={() => setLedgerFilter(filter.id)}
              className={cn(
                'rounded-lg border px-3 py-2 text-xs font-medium transition-colors',
                ledgerFilter === filter.id
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'bg-background hover:border-primary/40'
              )}
            >
              {filter.title}
            </button>
          ))}
        </div>
      </div>
      <div className="max-h-[620px] overflow-auto rounded-xl border">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-muted text-muted-foreground sticky top-0 z-10 text-xs">
            <tr>
              {copy.ledger.columns.map((column: string) => (
                <th key={column} className="px-4 py-3 font-medium">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {ledgerRows.map((row) => (
              <tr key={row.name} className="hover:bg-muted/25">
                <td className="px-4 py-3 font-medium">{row.name}</td>
                <td className="px-4 py-3">{row.industry}</td>
                <td className="px-4 py-3">{row.cashflow}</td>
                <td className="px-4 py-3">{row.loan}</td>
                <td className="px-4 py-3">{row.followup}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                    {row.priority}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-muted-foreground text-xs">
        {copy.ledger.result_label.replace(
          '{count}',
          String(ledgerResultCount)
        )}
      </p>
    </div>
  );

  const renderOcr = () => (
    <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
      <div className="bg-muted/20 rounded-2xl border border-dashed p-6 text-center">
        <SmartIcon
          name="ScanLine"
          className="text-primary mx-auto mb-4 size-10"
        />
        <h3 className="font-semibold">{copy.ocr.upload_title}</h3>
        <p className="text-muted-foreground mt-2 text-sm">
          {copy.ocr.upload_description}
        </p>
        <input
          ref={materialInputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            setSelectedMaterialName(file.name);
            setOcrReviewed(false);
          }}
        />
        <Button
          type="button"
          className="mt-5"
          onClick={() => materialInputRef.current?.click()}
        >
          {copy.ocr.select_button}
        </Button>
        <p className="text-muted-foreground mt-3 text-xs">
          {selectedMaterialName
            ? `${copy.ocr.selected_file}: ${selectedMaterialName}`
            : copy.ocr.file_hint}
        </p>
      </div>
      <div className="rounded-2xl border p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold">{copy.ocr.result_title}</h3>
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            {ocrReviewed ? copy.ocr.reviewed : copy.ocr.pending}
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {copy.ocr.fields.map((field: any) => (
            <label key={field.label} className="space-y-1.5">
              <span className="text-muted-foreground text-xs">
                {field.label}
              </span>
              <input
                defaultValue={field.value}
                className="border-input bg-background h-10 w-full rounded-lg border px-3 text-sm"
              />
            </label>
          ))}
        </div>
        <Button className="mt-5" onClick={() => setOcrReviewed(true)}>
          <ClipboardCheck className="size-4" />
          {copy.ocr.confirm_button}
        </Button>
      </div>
    </div>
  );

  const renderInterview = () => (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="space-y-3 rounded-2xl border p-5">
        <label className="font-semibold" htmlFor="interview-notes">
          {copy.interview.input_title}
        </label>
        <textarea
          id="interview-notes"
          value={interviewText}
          onChange={(event) => {
            setInterviewText(event.target.value);
            setInterviewReady(false);
          }}
          className="border-input bg-background min-h-64 w-full resize-none rounded-xl border p-4 text-sm leading-6"
        />
        <Button
          onClick={() => setInterviewReady(true)}
          disabled={!interviewText.trim()}
        >
          <Sparkles className="size-4" />
          {copy.interview.action}
        </Button>
      </div>
      <div className="rounded-2xl border bg-blue-50/40 p-5 dark:bg-blue-950/15">
        <h3 className="mb-4 font-semibold">{copy.interview.output_title}</h3>
        {interviewReady ? (
          <div className="space-y-3">
            {copy.interview.outputs.map((output: any) => (
              <div
                key={output.label}
                className="bg-background rounded-xl border p-4"
              >
                <div className="text-primary mb-1 text-xs font-semibold">
                  {output.label}
                </div>
                <p className="text-sm leading-6">{output.value}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-muted-foreground flex min-h-64 items-center justify-center text-sm">
            {copy.interview.empty}
          </div>
        )}
      </div>
    </div>
  );

  const renderProfile = () => (
    <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
      <div className="rounded-2xl border p-5">
        <h3 className="mb-4 font-semibold">{copy.profile.form_title}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {copy.profile.fields.map((field: any) => (
            <label key={field.label} className="space-y-1.5">
              <span className="text-muted-foreground text-xs">
                {field.label}
              </span>
              <input
                defaultValue={field.value}
                className="border-input bg-background h-10 w-full rounded-lg border px-3 text-sm"
              />
            </label>
          ))}
        </div>
        <Button className="mt-5" onClick={save}>
          <Check className="size-4" />
          {copy.shared.save}
        </Button>
      </div>
      <div className="dark:to-background rounded-2xl border bg-gradient-to-br from-blue-50 to-white p-5 dark:from-blue-950/30">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">{copy.profile.summary_title}</h3>
          <span className="text-primary text-2xl font-bold">
            {copy.profile.completeness}
          </span>
        </div>
        <div className="bg-muted mt-4 h-2 overflow-hidden rounded-full">
          <div className="bg-primary h-full w-[86%] rounded-full" />
        </div>
        <div className="mt-5 space-y-3">
          {copy.profile.tags.map((tag: string) => (
            <div key={tag} className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="size-4 text-emerald-600" />
              {tag}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderMatching = () => (
    <div className="space-y-5">
      <div className="bg-muted/20 flex flex-col justify-between gap-4 rounded-2xl border p-5 sm:flex-row sm:items-center">
        <div>
          <h3 className="font-semibold">{copy.matching.customer_title}</h3>
          <p className="text-muted-foreground mt-1 text-sm">
            {copy.matching.customer_summary}
          </p>
        </div>
        <Button onClick={() => setMatchReady(true)}>
          <Sparkles className="size-4" />
          {copy.matching.action}
        </Button>
      </div>
      {matchReady && (
        <div className="grid gap-4 lg:grid-cols-2">
          {copy.matching.products.map((product: any) => (
            <div key={product.title} className="rounded-2xl border p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="text-primary text-xs font-semibold">
                    {product.label}
                  </span>
                  <h3 className="mt-1 font-semibold">{product.title}</h3>
                </div>
                <span className="text-primary text-2xl font-bold">
                  {product.score}
                </span>
              </div>
              <p className="text-muted-foreground mt-3 text-sm leading-6">
                {product.reason}
              </p>
              <div className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                <CircleAlert className="mt-0.5 size-4 shrink-0" />
                {product.condition}
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="text-muted-foreground text-xs">
        {copy.matching.disclaimer}
      </p>
    </div>
  );

  const renderScripts = () => (
    <div className="grid gap-5 lg:grid-cols-[0.7fr_1.3fr]">
      <div className="rounded-2xl border p-5">
        <h3 className="font-semibold">{copy.scripts.scenario_title}</h3>
        <div className="mt-4 space-y-2">
          {copy.scripts.scenarios.map((scenario: any, index: number) => (
            <button
              key={scenario.title}
              type="button"
              onClick={() => setScriptScenario(index)}
              className={cn(
                'w-full rounded-xl border p-3 text-left text-sm transition-colors',
                scriptScenario === index
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'hover:border-primary/40'
              )}
            >
              {scenario.title}
            </button>
          ))}
        </div>
      </div>
      <div className="rounded-2xl border bg-blue-50/35 p-5 dark:bg-blue-950/15">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">{copy.scripts.output_title}</h3>
          <span className="text-muted-foreground text-xs">
            {copy.scripts.editable}
          </span>
        </div>
        <textarea
          key={scriptScenario}
          defaultValue={copy.scripts.scenarios[scriptScenario].content}
          className="border-input bg-background min-h-64 w-full resize-none rounded-xl border p-4 text-sm leading-7"
        />
        <Button className="mt-4" onClick={save}>
          <Check className="size-4" />
          {copy.scripts.confirm_button}
        </Button>
      </div>
    </div>
  );

  const renderMaterialChecklist = () => {
    const completeCount = materialChecked.size;
    const total = (copy.materials.items as MaterialItem[]).length;
    const progress = Math.round((completeCount / total) * 100);
    return (
      <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border p-5">
          <h3 className="mb-4 font-semibold">{copy.materials.list_title}</h3>
          <div className="space-y-3">
            {(copy.materials.items as MaterialItem[]).map((item, index) => {
              const checked = materialChecked.has(index);
              return (
                <label
                  key={item.title}
                  className="hover:border-primary/40 flex cursor-pointer items-start gap-3 rounded-xl border p-4"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      const next = new Set(materialChecked);
                      if (checked) next.delete(index);
                      else next.add(index);
                      setMaterialChecked(next);
                    }}
                    className="mt-1 size-4"
                  />
                  <span>
                    <span className="block text-sm font-medium">
                      {item.title}
                    </span>
                    <span className="text-muted-foreground mt-1 block text-xs">
                      {item.description}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>
        <div className="dark:to-background rounded-2xl border bg-gradient-to-br from-emerald-50 to-white p-5 dark:from-emerald-950/20">
          <h3 className="font-semibold">{copy.materials.progress_title}</h3>
          <div className="mt-5 text-5xl font-bold text-emerald-600">
            {progress}%
          </div>
          <div className="bg-muted mt-4 h-2 overflow-hidden rounded-full">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-muted-foreground mt-4 text-sm">
            {copy.materials.progress_text
              .replace('{complete}', String(completeCount))
              .replace('{total}', String(total))}
          </p>
          <Button className="mt-5" variant="outline" onClick={save}>
            {copy.shared.save}
          </Button>
        </div>
      </div>
    );
  };

  const renderFollowup = () => (
    <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
      <div className="rounded-2xl border p-5">
        <h3 className="font-semibold">{copy.followup.add_title}</h3>
        <label className="mt-4 block space-y-1.5">
          <span className="text-muted-foreground text-xs">
            {copy.followup.task_label}
          </span>
          <input
            value={taskTitle}
            onChange={(event) => setTaskTitle(event.target.value)}
            placeholder={copy.followup.task_placeholder}
            className="border-input bg-background h-10 w-full rounded-lg border px-3 text-sm"
          />
        </label>
        <label className="mt-4 block space-y-1.5">
          <span className="text-muted-foreground text-xs">
            {copy.followup.date_label}
          </span>
          <input
            type="date"
            defaultValue="2026-08-08"
            className="border-input bg-background h-10 w-full rounded-lg border px-3 text-sm"
          />
        </label>
        <Button
          className="mt-5"
          disabled={!taskTitle.trim()}
          onClick={() => {
            setTasks([...tasks, taskTitle.trim()]);
            setTaskTitle('');
          }}
        >
          <Plus className="size-4" />
          {copy.followup.add_button}
        </Button>
      </div>
      <div className="rounded-2xl border p-5">
        <h3 className="font-semibold">{copy.followup.timeline_title}</h3>
        <div className="mt-5 space-y-4">
          {tasks.map((task, index) => (
            <div key={`${task}-${index}`} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span className="bg-primary mt-1 size-2.5 rounded-full" />
                {index < tasks.length - 1 && (
                  <span className="bg-border mt-1 h-full w-px" />
                )}
              </div>
              <div className="pb-4">
                <p className="text-sm font-medium">{task}</p>
                <p className="text-muted-foreground mt-1 text-xs">
                  {copy.followup.task_meta}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderMaterials = () => (
    <div className="space-y-6">
      {renderMaterialChecklist()}
      {renderFollowup()}
    </div>
  );

  const renderSummary = () => (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        {copy.summary.metrics.map((metric: any) => (
          <div
            key={metric.label}
            className="bg-muted/35 rounded-2xl border p-4"
          >
            <div className="text-primary text-2xl font-semibold">
              {metric.value}
            </div>
            <div className="text-muted-foreground mt-1 text-xs">
              {metric.label}
            </div>
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {copy.summary.sections.map((item: any) => (
          <div key={item.title} className="rounded-2xl border p-5">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-600" />
              <h3 className="font-semibold">{item.title}</h3>
            </div>
            <p className="text-muted-foreground mt-3 text-sm leading-6">
              {item.content}
            </p>
          </div>
        ))}
      </div>
      <div className="flex flex-col justify-between gap-4 rounded-2xl border bg-blue-50/40 p-5 sm:flex-row sm:items-center dark:bg-blue-950/15">
        <div>
          <h3 className="font-semibold">{copy.summary.action_title}</h3>
          <p className="text-muted-foreground mt-1 text-sm">
            {copy.summary.action_description}
          </p>
        </div>
        <Button onClick={save}>
          <Sparkles className="size-4" />
          {copy.summary.action_button}
        </Button>
      </div>
    </div>
  );

  const renderActiveModule = () => {
    switch (activeId) {
      case 'ledger':
        return renderLedger();
      case 'ocr':
        return renderOcr();
      case 'interview':
        return renderInterview();
      case 'profile':
        return renderProfile();
      case 'matching':
        return renderMatching();
      case 'scripts':
        return renderScripts();
      case 'materials':
        return renderMaterials();
      case 'summary':
        return renderSummary();
      default:
        return null;
    }
  };

  return (
    <section className="bg-muted/15 min-h-screen pt-24 pb-16">
      <div className="container">
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm"
        >
          <ArrowLeft className="size-4" />
          {section.back_title}
        </Link>

        <div className="mt-6 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <div className="text-primary mb-2 text-xs font-semibold tracking-[0.18em] uppercase">
              {section.eyebrow}
            </div>
            <h1 className="text-3xl font-semibold sm:text-4xl">
              {section.title}
            </h1>
            <p className="text-muted-foreground mt-3 max-w-3xl">
              {section.description}
            </p>
          </div>
          <div className="bg-background flex items-center gap-2 rounded-full border px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="size-4" />
            {section.demo_notice}
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[260px_1fr]">
          <aside className="bg-background h-fit rounded-2xl border p-3 lg:sticky lg:top-24">
            <div className="text-muted-foreground px-3 py-2 text-xs font-medium">
              {section.module_label}
            </div>
            <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-1">
              {modules.map((item) => {
                const className = cn(
                  'group flex items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors',
                  activeId === item.id
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted'
                );
                const content = (
                  <>
                    <SmartIcon name={item.icon} className="size-4 shrink-0" />
                    <span className="min-w-0 flex-1 text-sm font-medium">
                      {item.title}
                    </span>
                    <ArrowRight className="size-3.5 opacity-60" />
                  </>
                );

                return item.url ? (
                  <Link key={item.id} href={item.url} className={className}>
                    {content}
                  </Link>
                ) : (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => activateModule(item.id)}
                    className={className}
                  >
                    {content}
                  </button>
                );
              })}
            </div>
          </aside>

          <main className="bg-background min-w-0 rounded-3xl border p-4 shadow-sm sm:p-6 lg:p-8">
            <div className="mb-6 border-b pb-5">
              <div className="flex items-start gap-3">
                <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
                  <SmartIcon name={activeModule.icon} className="size-5" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">
                    {activeModule.title}
                  </h2>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {activeModule.description}
                  </p>
                </div>
              </div>
            </div>

            {renderActiveModule()}

            {savedMessage && (
              <div className="mt-5 flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                <CheckCircle2 className="size-4" />
                {savedMessage}
              </div>
            )}
          </main>
        </div>
      </div>
    </section>
  );
}
