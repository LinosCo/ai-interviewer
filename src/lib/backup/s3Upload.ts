/**
 * AWS S3 Signature V4 upload using only Node.js built-ins (no aws-sdk needed).
 * Compatible with: AWS S3, Cloudflare R2, MinIO, Railway Object Storage.
 */

import { createHash, createHmac } from 'crypto';
import { gzipSync } from 'zlib';

function sha256hex(data: string | Buffer): string {
    return createHash('sha256').update(data).digest('hex');
}

function hmacSha256(key: Buffer | string, data: string): Buffer {
    return createHmac('sha256', key).update(data).digest();
}

function getSigningKey(secretKey: string, date: string, region: string, service: string): Buffer {
    const kDate = hmacSha256(`AWS4${secretKey}`, date);
    const kRegion = hmacSha256(kDate, region);
    const kService = hmacSha256(kRegion, service);
    const kSigning = hmacSha256(kService, 'aws4_request');
    return kSigning;
}

export interface S3Config {
    endpoint: string;    // e.g. "https://s3.amazonaws.com" or "https://<account_id>.r2.cloudflarestorage.com"
    region: string;      // e.g. "us-east-1" or "auto" for R2
    bucket: string;      // bucket name
    accessKey: string;
    secretKey: string;
}

export async function uploadToS3(
    config: S3Config,
    key: string,             // destination path, e.g. "backups/2026-03-01.json.gz"
    data: Buffer,
    contentType = 'application/gzip'
): Promise<void> {
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]/g, '').split('.')[0] + 'Z';
    const dateStamp = amzDate.substring(0, 8);

    const host = new URL(config.endpoint).host;
    const url = `${config.endpoint}/${config.bucket}/${key}`;

    const payloadHash = sha256hex(data);

    const headers: Record<string, string> = {
        host,
        'x-amz-date': amzDate,
        'x-amz-content-sha256': payloadHash,
        'content-type': contentType,
        'content-length': String(data.length),
    };

    // Canonical request
    const sortedHeaderNames = Object.keys(headers).sort();
    const canonicalHeaders = sortedHeaderNames.map((h) => `${h}:${headers[h]}`).join('\n') + '\n';
    const signedHeaders = sortedHeaderNames.join(';');

    const canonicalRequest = [
        'PUT',
        `/${config.bucket}/${key}`,
        '',
        canonicalHeaders,
        signedHeaders,
        payloadHash,
    ].join('\n');

    // String to sign
    const credentialScope = `${dateStamp}/${config.region}/s3/aws4_request`;
    const stringToSign = [
        'AWS4-HMAC-SHA256',
        amzDate,
        credentialScope,
        sha256hex(canonicalRequest),
    ].join('\n');

    // Signature
    const signingKey = getSigningKey(config.secretKey, dateStamp, config.region, 's3');
    const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex');

    const authorizationHeader = [
        `AWS4-HMAC-SHA256 Credential=${config.accessKey}/${credentialScope}`,
        `SignedHeaders=${signedHeaders}`,
        `Signature=${signature}`,
    ].join(', ');

    const response = await fetch(url, {
        method: 'PUT',
        headers: {
            ...headers,
            Authorization: authorizationHeader,
        },
        body: data,
    });

    if (!response.ok) {
        const body = await response.text();
        throw new Error(`S3 upload failed: ${response.status} ${response.statusText} — ${body}`);
    }
}

export function getS3ConfigFromEnv(): S3Config | null {
    const { BACKUP_S3_ENDPOINT, BACKUP_S3_REGION, BACKUP_S3_BUCKET, BACKUP_S3_ACCESS_KEY, BACKUP_S3_SECRET_KEY } =
        process.env;

    if (!BACKUP_S3_ENDPOINT || !BACKUP_S3_BUCKET || !BACKUP_S3_ACCESS_KEY || !BACKUP_S3_SECRET_KEY) {
        return null;
    }

    return {
        endpoint: BACKUP_S3_ENDPOINT,
        region: BACKUP_S3_REGION ?? 'auto',
        bucket: BACKUP_S3_BUCKET,
        accessKey: BACKUP_S3_ACCESS_KEY,
        secretKey: BACKUP_S3_SECRET_KEY,
    };
}

export function compressJson(data: unknown): Buffer {
    const json = JSON.stringify(data);
    return gzipSync(Buffer.from(json, 'utf-8'));
}
