import { getUsers, getProjects } from '@/app/actions/admin';
import UsersView from './users-view';

export default async function UsersPage() {
    try {
        const users = await getUsers();
        const projects = await getProjects();

        return <UsersView users={users} projects={projects} />;
    } catch (error) {
        return (
            <div className="p-6 text-red-600">
                <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
                <p>You do not have permission to view this page.</p>
            </div>
        );
    }
}
