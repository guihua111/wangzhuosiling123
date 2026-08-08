import { ZodError } from 'zod';

import { RetailApiError } from '@/shared/models/retail';

export function retailJson(data: unknown, status = 200) {
  return Response.json({ code: 0, message: 'ok', data }, { status });
}

export function retailError(error: unknown) {
  if (error instanceof ZodError) {
    return Response.json(
      {
        code: -1,
        message: error.issues[0]?.message || '请求参数不正确',
      },
      { status: 400 }
    );
  }

  if (error instanceof RetailApiError) {
    return Response.json(
      { code: -1, message: error.message },
      { status: error.status }
    );
  }

  console.error('retail api failed', error);
  return Response.json(
    { code: -1, message: '服务器暂时无法处理请求' },
    { status: 500 }
  );
}
