import { Migration } from '@medusajs/framework/mikro-orm/migrations'

export class Migration202609221500 extends Migration {
  async up(): Promise<void> {
    this.addSql('create table if not exists "etsy_webhook_delivery" ("id" text not null, "webhook_id" text not null, "event_type" text not null, "shop_id" integer not null, "receipt_id" integer not null, "resource_url" text not null, "emitted_at" timestamptz not null, "received_at" timestamptz not null, "status" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "etsy_webhook_delivery_pkey" primary key ("id"));')
    this.addSql('create unique index if not exists "IDX_etsy_webhook_delivery_webhook_id" on "etsy_webhook_delivery" ("webhook_id");')
    this.addSql('create index if not exists "IDX_etsy_webhook_delivery_status" on "etsy_webhook_delivery" ("status") where deleted_at is null;')
    this.addSql('create index if not exists "IDX_etsy_webhook_delivery_deleted_at" on "etsy_webhook_delivery" ("deleted_at") where deleted_at is null;')
  }
  async down(): Promise<void> { this.addSql('drop table if exists "etsy_webhook_delivery" cascade;') }
}
