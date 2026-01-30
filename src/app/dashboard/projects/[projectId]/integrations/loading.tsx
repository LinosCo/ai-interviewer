export default function IntegrationsLoading() {
  return (
    <div className="p-8">
      <div className="animate-pulse space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <div className="h-7 bg-gray-200 rounded w-36" />
          <div className="h-4 bg-gray-200 rounded w-64" />
        </div>

        {/* Integration cards grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gray-200 rounded-xl" />
                  <div className="space-y-2">
                    <div className="h-5 bg-gray-200 rounded w-24" />
                    <div className="h-3 bg-gray-200 rounded w-32" />
                  </div>
                </div>
                <div className="h-6 bg-gray-200 rounded-full w-20" />
              </div>
              <div className="h-10 bg-gray-200 rounded-lg w-full mt-4" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
