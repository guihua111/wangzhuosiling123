export type RetailRequestMeta = {
  method?: string;
  url?: string;
};

export async function readRetailApi<T>(
  response: Response,
  meta: RetailRequestMeta = {}
): Promise<T> {
  const method = (meta.method || 'GET').toUpperCase();
  const requestUrl = meta.url || response.url || 'unknown URL';
  const contentType = response.headers.get('content-type') || 'unknown';
  const responseText = await response.text();
  const bodyPreview = responseText.replace(/\s+/g, ' ').slice(0, 200);
  const diagnostic = {
    requestUrl,
    responseUrl: response.url || requestUrl,
    method,
    status: response.status,
    contentType,
    bodyPreview,
  };

  if (!contentType.toLowerCase().includes('json')) {
    console.error('retail api returned a non-JSON response', diagnostic);
    const pageType =
      response.redirected || /\/sign-in(?:\?|$)/.test(response.url)
        ? '登录页'
        : response.status === 404
          ? '404 页面'
          : response.status >= 500
            ? '服务端错误页'
            : 'HTML 页面';
    throw new Error(
      `接口返回了${pageType}，而不是 JSON：${method} ${requestUrl}（HTTP ${response.status}，Content-Type: ${contentType}）`
    );
  }

  let payload: any;
  try {
    payload = JSON.parse(responseText);
  } catch {
    console.error('retail api returned invalid JSON', diagnostic);
    throw new Error(
      `接口返回的 JSON 格式无效：${method} ${requestUrl}（HTTP ${response.status}）`
    );
  }

  if (!response.ok || payload.code !== 0) {
    throw new Error(payload.message || 'request failed');
  }
  return payload.data as T;
}
