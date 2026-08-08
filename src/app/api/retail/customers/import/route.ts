import { retailError, retailJson } from '@/shared/lib/retail-api';
import {
  createRetailCustomer,
  requireRetailContext,
} from '@/shared/models/retail';
import { retailCustomerImportSchema } from '@/shared/validators/retail';

export async function POST(request: Request) {
  try {
    const context = await requireRetailContext();
    const { rows } = retailCustomerImportSchema.parse(await request.json());
    const created = [];

    for (const row of rows) {
      created.push(await createRetailCustomer(context, row));
    }

    return retailJson({ list: created, count: created.length }, 201);
  } catch (error) {
    return retailError(error);
  }
}
