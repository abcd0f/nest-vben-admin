-- CreateTable
CREATE TABLE "sys_user" (
    "user_id" UUID NOT NULL,
    "dept_id" VARCHAR(64),
    "username" VARCHAR(64) NOT NULL,
    "nickname" VARCHAR(64),
    "phone" VARCHAR(32),
    "sex" SMALLINT DEFAULT 0,
    "avatar" VARCHAR(255),
    "email" VARCHAR(128),
    "password" VARCHAR(255) NOT NULL,
    "status" SMALLINT NOT NULL DEFAULT 1,
    "login_ip" VARCHAR(64),
    "login_date" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "sys_user_pkey" PRIMARY KEY ("user_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sys_user_dept_id_key" ON "sys_user"("dept_id");

-- CreateIndex
CREATE UNIQUE INDEX "sys_user_username_key" ON "sys_user"("username");

-- CreateIndex
CREATE UNIQUE INDEX "sys_user_phone_key" ON "sys_user"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "sys_user_email_key" ON "sys_user"("email");

-- CreateIndex
CREATE INDEX "sys_user_deleted_at_idx" ON "sys_user"("deleted_at");
