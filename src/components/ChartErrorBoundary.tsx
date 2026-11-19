import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * 图表崩溃隔离：TradingChart 子树抛异常时显示重置界面而不是整个应用白屏。
 * 持仓、成交、回放进度都在 App 层状态里（本边界之外），不受影响。
 */
export class ChartErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ReplayTrade] 图表渲染崩溃（已隔离）:', error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-bg-base p-6 text-center">
          <p className="text-[15px] font-bold text-down">图表渲染出错，已隔离</p>
          <p className="max-w-md text-[13px] leading-relaxed text-text-secondary">
            你的持仓、成交记录和回放进度都完好。点击下方按钮重置图表继续，
            若方便请把浏览器控制台（F12）里的红色报错发我，定位根因。
          </p>
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="rounded-sm bg-accent px-4 py-2 text-[13px] font-bold text-white transition-colors hover:bg-accent-hover"
          >
            重置图表
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
