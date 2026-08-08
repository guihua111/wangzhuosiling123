import { and, count, eq, isNull } from 'drizzle-orm';

import { db } from '@/core/db';
import {
  retailCustomer,
  retailCustomerAuditLog,
  retailTeam,
} from '@/config/db/schema';
import { getUuid } from '@/shared/lib/hash';
import { retailError, retailJson } from '@/shared/lib/retail-api';
import {
  listRetailCustomers,
  requireRetailContext,
} from '@/shared/models/retail';
import { retailCustomerImportSchema } from '@/shared/validators/retail';

export async function POST(request: Request) {
  try {
    const context = await requireRetailContext();
    const { rows } = retailCustomerImportSchema.parse(await request.json());
    await db().transaction(async (tx: any) => {
      await tx
        .select({ id: retailTeam.id })
        .from(retailTeam)
        .where(eq(retailTeam.id, context.team.id))
        .for('update');

      const [existing] = await tx
        .select({ value: count() })
        .from(retailCustomer)
        .where(
          and(
            eq(retailCustomer.teamId, context.team.id),
            isNull(retailCustomer.deletedAt)
          )
        );

      if (Number(existing?.value || 0) === 0) {
        const customerRows = rows.slice(0, 100).map((row) => ({
          id: getUuid(),
          teamId: context.team.id,
          ownerUserId: context.user.id,
          contactName: row.name,
          enterpriseName: row.enterpriseName,
          industry: row.industry,
          cashflow: row.cashflow,
          loan: row.loan,
          followup: row.followup,
          priority: row.priority,
          segment: row.segment,
          notes: row.notes,
          createdBy: context.user.id,
          updatedBy: context.user.id,
        }));

        await tx.insert(retailCustomer).values(customerRows);
        await tx.insert(retailCustomerAuditLog).values(
          customerRows.map((row) => ({
            id: getUuid(),
            teamId: context.team.id,
            customerId: row.id,
            userId: context.user.id,
            action: 'bootstrap',
            payload: '{}',
          }))
        );
      }
    });

    return retailJson(
      await listRetailCustomers({ context, page: 1, limit: 500 })
    );
  } catch (error) {
    return retailError(error);
  }
}
