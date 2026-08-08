export type RetailInterviewOutput = { label: string; value: string };

export function extractInterview(notes: string): RetailInterviewOutput[] {
  const normalizedNotes = notes.replace(/\s+/g, ' ').trim();
  const amountMatch =
    normalizedNotes.match(
      /(?:希望|计划|拟|准备)?\s*(?:申请|融资|贷款|授信|借款|资金需求(?:为|约)?)\D{0,8}(\d+(?:\.\d+)?)\s*(万元|万|元)/
    ) ||
    normalizedNotes.match(
      /(\d+(?:\.\d+)?)\s*(万元|万|元)\D{0,8}(?:申请|融资|贷款|授信|借款|资金需求)/
    );
  const amount = amountMatch
    ? `${amountMatch[1]}${amountMatch[2] === '万' ? '万元' : amountMatch[2]}`
    : '待确认';
  const termMatch = normalizedNotes.match(
    /(?:期望期限|贷款期限|借款期限|期限)(?:为|约|是|：|:)?\s*(\d+(?:\.\d+)?)\s*(个月|月|年)/
  );
  const term = termMatch
    ? `${termMatch[1]}${termMatch[2] === '月' ? '个月' : termMatch[2]}`
    : '待确认';
  const explicitPurpose = normalizedNotes
    .match(
      /(?:用于|用作|资金用途(?:为|是)?|计划用于)\s*([^，。；;\n]{2,40})/
    )?.[1]
    ?.trim();
  const purposeKeywords = [
    '旺季备货',
    '备货',
    '经营周转',
    '周转',
    '装修',
    '设备采购',
    '扩店',
  ];
  const purposes = purposeKeywords.filter(
    (keyword, index) =>
      normalizedNotes.includes(keyword) &&
      !purposeKeywords
        .slice(0, index)
        .some((previous) => previous.includes(keyword))
  );
  const attentionRules = [
    { pattern: /放款(?:速度|时效)|审批速度/, label: '放款速度' },
    { pattern: /还款(?:方式)?灵活|灵活还款/, label: '还款灵活性' },
    { pattern: /利率|融资成本/, label: '利率' },
    { pattern: /额度/, label: '额度' },
    { pattern: /期限/, label: '期限' },
    { pattern: /抵押/, label: '抵押方式' },
  ];
  const attentions = attentionRules
    .filter((rule) => rule.pattern.test(normalizedNotes))
    .map((rule) => rule.label);
  const pendingItems: string[] = [];
  if (
    !/(?:现有|当前|目前).{0,6}负债|负债.{0,6}(?:无|有|为)/.test(normalizedNotes)
  ) {
    pendingItems.push('现有负债');
  }
  if (!/征信.{0,4}(?:授权|已授权)/.test(normalizedNotes)) {
    pendingItems.push('征信授权');
  }
  if (!/(?:近|最近)\s*(?:6|六)\s*个?月.{0,8}流水/.test(normalizedNotes)) {
    pendingItems.push('近6个月完整流水');
  }
  if (
    /(?:暂未确认|尚未确认|待确认|不确定).{0,12}(?:抵押|担保)|(?:抵押|担保).{0,12}(?:暂未确认|尚未确认|待确认|不确定)/.test(
      normalizedNotes
    )
  ) {
    pendingItems.push('抵押或担保意愿');
  }

  return [
    {
      label: '资金用途',
      value:
        explicitPurpose ||
        (purposes.length ? purposes.join('、') : '待客户进一步确认'),
    },
    { label: '金额与期限', value: `申请${amount}，期望期限${term}` },
    {
      label: '客户关注',
      value: attentions.length ? attentions.join('、') : '待进一步确认',
    },
    {
      label: '待确认事项',
      value: pendingItems.length ? pendingItems.join('、') : '暂无待确认事项',
    },
  ];
}
