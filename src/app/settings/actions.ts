"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  startTripcomConnectionCheck,
  startTripcomManualRecovery
} from "@/lib/tripcom/automation";
import { writeAutomationPreferences } from "@/lib/tripcom/automation-preferences";

export async function runTripcomConnectionCheckAction() {
  startTripcomConnectionCheck();
  revalidatePath("/");
  revalidatePath("/settings");
  redirect("/settings");
}

export async function startTripcomRecoveryAction() {
  startTripcomManualRecovery();
  revalidatePath("/");
  revalidatePath("/settings");
  redirect("/settings");
}

export async function updateAutomationBrowserPreferenceAction(formData: FormData) {
  const showAutomationBrowser = String(formData.get("showAutomationBrowser") ?? "") === "1";

  writeAutomationPreferences({ showAutomationBrowser });
  revalidatePath("/");
  revalidatePath("/settings");
  redirect("/settings");
}
