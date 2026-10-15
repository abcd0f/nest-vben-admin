CREATE TYPE "DataScope" AS ENUM ('ALL', 'DEPT_AND_CHILDREN', 'DEPT', 'CUSTOM', 'SELF');

CREATE TABLE "sys_role" (
  "role_id" BIGSERIAL NOT NULL,
  "role_code" VARCHAR(64) NOT NULL,
  "role_name" VARCHAR(64) NOT NULL,
  "data_scope" "DataScope" NOT NULL DEFAULT 'SELF',
  "status" SMALLINT NOT NULL DEFAULT 1,
  "is_system" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  "deleted_at" TIMESTAMPTZ(3),
  CONSTRAINT "sys_role_pkey" PRIMARY KEY ("role_id")
);
CREATE UNIQUE INDEX "sys_role_role_code_key" ON "sys_role"("role_code");
CREATE INDEX "sys_role_deleted_at_idx" ON "sys_role"("deleted_at");

CREATE TABLE "sys_user_post" (
  "user_id" BIGINT NOT NULL,
  "post_id" BIGINT NOT NULL,
  CONSTRAINT "sys_user_post_pkey" PRIMARY KEY ("user_id", "post_id"),
  CONSTRAINT "sys_user_post_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "sys_user"("user_id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "sys_user_post_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "sys_post"("post_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "sys_user_post_post_id_idx" ON "sys_user_post"("post_id");

CREATE TABLE "sys_user_role" (
  "user_id" BIGINT NOT NULL,
  "role_id" BIGINT NOT NULL,
  CONSTRAINT "sys_user_role_pkey" PRIMARY KEY ("user_id", "role_id"),
  CONSTRAINT "sys_user_role_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "sys_user"("user_id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "sys_user_role_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "sys_role"("role_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "sys_user_role_role_id_idx" ON "sys_user_role"("role_id");

CREATE TABLE "sys_role_dept" (
  "role_id" BIGINT NOT NULL,
  "dept_id" BIGINT NOT NULL,
  CONSTRAINT "sys_role_dept_pkey" PRIMARY KEY ("role_id", "dept_id"),
  CONSTRAINT "sys_role_dept_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "sys_role"("role_id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "sys_role_dept_dept_id_fkey" FOREIGN KEY ("dept_id") REFERENCES "sys_dept"("dept_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "sys_role_dept_dept_id_idx" ON "sys_role_dept"("dept_id");
