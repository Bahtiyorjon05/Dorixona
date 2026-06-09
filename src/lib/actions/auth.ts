"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";

export async function authenticate(
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/moliya",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return "Email yoki parol noto'g'ri";
    }
    throw error; // muvaffaqiyatli redirect (NEXT_REDIRECT) — qayta uloqtiriladi
  }
}

export async function logout() {
  await signOut({ redirectTo: "/login" });
}
