import { SmartIcon } from '@/shared/blocks/common';
import { Section } from '@/shared/types/blocks/landing';

export function RetailPainPoints({ section }: { section: Section }) {
  return (
    <section
      id={section.id}
      className="bg-white pt-16 pb-8 text-slate-950 md:pt-24 md:pb-10"
    >
      <div className="container">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-primary text-sm font-medium">{section.label}</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
            {section.title}
          </h2>
          <p className="mt-4 text-base leading-7 text-slate-600 md:text-lg">
            {section.description}
          </p>
        </div>

        <div className="mt-10 grid overflow-hidden rounded-3xl border border-slate-200 bg-white sm:grid-cols-2 lg:grid-cols-5">
          {section.items?.map((item, index) => (
            <article
              key={item.title}
              className="relative min-h-64 border-slate-200 p-6 sm:border-r sm:border-b lg:border-b-0 lg:last:border-r-0"
            >
              <div className="flex items-center justify-between">
                <span className="flex size-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100">
                  <SmartIcon name={item.icon as string} className="size-5" />
                </span>
                <span className="font-mono text-xs text-slate-400">
                  {String(index + 1).padStart(2, '0')}
                </span>
              </div>
              <h3 className="mt-8 text-base leading-6 font-semibold">
                {item.title}
              </h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {item.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
