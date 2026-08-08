import { retailError } from '@/shared/lib/retail-api';
import {
  listRetailCustomers,
  requireRetailContext,
} from '@/shared/models/retail';

function csvValue(value: unknown) {
  const text = String(value ?? '');
  const safe = /^[=+@-]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
  try {
    const context = await requireRetailContext();
    const params = new URL(request.url).searchParams;
    const result = await listRetailCustomers({
      context,
      query: params.get('q') || '',
      segment: params.get('segment') || 'all',
      page: 1,
      limit: 500,
    });
    const rows = [
      [
        '客户姓名',
        '行业',
        '月均流水',
        '本行贷款',
        '最近跟进',
        '优先级',
        '筛选类别',
      ],
      ...result.list.map((customer: any) => [
        customer.name,
        customer.industry,
        customer.cashflow,
        customer.loan,
        customer.followup,
        customer.priority,
        customer.segment,
      ]),
    ];
    const csv = `\uFEFF${rows.map((row) => row.map(csvValue).join(',')).join('\r\n')}`;

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="retail-customers.csv"',
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    return retailError(error);
  }
}
