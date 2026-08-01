"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";

export async function authenticate(formData: FormData) {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/moliya",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect("/login?error=credentials");
    }
    throw error; // muvaffaqiyatli redirect (NEXT_REDIRECT) — qayta uloqtiriladi
  }
}

export async function logout() {
  await signOut({ redirectTo: "/login" });
}
