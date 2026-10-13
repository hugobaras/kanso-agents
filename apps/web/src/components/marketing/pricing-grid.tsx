"use client";

import { useState } from "react";
import { IntervalToggle, PlanCard } from "@/components/pricing";
import { ButtonLink } from "@/components/ui/button";
import type { Plan } from "@/lib/types";

export function PricingGrid({ plans }: { plans: Plan[] }) {
  const [interval, setInterval] = useState<"month" | "year">("month");
  return (
    <>
      <div className="mt-10 flex justify-center">
        <IntervalToggle value={interval} onChange={setInterval} />
      </div>
      <div className="mt-10 grid gap-6 text-left lg:grid-cols-3">
        {plans.map((p) => (
          <PlanCard
            key={p.id}
            plan={p}
            interval={interval}
            featured={p.id === "cabinet"}
            action={
              <ButtonLink href="/inscription" variant={p.id === "cabinet" ? "primary" : "secondary"} className="w-full">
                Commencer l&apos;essai gratuit
              </ButtonLink>
            }
          />
        ))}
      </div>
    </>
  );
}
