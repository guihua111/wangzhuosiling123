'use client';

import { ArrowUpRight } from 'lucide-react';

import { Link } from '@/core/i18n/navigation';
import { SmartIcon } from '@/shared/blocks/common/smart-icon';
import { ScrollAnimation } from '@/shared/components/ui/scroll-animation';
import { cn } from '@/shared/lib/utils';
import { Section } from '@/shared/types/blocks/landing';

export function Features({
  section,
  className,
}: {
  section: Section;
  className?: string;
}) {
  return (
    <section
      id={section.id}
      className={cn('py-16 md:py-24', section.className, className)}
    >
      <div className={`container space-y-8 md:space-y-16`}>
        <ScrollAnimation>
          <div className="mx-auto max-w-4xl text-center text-balance">
            <h2 className="text-foreground mb-4 text-3xl font-semibold tracking-tight md:text-4xl">
              {section.title}
            </h2>
            <p className="text-muted-foreground mb-6 md:mb-12 lg:mb-16">
              {section.description}
            </p>
          </div>
        </ScrollAnimation>

        <ScrollAnimation delay={0.2}>
          <div className="relative mx-auto grid divide-x divide-y border *:p-12 sm:grid-cols-2 lg:grid-cols-3">
            {section.items?.map((item, idx) => (
              <div className="min-w-0" key={idx}>
                {item.url ? (
                  <Link
                    href={item.url}
                    className="group hover:bg-primary/[0.04] focus-visible:ring-primary/40 -m-6 flex h-[calc(100%+3rem)] flex-col justify-between rounded-xl p-6 transition-colors focus-visible:ring-2 focus-visible:outline-none"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <SmartIcon name={item.icon as string} size={24} />
                        <h3 className="text-sm font-medium">{item.title}</h3>
                      </div>
                      <p className="text-sm">{item.description}</p>
                    </div>
                    <ArrowUpRight className="text-muted-foreground group-hover:text-primary mt-5 size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </Link>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <SmartIcon name={item.icon as string} size={24} />
                      <h3 className="text-sm font-medium">{item.title}</h3>
                    </div>
                    <p className="text-sm">{item.description}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollAnimation>
      </div>
    </section>
  );
}
