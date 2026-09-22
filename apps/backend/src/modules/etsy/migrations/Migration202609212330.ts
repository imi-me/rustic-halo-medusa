import { Migration } from '@medusajs/framework/mikro-orm/migrations'

export class Migration202609212330 extends Migration {
  async up(): Promise<void> {
    this.addSql('create table if not exists "etsy_connection" ("id" text not null, "shop_id" integer not null, "encrypted_refresh_token" text not null, "access_expires_at" timestamptz not null, "scopes" jsonb not null, "connected_at" timestamptz not null, "last_read_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "etsy_connection_pkey" primary key ("id"));')
    this.addSql('create index if not exists "IDX_etsy_connection_deleted_at" on "etsy_connection" ("deleted_at") where deleted_at is null;')
  }
  async down(): Promise<void> { this.addSql('drop table if exists "etsy_connection" cascade;') }
}
