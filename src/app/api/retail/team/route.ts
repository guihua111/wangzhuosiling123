import { retailError, retailJson } from '@/shared/lib/retail-api';
import {
  listRetailTeamMembers,
  requireRetailContext,
} from '@/shared/models/retail';

export async function GET() {
  try {
    const context = await requireRetailContext();
    const members = await listRetailTeamMembers(context);

    return retailJson({
      id: context.team.id,
      name: context.team.name,
      role: context.membership.role,
      ownerUserId: context.team.ownerUserId,
      members,
    });
  } catch (error) {
    return retailError(error);
  }
}
