CREATE TABLE "sys_dept" (
  "dept_id" BIGSERIAL NOT NULL,
  "parent_id" BIGINT,
  "dept_name" VARCHAR(64) NOT NULL,
  "sort_order" SMALLINT NOT NULL DEFAULT 0,
  "status" SMALLINT NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  "deleted_at" TIMESTAMPTZ(3),
  CONSTRAINT "sys_dept_pkey" PRIMARY KEY ("dept_id"),
  CONSTRAINT "sys_dept_parent_fkey" FOREIGN KEY ("parent_id") REFERENCES "sys_dept"("dept_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "sys_dept_parent_id_idx" ON "sys_dept"("parent_id");
CREATE INDEX "sys_dept_deleted_at_idx" ON "sys_dept"("deleted_at");
CREATE TABLE "sys_post" (
  "post_id" BIGSERIAL NOT NULL,
  "post_code" VARCHAR(64) NOT NULL,
  "post_name" VARCHAR(64) NOT NULL,
  "sort_order" SMALLINT NOT NULL DEFAULT 0,
  "status" SMALLINT NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  "deleted_at" TIMESTAMPTZ(3),
  CONSTRAINT "sys_post_pkey" PRIMARY KEY ("post_id")
);
CREATE UNIQUE INDEX "sys_post_post_code_key" ON "sys_post"("post_code");
CREATE INDEX "sys_post_deleted_at_idx" ON "sys_post"("deleted_at");
DROP INDEX IF EXISTS "sys_user_dept_id_key";
ALTER TABLE "sys_user" RENAME COLUMN "dept_id" TO "legacy_dept_id";
ALTER TABLE "sys_user" ADD COLUMN "dept_id" BIGINT;
CREATE INDEX "sys_user_dept_id_idx" ON "sys_user"("dept_id");
ALTER TABLE "sys_user" ADD CONSTRAINT "sys_user_dept_id_fkey" FOREIGN KEY ("dept_id") REFERENCES "sys_dept"("dept_id") ON DELETE RESTRICT ON UPDATE CASCADE;
