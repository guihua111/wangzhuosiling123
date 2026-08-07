import { getTranslations } from 'next-intl/server';

import { Section } from '@/shared/types/blocks/landing';

import { RetailWorkbench } from './retail-workbench';

const moduleRoutes: Record<string, string> = {
  ledger: '/workbench/customer-ledger',
  interview: '/workbench/interview-management',
  ocr: '/workbench/document-ocr',
  profile: '/workbench/customer-profile',
  matching: '/workbench/product-matching',
  scripts: '/workbench/marketing-scripts',
  materials: '/workbench/materials-followup',
  summary: '/workbench/summary',
};

export async function RetailFeaturePage({ section }: { section: Section }) {
  const t = await getTranslations('pages.workbench');
  const workspace = t.raw('page.sections.workspace') as Section;
  const modules = ((workspace.modules ?? []) as Array<Record<string, any>>).map(
    (item) => ({
      ...item,
      url: moduleRoutes[item.id],
    })
  );

  return (
    <RetailWorkbench
      section={{
        ...workspace,
        title: section.title,
        description: section.description,
        default_module: section.module_id,
        modules,
      }}
    />
  );
}
