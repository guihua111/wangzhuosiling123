import { and, eq } from 'drizzle-orm';

import { db } from '@/core/db';
import { retailCustomer } from '@/config/db/schema';
import { retailError, retailJson } from '@/shared/lib/retail-api';
import {
  getRetailCustomerForTeam,
  requireRetailContext,
  RetailApiError,
  serializeRetailCustomer,
  writeRetailCustomerAudit,
} from '@/shared/models/retail';
import { retailCustomerUpdateSchema } from '@/shared/validators/retail';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const context = await requireRetailContext();
    const { id } = await params;
    const customer = await getRetailCustomerForTeam(context, id);

    return retailJson(serializeRetailCustomer(customer, context.user.id));
  } catch (error) {
    return retailError(error);
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const context = await requireRetailContext();
    const { id } = await params;
    const customer = await getRetailCustomerForTeam(context, id);
    if (customer.ownerUserId !== context.user.id) {
      throw new RetailApiError('只有该客户的负责人可以修改资料', 403);
    }

    const input = retailCustomerUpdateSchema.parse(await request.json());
    if (input.version && input.version !== customer.version) {
      throw new RetailApiError('客户资料已发生变化，请刷新后重试', 409);
    }

    const { version: _version, name, ...rest } = input;
    const values = {
      ...rest,
      ...(name !== undefined ? { contactName: name } : {}),
      version: customer.version + 1,
      updatedBy: context.user.id,
      updatedAt: new Date(),
    };
    const [updated] = await db()
      .update(retailCustomer)
      .set(values)
      .where(
        and(
          eq(retailCustomer.id, customer.id),
          eq(retailCustomer.version, customer.version)
        )
      )
      .returning();

    if (!updated) {
      throw new RetailApiError('客户资料已发生变化，请刷新后重试', 409);
    }

    await writeRetailCustomerAudit(context, customer.id, 'update', {
      fields: Object.keys(input).filter((key) => key !== 'version'),
      fromVersion: customer.version,
      toVersion: updated.version,
    });

    return retailJson(serializeRetailCustomer(updated, context.user.id));
  } catch (error) {
    return retailError(error);
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const context = await requireRetailContext();
    const { id } = await params;
    const customer = await getRetailCustomerForTeam(context, id);
    if (customer.ownerUserId !== context.user.id) {
      throw new RetailApiError('只有该客户的负责人可以删除资料', 403);
    }

    await db()
      .update(retailCustomer)
      .set({
        status: 'deleted',
        deletedAt: new Date(),
        updatedBy: context.user.id,
        updatedAt: new Date(),
        version: customer.version + 1,
      })
      .where(eq(retailCustomer.id, customer.id));
    await writeRetailCustomerAudit(context, customer.id, 'delete');

    return retailJson({ id: customer.id });
  } catch (error) {
    return retailError(error);
  }
}
