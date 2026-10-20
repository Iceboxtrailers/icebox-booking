-- AlterTable
ALTER TABLE "clients" ADD COLUMN "hasAccount" BOOLEAN NOT NULL DEFAULT true;

-- Every client that exists today was typed in by staff or created by the old guest checkout with
-- a random password nobody knows: none of them has a login. They become admin-only records.
UPDATE "clients" SET "hasAccount" = false;

-- The email is now unique among real accounts only. Guest booking records (hasAccount = false)
-- are one per booking and may share an email.
DROP INDEX "clients_email_key";
CREATE UNIQUE INDEX "clients_email_account_key" ON "clients"("email") WHERE "hasAccount" = true;

-- CreateIndex
CREATE INDEX "clients_email_idx" ON "clients"("email");
