import { retailError, retailJson } from '@/shared/lib/retail-api';
import {
  createRetailCustomer,
  listRetailCustomers,
  requireRetailContext,
} from '@/shared/models/retail';
import { retailCustomerInputSchema } from '@/shared/validators/retail';

export async function GET(request: Request) {
  try {
    const context = await requireRetailContext();
    const params = new URL(request.url).searchParams;
    const data = await listRetailCustomers({
      context,
      query: params.get('q') || '',
      segment: params.get('segment') || 'all',
      page: Number(params.get('page') || 1),
      limit: Number(params.get('limit') || 100),
    });

    return retailJson(data);
  } catch (error) {
    return retailError(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRetailContext();
    const input = retailCustomerInputSchema.parse(await request.json());
    const customer = await createRetailCustomer(context, input);

    return retailJson(customer, 201);
  } catch (error) {
    return retailError(error);
  }
}
