import { retailError, retailJson } from '@/shared/lib/retail-api';
import { requireRetailContext } from '@/shared/models/retail';
import {
  getRetailBusinessSnapshot,
  updateRetailBusinessSnapshot,
} from '@/shared/services/retail-business';
import { retailBusinessUpdateSchema } from '@/shared/validators/retail';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const context = await requireRetailContext();
    const { id } = await params;
    return retailJson(await getRetailBusinessSnapshot(context, id));
  } catch (error) {
    return retailError(error);
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const context = await requireRetailContext();
    const { id } = await params;
    const input = retailBusinessUpdateSchema.parse(await request.json());
    return retailJson(await updateRetailBusinessSnapshot(context, id, input));
  } catch (error) {
    return retailError(error);
  }
}
