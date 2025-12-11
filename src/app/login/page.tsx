
export default function LoginPage() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-100">
            <div className="w-full max-w-md bg-white p-8 rounded shadow-md">
                <h2 className="text-2xl font-bold mb-6 text-center">Login</h2>
                <p className="text-center text-gray-500 mb-4">
                    (For MVP, use any email/password if seeded, or implement registration)
                </p>
                <form className="space-y-4">
                    {/* 
            TODO: Implement Server Action or use client-side signIn() 
            For now just a placeholder UI
          */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Email</label>
                        <input type="email" name="email" className="mt-1 block w-full rounded border-gray-300 shadow-sm p-2 border" placeholder="user@example.com" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Password</label>
                        <input type="password" name="password" className="mt-1 block w-full rounded border-gray-300 shadow-sm p-2 border" placeholder="******" />
                    </div>
                    <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700">
                        Sign In
                    </button>
                </form>
            </div>
        </div>
    );
}
