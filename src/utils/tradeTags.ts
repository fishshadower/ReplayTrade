/** 成交复盘标签体系：四维度 + 总结论。固定清单保证统计口径一致，想加标签改这里。 */

export interface TagGroup {
  key: string;
  name: string;
  /** Tailwind 类：chip 配色（边框/底/字） */
  cls: string;
  tags: string[];
}

export const TAG_GROUPS: TagGroup[] = [
  {
    key: 'entry',
    name: '进场逻辑',
    cls: 'border-[#4f8cff]/50 bg-[#4f8cff]/10 text-[#7fb0ff]',
    tags: ['顺势跟进', '回踩进场', '突破追单', '逆势抄底摸顶', 'FOMO 追高', '无计划随手单'],
  },
  {
    key: 'exit',
    name: '离场执行',
    cls: 'border-[#22c55e]/50 bg-[#22c55e]/10 text-[#5ddc92]',
    tags: ['按计划拿满', '提前跑（拿不住）', '按计划止损', '移损保本出', '亏了硬扛手动砍', '盈利单拖成亏损'],
  },
  {
    key: 'discipline',
    name: '情绪纪律',
    cls: 'border-[#f97316]/50 bg-[#f97316]/10 text-[#fba75c]',
    tags: ['完全按计划', '冲动', '报复性交易', '加仓摊平', '仓位超标'],
  },
  {
    key: 'market',
    name: '行情环境',
    cls: 'border-[#a855f7]/50 bg-[#a855f7]/10 text-[#c99bff]',
    tags: ['趋势段', '震荡段', '假突破', '关键位反抽'],
  },
  {
    key: 'verdict',
    name: '总结论',
    cls: 'border-down/50 bg-down-dim text-down',
    tags: ['好交易（过程对）', '坏交易（过程错）', '运气单'],
  },
];

export const ALL_TAGS: string[] = TAG_GROUPS.flatMap((g) => g.tags);

export function tagGroupOf(tag: string): TagGroup | undefined {
  return TAG_GROUPS.find((g) => g.tags.includes(tag));
}

/** 自动标签：由 exitReason 派生（系统生成，不需要手选）。 */
export const AUTO_TAG_BY_REASON: Record<string, string> = {
  manual: '手动平仓',
  'stop-loss': '止损触发',
  'take-profit': '止盈触发',
  'replay-ended': '回放结束强平',
};
