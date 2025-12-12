import BotCreator from './bot-creator';

export default async function NewBotPage(props: { params: Promise<{ projectId: string }> }) {
    const params = await props.params;
    return <BotCreator projectId={params.projectId} />;
}
