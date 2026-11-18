import { Button, Modal } from './ui';

const GROUPS: { title: string; items: [string, string][] }[] = [
  {
    title: '回放',
    items: [
      ['空格', '播放 / 暂停'],
      ['→', '下一根'],
      ['←', '上一根'],
      ['Shift + →', '前进 5 根'],
      ['Shift + ←', '后退 5 根'],
      ['+ / -', '回放速度'],
      ['Esc', '退出回放'],
    ],
  },
  {
    title: '市场与视图',
    items: [
      ['1 – 7', '切换周期'],
      ['F', '全屏切换'],
      ['Alt + H', '本帮助面板'],
      ['Ctrl + Z', '撤销绘图'],
    ],
  },
];

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="inline-block rounded-sm border border-bg-border bg-bg-elevated px-1.5 py-0.5 font-mono text-[12px] text-text-secondary">
      {children}
    </kbd>
  );
}

export function ShortcutsHelp({ onClose }: { onClose: () => void }) {
  return (
    <Modal
      title="键盘快捷键"
      subtitle="像专业交易员一样操作"
      labelledBy="shortcuts-title"
      onClose={onClose}
      footer={
        <Button variant="primary" onClick={onClose} autoFocus>
          知道了
        </Button>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {GROUPS.map((g) => (
          <div key={g.title}>
            <div className="mb-1.5 text-[12px] font-semibold uppercase tracking-wider text-text-muted">
              {g.title}
            </div>
            <dl className="space-y-1.5">
              {g.items.map(([key, desc]) => (
                <div key={key} className="flex items-center justify-between gap-3">
                  <Kbd>{key}</Kbd>
                  <dd className="text-[13px] text-text-secondary">{desc}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
      <p className="mt-4 border-t border-bg-border pt-3 text-[13px] leading-snug text-text-muted">
        在输入框里打字时快捷键不生效。提示：右方向键一次揭示一根 K 线——这正是 K 线回放的核心。
      </p>
    </Modal>
  );
}
