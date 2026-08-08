import { retailError, retailJson } from '@/shared/lib/retail-api';
import {
  addRetailTeamMember,
  listRetailTeamMembers,
  requireRetailContext,
} from '@/shared/models/retail';
import { retailTeamMemberInputSchema } from '@/shared/validators/retail';

export async function GET() {
  try {
    const context = await requireRetailContext();
    return retailJson(await listRetailTeamMembers(context));
  } catch (error) {
    return retailError(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRetailContext();
    const { email } = retailTeamMemberInputSchema.parse(await request.json());
    await addRetailTeamMember(context, email);

    return retailJson(await listRetailTeamMembers(context), 201);
  } catch (error) {
    return retailError(error);
  }
}
