// Re-export encryption utilities from CMS module
// This allows integrations to use the same encryption without duplicating code

export { encrypt, decrypt } from '@/lib/cms/encryption';
