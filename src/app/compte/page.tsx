import { prisma } from "@/lib/prisma";
import { getCurrentClientId } from "@/lib/session";
import { AccountProfileForm } from "@/components/forms/AccountProfileForm";
import { ChangePasswordForm } from "@/components/forms/ChangePasswordForm";

export default async function ComptePage() {
  const clientId = await getCurrentClientId();
  const client = await prisma.client.findUniqueOrThrow({ where: { id: clientId! } });

  return (
    <div>
      <AccountProfileForm initialEmail={client.email} initialPhone={client.phone} />
      <ChangePasswordForm />
    </div>
  );
}
