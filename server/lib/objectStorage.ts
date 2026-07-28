import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

export interface ObjectStorage {
  put(key: string, buffer: Buffer, contentType: string): Promise<string>;
}

// R2 is S3-API-compatible, so the AWS SDK works against it with just a
// different endpoint. Buckets are private by default — until a custom domain
// or public access is configured in the Cloudflare dashboard, this URL isn't
// directly browsable; swap in a presigned GET URL (@aws-sdk/s3-request-presigner)
// if that's needed before then.
class R2ObjectStorage implements ObjectStorage {
  private client: S3Client;
  private bucket: string;
  private accountId: string;

  constructor(accountId: string, accessKeyId: string, secretAccessKey: string, bucket: string) {
    this.accountId = accountId;
    this.bucket = bucket;
    this.client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  async put(key: string, buffer: Buffer, contentType: string): Promise<string> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: buffer, ContentType: contentType }),
    );
    return `https://${this.accountId}.r2.cloudflarestorage.com/${this.bucket}/${key}`;
  }
}

// Used whenever R2 credentials aren't configured — the photo is embedded as
// a base64 data: URL instead of durably stored anywhere. Fine for exercising
// the full upload -> extract -> review -> save flow, but the "image" only
// exists as long as whatever holds this string (the DB row) does; it isn't
// backed by real object storage.
class DataUrlObjectStorage implements ObjectStorage {
  async put(_key: string, buffer: Buffer, contentType: string): Promise<string> {
    return `data:${contentType};base64,${buffer.toString("base64")}`;
  }
}

export function getObjectStorage(): ObjectStorage {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
  if (R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET) {
    return new R2ObjectStorage(R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET);
  }
  return new DataUrlObjectStorage();
}

export function isObjectStorageConfigured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET,
  );
}
