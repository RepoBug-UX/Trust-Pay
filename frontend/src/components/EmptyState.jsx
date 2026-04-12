export default function EmptyState({ icon, title, description, action, actionLabel }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
      {icon && (
        <div className="w-16 h-16 rounded-2xl bg-navy-800 border border-navy-600 flex items-center justify-center mb-4 text-2xl text-gray-500">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-heading font-semibold text-white mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-gray-400 max-w-sm mb-6">{description}</p>
      )}
      {action && actionLabel && (
        <button
          onClick={action}
          className="px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-white font-medium text-sm transition-colors"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
