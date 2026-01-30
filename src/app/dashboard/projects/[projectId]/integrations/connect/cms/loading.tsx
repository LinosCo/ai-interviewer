export default function ConnectCMSLoading() {
  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="animate-pulse space-y-6">
        {/* Back button */}
        <div className="h-5 bg-gray-200 rounded w-40" />

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 bg-gray-200 rounded-xl" />
          <div className="space-y-2">
            <div className="h-7 bg-gray-200 rounded w-48" />
            <div className="h-4 bg-gray-200 rounded w-64" />
          </div>
        </div>

        {/* Organization info */}
        <div className="h-16 bg-gray-200 rounded-lg" />

        {/* Connection options */}
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-20 bg-gray-200 rounded-xl" />
          ))}
        </div>

        {/* Button */}
        <div className="h-12 bg-gray-200 rounded-lg" />
      </div>
    </div>
  );
}
