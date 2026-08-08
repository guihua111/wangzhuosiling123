import { and, count, desc, eq, ilike, isNull, or } from 'drizzle-orm';

import { db } from '@/core/db';
import {
  retailCustomer,
  retailCustomerAuditLog,
  retailTeam,
  retailTeamMember,
  user,
} from '@/config/db/schema';
import { getUuid } from '@/shared/lib/hash';
import { getSignUser } from '@/shared/models/user';

export class RetailApiError extends Error {
  constructor(
    message: string,
    public status = 400
  ) {
    super(message);
  }
}

export type RetailContext = {
  user: NonNullable<Awaited<ReturnType<typeof getSignUser>>>;
  team: typeof retailTeam.$inferSelect;
  membership: typeof retailTeamMember.$inferSelect;
};

export type RetailCustomerInput = {
  name: string;
  enterpriseName?: string;
  industry: string;
  cashflow?: string;
  loan?: string;
  followup?: string;
  priority?: string;
  segment?: string;
  notes?: string;
};

function displayRetailContactName(name: string) {
  const demoNames: Record<string, string> = {
    '林*峰': '林晓峰',
    '张*航': '张远航',
    '陈*晴': '陈雨晴',
    '李*木': '李嘉木',
    '王*盛': '王华盛',
    '赵*丰': '赵永丰',
    '周*航': '周启航',
    '吴*庭': '吴云庭',
    '郑*悦': '郑欣悦',
    '孙*达': '孙宏达',
    '马*成': '马志成',
    '何*海': '何江海',
    'Lin *feng': 'Lin Xiaofeng',
    'Zhang *hang': 'Zhang Yuanhang',
    'Chen *qing': 'Chen Yuqing',
    'Li *mu': 'Li Jiamu',
    'Wang *sheng': 'Wang Huasheng',
    'Zhao *feng': 'Zhao Yongfeng',
    'Zhou *hang': 'Zhou Qihang',
    'Wu *ting': 'Wu Yunting',
    'Zheng *yue': 'Zheng Xinyue',
    'Sun *da': 'Sun Hongda',
    'Ma *cheng': 'Ma Zhicheng',
    'He *hai': 'He Jianghai',
  };
  const trimmed = String(name || '').trim();
  return demoNames[trimmed] || trimmed;
}

async function findRetailMembership(userId: string) {
  const [membership] = await db()
    .select()
    .from(retailTeamMember)
    .where(eq(retailTeamMember.userId, userId))
    .limit(1);

  return membership;
}

export async function requireRetailContext(): Promise<RetailContext> {
  const signUser = await getSignUser();
  if (!signUser) {
    throw new RetailApiError('请先登录', 401);
  }

  let membership = await findRetailMembership(signUser.id);

  if (!membership) {
    try {
      const created = await db().transaction(async (tx: any) => {
        const teamId = getUuid();
        const membershipId = getUuid();
        const teamName = `${signUser.name || signUser.email.split('@')[0]}的团队`;

        const [team] = await tx
          .insert(retailTeam)
          .values({
            id: teamId,
            name: teamName.slice(0, 100),
            ownerUserId: signUser.id,
          })
          .returning();
        const [teamMembership] = await tx
          .insert(retailTeamMember)
          .values({
            id: membershipId,
            teamId,
            userId: signUser.id,
            role: 'owner',
          })
          .returning();

        return { team, membership: teamMembership };
      });

      return { user: signUser, ...created };
    } catch {
      // Concurrent first requests may race. The unique user membership wins.
      membership = await findRetailMembership(signUser.id);
      if (!membership) {
        throw new RetailApiError('无法初始化团队，请稍后重试', 500);
      }
    }
  }

  const [team] = await db()
    .select()
    .from(retailTeam)
    .where(eq(retailTeam.id, membership.teamId))
    .limit(1);

  if (!team) {
    throw new RetailApiError('团队不存在', 404);
  }

  return { user: signUser, team, membership };
}

export function serializeRetailCustomer(
  customer: typeof retailCustomer.$inferSelect,
  currentUserId: string
) {
  return {
    id: customer.id,
    name: displayRetailContactName(customer.contactName),
    enterpriseName: customer.enterpriseName,
    industry: customer.industry,
    cashflow: customer.cashflow,
    loan: customer.loan,
    followup: customer.followup,
    priority: customer.priority,
    segment: customer.segment,
    status: customer.status,
    notes: customer.notes,
    ownerUserId: customer.ownerUserId,
    canEdit: customer.ownerUserId === currentUserId,
    version: customer.version,
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
  };
}

export async function listRetailCustomers({
  context,
  query = '',
  segment = 'all',
  page = 1,
  limit = 100,
}: {
  context: RetailContext;
  query?: string;
  segment?: string;
  page?: number;
  limit?: number;
}) {
  const conditions: any[] = [
    eq(retailCustomer.teamId, context.team.id),
    isNull(retailCustomer.deletedAt),
    eq(retailCustomer.status, 'active'),
  ];

  if (segment && segment !== 'all') {
    conditions.push(eq(retailCustomer.segment, segment));
  }
  if (query.trim()) {
    const pattern = `%${query.trim()}%`;
    conditions.push(
      or(
        ilike(retailCustomer.contactName, pattern),
        ilike(retailCustomer.enterpriseName, pattern),
        ilike(retailCustomer.industry, pattern)
      )
    );
  }

  const where = and(...conditions);
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(500, Math.max(1, limit));
  const [rows, totalRows] = await Promise.all([
    db()
      .select()
      .from(retailCustomer)
      .where(where)
      .orderBy(desc(retailCustomer.createdAt))
      .limit(safeLimit)
      .offset((safePage - 1) * safeLimit),
    db().select({ value: count() }).from(retailCustomer).where(where),
  ]);

  const total = Number(totalRows[0]?.value || 0);
  return {
    list: rows.map((row: typeof retailCustomer.$inferSelect) =>
      serializeRetailCustomer(row, context.user.id)
    ),
    total,
    page: safePage,
    limit: safeLimit,
    hasMore: safePage * safeLimit < total,
  };
}

export async function createRetailCustomer(
  context: RetailContext,
  input: RetailCustomerInput
) {
  const id = getUuid();
  const [created] = await db()
    .insert(retailCustomer)
    .values({
      id,
      teamId: context.team.id,
      ownerUserId: context.user.id,
      contactName: input.name.trim(),
      enterpriseName: input.enterpriseName?.trim() || '',
      industry: input.industry.trim(),
      cashflow: input.cashflow?.trim() || '',
      loan: input.loan?.trim() || '',
      followup: input.followup?.trim() || '',
      priority: input.priority?.trim() || '',
      segment: input.segment?.trim() || 'all',
      notes: input.notes?.trim() || '',
      createdBy: context.user.id,
      updatedBy: context.user.id,
    })
    .returning();

  await writeRetailCustomerAudit(context, id, 'create', {
    fields: Object.keys(input),
  });

  return serializeRetailCustomer(created, context.user.id);
}

export async function writeRetailCustomerAudit(
  context: RetailContext,
  customerId: string,
  action: string,
  payload: Record<string, unknown> = {}
) {
  await db()
    .insert(retailCustomerAuditLog)
    .values({
      id: getUuid(),
      teamId: context.team.id,
      customerId,
      userId: context.user.id,
      action,
      payload: JSON.stringify(payload),
    });
}

export async function getRetailCustomerForTeam(
  context: RetailContext,
  customerId: string
) {
  const [customer] = await db()
    .select()
    .from(retailCustomer)
    .where(
      and(
        eq(retailCustomer.id, customerId),
        eq(retailCustomer.teamId, context.team.id),
        isNull(retailCustomer.deletedAt)
      )
    )
    .limit(1);

  if (!customer) {
    throw new RetailApiError('客户不存在', 404);
  }

  return customer;
}

export async function addRetailTeamMember(
  context: RetailContext,
  email: string
) {
  if (context.membership.role !== 'owner') {
    throw new RetailApiError('只有团队负责人可以添加成员', 403);
  }

  const normalizedEmail = email.trim().toLowerCase();
  const [targetUser] = await db()
    .select()
    .from(user)
    .where(eq(user.email, normalizedEmail))
    .limit(1);

  if (!targetUser) {
    throw new RetailApiError('该邮箱尚未注册', 404);
  }

  const existingMembership = await findRetailMembership(targetUser.id);
  if (existingMembership) {
    if (existingMembership.teamId === context.team.id) {
      return existingMembership;
    }
    throw new RetailApiError('该用户已加入其他团队', 409);
  }

  const [membership] = await db()
    .insert(retailTeamMember)
    .values({
      id: getUuid(),
      teamId: context.team.id,
      userId: targetUser.id,
      role: 'member',
    })
    .returning();

  return membership;
}

export async function listRetailTeamMembers(context: RetailContext) {
  return db()
    .select({
      id: retailTeamMember.id,
      userId: retailTeamMember.userId,
      role: retailTeamMember.role,
      name: user.name,
      email: user.email,
      createdAt: retailTeamMember.createdAt,
    })
    .from(retailTeamMember)
    .innerJoin(user, eq(user.id, retailTeamMember.userId))
    .where(eq(retailTeamMember.teamId, context.team.id));
}
