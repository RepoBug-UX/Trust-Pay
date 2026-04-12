import { tronscanTxLink } from '../utils/format';

const STEPS = [
  { label: 'Confirm in TronLink', icon: '1' },
  { label: 'Waiting for confirmation', icon: '2' },
  { label: 'Processing', icon: '3' },
  { label: 'Complete', icon: '4' }
];

export default function TxStepIndicator({ step = 0, txHash = null, error = null, message = '' }) {
  if (error) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-red-400">Transaction Failed</p>
            <p className="text-xs text-gray-400 mt-1">
              {error || 'This usually means insufficient USDT balance or the transaction was rejected in your wallet. Please try again.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (step === 0) return null;

  return (
    <div className="rounded-xl border border-navy-600 bg-navy-800/50 p-4">
      <div className="flex items-center gap-4">
        {STEPS.map((s, i) => {
          const stepNum = i + 1;
          const isActive = step === stepNum;
          const isComplete = step > stepNum;
          const isPending = step < stepNum;

          return (
            <div key={i} className="flex items-center gap-2">
              {i > 0 && (
                <div className={`w-6 h-px ${isComplete ? 'bg-teal-400' : 'bg-navy-600'}`} />
              )}
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                isComplete ? 'bg-teal-500 text-white' :
                isActive ? 'bg-teal-500/20 text-teal-400 ring-2 ring-teal-500/50' :
                'bg-navy-700 text-gray-500'
              }`}>
                {isComplete ? (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : s.icon}
              </div>
              <span className={`text-xs hidden sm:inline ${
                isActive ? 'text-teal-400' : isPending ? 'text-gray-500' : 'text-gray-400'
              }`}>
                {s.label}
              </span>
            </div>
          );
        })}
      </div>

      {message && (
        <p className="text-sm text-gray-300 mt-3">{message}</p>
      )}

      {step === 4 && txHash && (
        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs text-gray-400">TX:</span>
          <a
            href={tronscanTxLink(txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-teal-400 hover:text-teal-300 font-mono underline"
          >
            {txHash.slice(0, 16)}...{txHash.slice(-8)}
          </a>
        </div>
      )}
    </div>
  );
}
