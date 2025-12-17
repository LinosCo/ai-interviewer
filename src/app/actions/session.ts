'use server';

import { auth } from '@/auth';

export async function checkUserSession() {
    const session = await auth();
    return !!session?.user?.email;
}
