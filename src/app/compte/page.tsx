import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentAccountId } from "@/lib/session";
import { AccountProfileForm } from "@/components/forms/AccountProfileForm";
import { ChangePasswordForm } from "@/components/forms/ChangePasswordForm";

export default async function ComptePage() {
  const clientId = await getCurrentAccountId();
  if (!clientId) redirect("/login?callbackUrl=/compte");
  const client = await prisma.client.findUniqueOrThrow({ where: { id: clientId } });

  return (
    <div>
      <AccountProfileForm
        initialFirstName={client.firstName}
        initialLastName={client.lastName}
        initialCompany={client.company}
        initialEmail={client.email}
        initialPhone={client.phone}
        initialBillingAddress={client.billingAddress}
        initialBillingCity={client.billingCity}
        initialBillingProvince={client.billingProvince}
        initialBillingPostalCode={client.billingPostalCode}
      />
      <ChangePasswordForm />
    </div>
  );
}
