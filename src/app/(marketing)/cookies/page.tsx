import { redirect } from 'next/navigation';

/**
 * /cookies → /cookie-policy (permanent redirect)
 * The canonical Cookie Policy lives at /cookie-policy.
 */
export default function CookiesPage() {
    redirect('/cookie-policy');
}
