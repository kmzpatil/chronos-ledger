import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[SynapseStudy Error Boundary caught error]:', error, errorInfo);
  }

  public handleReset = () => {
    localStorage.removeItem('synapse_courses');
    localStorage.removeItem('synapse_concepts');
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="h-dvh w-screen flex flex-col items-center justify-center p-6 bg-[#0c0c0c] text-[#FFFFFF] font-sans">
          <div className="max-w-md w-full p-6 bg-[#141414] border border-[#2b2b2b] rounded-xl space-y-4 shadow-2xl">
            <div className="flex items-center gap-2.5 text-amber-400">
              <AlertTriangle className="w-5 h-5" />
              <h2 className="text-sm font-semibold tracking-tight text-[#FFFFFF]">
                Workspace Recovery
              </h2>
            </div>
            <p className="text-xs text-[#8a8a8a] leading-relaxed">
              An unexpected state occurred while rendering the workspace:
            </p>
            <div className="p-3 bg-black/60 rounded border border-[#222222] text-xs font-mono text-red-400 break-words">
              {this.state.error?.message || 'Unknown render exception'}
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={this.handleReset}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#FFFFFF] text-[#0c0c0c] hover:bg-white text-xs font-medium cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Local State & Reload</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
