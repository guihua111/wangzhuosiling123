import { ArrowRight, CheckCircle2 } from 'lucide-react';

import { Link } from '@/core/i18n/navigation';
import { SmartIcon } from '@/shared/blocks/common';
import { Button } from '@/shared/components/ui/button';
import { Section } from '@/shared/types/blocks/landing';

export function RetailFeatureShowcase({ section }: { section: Section }) {
  const items = (section.items ?? []) as Array<Record<string, any>>;
  const showcase = section.showcase as any;

  return (
    <section id={section.id} className="pt-8 pb-16 md:pt-10 md:pb-24">
      <div className="container">
        <div className="mx-auto max-w-3xl text-center">
          {section.label && (
            <p className="text-primary text-sm font-medium">{section.label}</p>
          )}
          <h2
            className={
              section.label
                ? 'mt-3 text-3xl font-semibold tracking-tight md:text-4xl'
                : 'text-3xl font-semibold tracking-tight md:text-4xl'
            }
          >
            {section.title}
          </h2>
          <p className="text-muted-foreground mt-4 text-base md:text-lg">
            {section.description}
          </p>
        </div>

        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item, index) => (
            <article
              key={item.title}
              className="bg-background flex min-h-36 flex-col rounded-2xl border p-5"
            >
              <div className="flex items-center justify-between">
                <span className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-xl">
                  <SmartIcon name={item.icon} className="size-4" />
                </span>
                <span className="text-muted-foreground text-xs">
                  {String(index + 1).padStart(2, '0')}
                </span>
              </div>
              <h3 className="mt-5 text-sm font-semibold">{item.title}</h3>
            </article>
          ))}
        </div>

        <div className="via-background mt-10 overflow-hidden rounded-3xl border bg-gradient-to-br from-blue-50/80 to-violet-50/60 p-5 md:p-8 dark:from-blue-950/20 dark:to-violet-950/15">
          <div className="grid items-center gap-8 lg:grid-cols-[0.78fr_1.22fr]">
            <div>
              <p className="text-primary text-sm font-medium">
                {showcase.label}
              </p>
              <h3 className="mt-3 text-2xl font-semibold md:text-3xl">
                {showcase.title}
              </h3>
              <p className="text-muted-foreground mt-4 leading-7">
                {showcase.description}
              </p>
              <div className="mt-6 space-y-3">
                {showcase.bullets.map((bullet: string) => (
                  <div key={bullet} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                    <span>{bullet}</span>
                  </div>
                ))}
              </div>
              <Button asChild className="mt-7">
                <Link href={showcase.url}>
                  {showcase.button}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>

            <div className="bg-background rounded-2xl border p-4 shadow-xl shadow-slate-900/5 md:p-6">
              <div className="flex flex-col justify-between gap-4 border-b pb-5 sm:flex-row sm:items-center">
                <div>
                  <p className="text-sm font-semibold">
                    {showcase.preview_title}
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {showcase.preview_description}
                  </p>
                </div>
                <span className="w-fit rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                  {showcase.status}
                </span>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {showcase.metrics.map((metric: any) => (
                  <div
                    key={metric.label}
                    className="bg-muted/45 rounded-xl p-3"
                  >
                    <div className="text-xl font-semibold">{metric.value}</div>
                    <div className="text-muted-foreground mt-1 text-xs">
                      {metric.label}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-5 overflow-hidden rounded-xl border">
                {showcase.rows.map((row: any, index: number) => (
                  <div
                    key={row.name}
                    className="grid grid-cols-[1fr_0.8fr_auto] items-center gap-3 border-b px-4 py-3 text-xs last:border-b-0"
                  >
                    <span className="font-medium">{row.name}</span>
                    <span className="text-muted-foreground">
                      {row.industry}
                    </span>
                    <span
                      className={
                        index === 0
                          ? 'rounded-full bg-blue-50 px-2.5 py-1 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300'
                          : 'bg-muted rounded-full px-2.5 py-1'
                      }
                    >
                      {row.priority}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
