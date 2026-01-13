import ProjectAnalytics from '@/components/analytics/ProjectAnalytics';

export default async function AnalyticsPage(props: { params: Promise<{ projectId: string }> }) {
    const params = await props.params;
    return <ProjectAnalytics projectId={params.projectId} />;
}
