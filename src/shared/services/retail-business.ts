import { and, eq } from 'drizzle-orm';

import { db } from '@/core/db';
import { retailCustomerCase } from '@/config/db/schema';
import { getUuid } from '@/shared/lib/hash';
import {
  extractInterview,
  type RetailInterviewOutput,
} from '@/shared/lib/retail-interview';
import {
  getRetailCustomerForTeam,
  RetailApiError,
  RetailContext,
  writeRetailCustomerAudit,
} from '@/shared/models/retail';
import { RetailBusinessUpdate } from '@/shared/validators/retail';

export const RETAIL_RULE_VERSION = '2026-08-08-v1';

export type RetailField = { label: string; value: string };
export type { RetailInterviewOutput } from '@/shared/lib/retail-interview';
export type RetailMaterial = {
  title: string;
  description: string;
  complete: boolean;
};
export type RetailFollowupTask = {
  id: string;
  title: string;
  reminderDate: string;
  status: 'pending' | 'done';
};

export type RetailBusinessSnapshot = {
  exists: boolean;
  customerId: string;
  canEdit: boolean;
  version: number;
  ruleVersion: string;
  interview: {
    notes: string;
    outputs: RetailInterviewOutput[];
  };
  document: {
    fileName: string;
    fields: RetailField[];
    reviewed: boolean;
  };
  profile: {
    fields: RetailField[];
    completeness: number;
    tags: string[];
  };
  matching: {
    products: Array<{
      label: string;
      title: string;
      score: number;
      reason: string;
      condition: string;
    }>;
  };
  scripts: Array<{ title: string; content: string }>;
  materials: {
    items: RetailMaterial[];
    tasks: RetailFollowupTask[];
  };
  summary: {
    metrics: Array<{ value: string; label: string }>;
    sections: Array<{ title: string; content: string }>;
  };
  updatedAt: Date | null;
};

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function numericValue(value: string) {
  const match = String(value || '')
    .replace(/,/g, '')
    .match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

function findField(fields: RetailField[], names: string[]) {
  const normalized = names.map((item) => item.toLowerCase());
  return (
    fields.find((field) =>
      normalized.some((name) => field.label.toLowerCase().includes(name))
    )?.value || ''
  );
}

function buildProfile(fields: RetailField[]) {
  const filled = fields.filter((field) => field.value.trim()).length;
  const completeness = fields.length
    ? Math.round((filled / fields.length) * 100)
    : 0;
  const tags: string[] = [];
  const cashflow = numericValue(findField(fields, ['流水', 'cashflow']));
  const operatingYears = numericValue(
    findField(fields, ['经营年限', 'operating years'])
  );
  const bankRelationship = findField(fields, ['本行关系', 'bank']);
  const property = findField(fields, ['房产', 'property']);

  if (cashflow >= 30) tags.push('经营流水稳定');
  if (/无.*贷款|no.*loan/i.test(bankRelationship)) {
    tags.push('本行无经营贷款');
  }
  if (operatingYears >= 5) tags.push('经营年限超过5年');
  if (property) tags.push('房产信息已登记');
  if (!tags.length) tags.push('基础信息待继续补充');

  return { fields, completeness, tags };
}

function documentFieldKind(label: string) {
  const normalized = label.trim().toLowerCase();
  if (/企业名称|enterprise name|business name/.test(normalized)) {
    return 'enterpriseName';
  }
  if (/统一社会信用代码|social credit|registration number/.test(normalized)) {
    return 'socialCreditCode';
  }
  if (/经营者|operator|owner/.test(normalized)) return 'operator';
  if (/成立日期|establishment date|established|founded/.test(normalized)) {
    return 'establishedAt';
  }
  if (/经营范围|business scope/.test(normalized)) return 'businessScope';
  return '';
}

function syncDocumentFieldsToProfile(
  profileFields: RetailField[],
  documentFields: RetailField[]
) {
  const next = profileFields.map((field) => ({ ...field }));

  for (const documentField of documentFields) {
    const kind = documentFieldKind(documentField.label);
    if (!kind || !documentField.value.trim()) continue;

    const targetIndex = next.findIndex(
      (profileField) => documentFieldKind(profileField.label) === kind
    );
    if (targetIndex >= 0) {
      next[targetIndex] = {
        ...next[targetIndex],
        value: documentField.value,
      };
    } else {
      next.push({ ...documentField });
    }
  }

  return next;
}

function buildProductMatches(
  customer: Awaited<ReturnType<typeof getRetailCustomerForTeam>>,
  profile: RetailBusinessSnapshot['profile']
) {
  const cashflow = Math.max(
    numericValue(customer.cashflow),
    numericValue(findField(profile.fields, ['流水', 'cashflow']))
  );
  const operatingYears = numericValue(
    findField(profile.fields, ['经营年限', 'operating years'])
  );
  const age = numericValue(findField(profile.fields, ['年龄', 'age']));
  const property = findField(profile.fields, ['房产', 'property']);
  const noCurrentLoan = /无|none|no/i.test(customer.loan || '');

  let creditScore = 68;
  if (cashflow >= 50) creditScore += 10;
  else if (cashflow >= 30) creditScore += 6;
  if (operatingYears >= 5) creditScore += 7;
  if (noCurrentLoan) creditScore += 5;
  if (!age || (age >= 25 && age <= 60)) creditScore += 2;
  creditScore = Math.min(95, creditScore);

  let mortgageScore = 58;
  if (/房|住宅|商铺|house|property/i.test(property)) mortgageScore += 20;
  if (cashflow >= 30) mortgageScore += 7;
  if (operatingYears >= 3) mortgageScore += 5;
  mortgageScore = Math.min(92, mortgageScore);

  return [
    {
      label: '首推方向',
      title: '信用经营贷',
      score: creditScore,
      reason:
        '依据经营流水、经营年限、本行贷款关系和经营稳定性按固定规则计算，优先评估信用方式。',
      condition: '需补充近6个月完整流水、征信授权及现有负债信息。',
    },
    {
      label: '备选方向',
      title: '房产抵押经营贷',
      score: mortgageScore,
      reason: property
        ? '已登记房产信息，可在信用额度不足时按固定规则作为备选方向。'
        : '若客户可提供符合条件的房产，可作为信用额度不足时的备选方向。',
      condition: '需确认产权情况、抵押意愿和房产估值。',
    },
  ];
}

function buildSummary(snapshot: RetailBusinessSnapshot) {
  const primaryProduct = snapshot.matching.products[0];
  const completed = snapshot.materials.items.filter(
    (item) => item.complete
  ).length;
  const missing = snapshot.materials.items
    .filter((item) => !item.complete)
    .map((item) => item.title)
    .join('、');
  const interview = Object.fromEntries(
    snapshot.interview.outputs.map((item) => [item.label, item.value])
  );
  const pendingTasks = snapshot.materials.tasks
    .filter((task) => task.status === 'pending')
    .map((task) => task.title)
    .join('、');

  return {
    metrics: [
      {
        value: `${snapshot.profile.completeness}%`,
        label: '客户画像完整度',
      },
      {
        value: String(primaryProduct?.score || 0),
        label: '首推产品匹配分',
      },
      {
        value: `${completed}/${snapshot.materials.items.length}`,
        label: '已完成材料',
      },
    ],
    sections: [
      {
        title: '客户需求',
        content: `${interview['资金用途'] || '待确认'}；${interview['金额与期限'] || '金额与期限待确认'}。`,
      },
      {
        title: '产品建议',
        content: primaryProduct
          ? `首推${primaryProduct.title}，固定规则匹配分${primaryProduct.score}；正式结果以授信审批为准。`
          : '尚未计算产品匹配，请先完成客户画像和产品匹配。',
      },
      {
        title: '待补材料',
        content: missing || '当前材料清单已全部完成。',
      },
      {
        title: '下一步行动',
        content: pendingTasks || '暂无待执行跟进任务。',
      },
    ],
  };
}

function emptySnapshot(
  customer: Awaited<ReturnType<typeof getRetailCustomerForTeam>>,
  currentUserId: string
): RetailBusinessSnapshot {
  return {
    exists: false,
    customerId: customer.id,
    canEdit: customer.ownerUserId === currentUserId,
    version: 0,
    ruleVersion: RETAIL_RULE_VERSION,
    interview: { notes: '', outputs: [] },
    document: { fileName: '', fields: [], reviewed: false },
    profile: { fields: [], completeness: 0, tags: [] },
    matching: { products: [] },
    scripts: [],
    materials: { items: [], tasks: [] },
    summary: { metrics: [], sections: [] },
    updatedAt: null,
  };
}

function serializeCase(
  row: typeof retailCustomerCase.$inferSelect,
  currentUserId: string
): RetailBusinessSnapshot {
  const document = parseJson<Partial<RetailBusinessSnapshot['document']>>(
    row.documentData,
    {}
  );
  const profile = parseJson<Partial<RetailBusinessSnapshot['profile']>>(
    row.profileData,
    {}
  );
  const materials = parseJson<Partial<RetailBusinessSnapshot['materials']>>(
    row.materialsData,
    {}
  );
  const summary = parseJson<Partial<RetailBusinessSnapshot['summary']>>(
    row.summaryData,
    {}
  );
  const interviewOutputs = parseJson<
    RetailInterviewOutput[] | Record<string, unknown>
  >(row.interviewStructured, []);
  const productMatches = parseJson<
    RetailBusinessSnapshot['matching']['products'] | Record<string, unknown>
  >(row.productMatches, []);
  const scripts = parseJson<
    RetailBusinessSnapshot['scripts'] | Record<string, unknown>
  >(row.marketingScripts, []);

  return {
    exists: true,
    customerId: row.customerId,
    canEdit: row.ownerUserId === currentUserId,
    version: row.version,
    ruleVersion: row.ruleVersion,
    interview: {
      notes: row.interviewNotes,
      outputs: Array.isArray(interviewOutputs) ? interviewOutputs : [],
    },
    document: {
      fileName: typeof document.fileName === 'string' ? document.fileName : '',
      fields: Array.isArray(document.fields) ? document.fields : [],
      reviewed: document.reviewed === true,
    },
    profile: {
      fields: Array.isArray(profile.fields) ? profile.fields : [],
      completeness:
        typeof profile.completeness === 'number' ? profile.completeness : 0,
      tags: Array.isArray(profile.tags) ? profile.tags : [],
    },
    matching: {
      products: Array.isArray(productMatches) ? productMatches : [],
    },
    scripts: Array.isArray(scripts) ? scripts : [],
    materials: {
      items: Array.isArray(materials.items) ? materials.items : [],
      tasks: Array.isArray(materials.tasks) ? materials.tasks : [],
    },
    summary: {
      metrics: Array.isArray(summary.metrics) ? summary.metrics : [],
      sections: Array.isArray(summary.sections) ? summary.sections : [],
    },
    updatedAt: row.updatedAt,
  };
}

async function findCase(customerId: string) {
  const [row] = await db()
    .select()
    .from(retailCustomerCase)
    .where(eq(retailCustomerCase.customerId, customerId))
    .limit(1);
  return row;
}

export async function getRetailBusinessSnapshot(
  context: RetailContext,
  customerId: string
) {
  const customer = await getRetailCustomerForTeam(context, customerId);
  const row = await findCase(customer.id);
  return row
    ? serializeCase(row, context.user.id)
    : emptySnapshot(customer, context.user.id);
}

export async function updateRetailBusinessSnapshot(
  context: RetailContext,
  customerId: string,
  input: RetailBusinessUpdate
) {
  const customer = await getRetailCustomerForTeam(context, customerId);
  if (customer.ownerUserId !== context.user.id) {
    throw new RetailApiError('只有该客户的负责人可以修改业务资料', 403);
  }

  const existing = await findCase(customer.id);
  if (input.version !== undefined) {
    const currentVersion = existing?.version || 0;
    if (input.version !== currentVersion) {
      throw new RetailApiError('业务资料已发生变化，请刷新后重试', 409);
    }
  }

  const current = existing
    ? serializeCase(existing, context.user.id)
    : emptySnapshot(customer, context.user.id);
  const values: Record<string, unknown> = {};

  switch (input.module) {
    case 'interview': {
      values.interviewNotes = input.data.notes;
      values.interviewStructured = JSON.stringify(
        extractInterview(input.data.notes)
      );
      break;
    }
    case 'document': {
      values.documentData = JSON.stringify(input.data);
      values.profileData = JSON.stringify(
        buildProfile(
          syncDocumentFieldsToProfile(
            current.profile.fields.length
              ? current.profile.fields
              : input.data.profileFields,
            input.data.fields
          )
        )
      );
      break;
    }
    case 'profile': {
      values.profileData = JSON.stringify(buildProfile(input.data.fields));
      break;
    }
    case 'matching': {
      values.productMatches = JSON.stringify(
        buildProductMatches(customer, current.profile)
      );
      break;
    }
    case 'scripts': {
      const scripts = [...current.scripts];
      scripts[input.data.scenarioIndex] = {
        title: input.data.title,
        content: input.data.content,
      };
      values.marketingScripts = JSON.stringify(scripts);
      break;
    }
    case 'materials': {
      values.materialsData = JSON.stringify({
        items: input.data.items,
        tasks: input.data.tasks.map((task) => ({
          id: task.id || getUuid(),
          title: task.title,
          reminderDate: task.reminderDate || '',
          status: task.status || 'pending',
        })),
      });
      break;
    }
    case 'summary': {
      values.summaryData = JSON.stringify(buildSummary(current));
      break;
    }
  }

  let saved: typeof retailCustomerCase.$inferSelect | undefined;
  if (!existing) {
    [saved] = await db()
      .insert(retailCustomerCase)
      .values({
        id: getUuid(),
        teamId: context.team.id,
        customerId: customer.id,
        ownerUserId: customer.ownerUserId,
        ...values,
        ruleVersion: RETAIL_RULE_VERSION,
        createdBy: context.user.id,
        updatedBy: context.user.id,
      })
      .returning();
  } else {
    [saved] = await db()
      .update(retailCustomerCase)
      .set({
        ...values,
        ruleVersion: RETAIL_RULE_VERSION,
        version: existing.version + 1,
        updatedBy: context.user.id,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(retailCustomerCase.id, existing.id),
          eq(retailCustomerCase.version, existing.version)
        )
      )
      .returning();
  }

  if (!saved) {
    throw new RetailApiError('业务资料已发生变化，请刷新后重试', 409);
  }

  await writeRetailCustomerAudit(
    context,
    customer.id,
    `business.${input.module}.update`,
    { caseVersion: saved.version, ruleVersion: RETAIL_RULE_VERSION }
  );

  return serializeCase(saved, context.user.id);
}
