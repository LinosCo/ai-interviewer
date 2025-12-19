import { getProjects, getUsers } from '@/app/actions/admin';
import ProjectsView from './projects-view';

export default async function AdminProjectsPage() {
    const projects = await getProjects();
    const users = await getUsers();

    // Sanitize users list (remove passwords/hashes before sending to client)
    const sanitizedUsers = users.map(u => ({
        id: u.id,
        name: u.name,
        email: u.email
    }));

    return <ProjectsView projects={projects} users={sanitizedUsers} />;
}
