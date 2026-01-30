export default function SettingsLoading() {
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="animate-pulse space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <div className="h-8 bg-gray-200 rounded w-40" />
          <div className="h-4 bg-gray-200 rounded w-64" />
        </div>

        {/* Settings sections */}
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="h-6 bg-gray-200 rounded w-32 mb-4" />
            <div className="space-y-4">
              <div className="h-10 bg-gray-200 rounded w-full" />
              <div className="h-10 bg-gray-200 rounded w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
