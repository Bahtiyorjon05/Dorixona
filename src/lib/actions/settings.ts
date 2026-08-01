"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { startOfMonthString, todayString } from "@/lib/integrations/fapteka/client";
import { syncFapteka, type FaptekaSyncMode, type FaptekaSyncSummary } from "@/lib/integrations/fapteka/sync";
import { readUserAccess, saveUserAccess } from "@/lib/permission-db";
import { canAccessPermission, isAppPermission, type AppPermission } from "@/lib/permissions";

const roleSchema = z.enum(["OWNER", "MANAGER", "PHARMACIST", "CASHIER"]);
const faptekaSyncModeSchema = z.enum(["catalog", "movements", "sales", "all"]);

export type FaptekaSyncActionState = {
  ok: boolean;
  message: string;
  summary?: FaptekaSyncSummary;
};

function formPermissions(formData: FormData, key: string): AppPermission[] {
  return formData.getAll(key).filter((value): value is AppPermission => {
    return typeof value === "string" && isAppPermission(value);
  });
}

async function requireSettingsAccess() {
  const session = await auth();
  if (!session?.user) throw new Error("Avtorizatsiya talab qilinadi");
  if (!canAccessPermission(session.user.role, session.user.permissions, "sozlamalar")) {
    throw new Error("Sozlamalarni o'zgartirishga ruxsat yo'q");
  }
  return session.user;
}

export async function saveEmployeeAccess(formData: FormData) {
  await requireSettingsAccess();

  const employeeId = z.string().min(1).parse(formData.get("employeeId"));
  const email = z.string().email().parse(formData.get("email"));
  const password = String(formData.get("password") ?? "");
  const role = roleSchema.parse(formData.get("role"));
  const isActive = formData.get("isActive") === "on";
  const permissions = formPermissions(formData, "permissions");
  const editPermissions = formPermissions(formData, "editPermissions").filter((permission) => permissions.includes(permission));

  const employee = await db.employee.findUnique({
    where: { id: employeeId },
    include: { user: true },
  });
  if (!employee) throw new Error("Xodim topilmadi");
  if (!employee.user && password.length < 6) throw new Error("Yangi login uchun parol kamida 6 ta belgi bo'lishi kerak");

  let userId = employee.user?.id;
  if (employee.user) {
    await db.user.update({
      where: { id: employee.user.id },
      data: {
        email,
        role,
        isActive,
        fullName: employee.fullName,
        branchId: employee.branchId,
        ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}),
      },
    });
  } else {
    const user = await db.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(password, 10),
        fullName: employee.fullName,
        role,
        isActive,
        branchId: employee.branchId,
      },
    });
    userId = user.id;
    await db.employee.update({ where: { id: employee.id }, data: { userId } });
  }

  await saveUserAccess(userId!, permissions, editPermissions);
  revalidatePath("/sozlamalar");
}

export async function deactivateEmployeeAccess(formData: FormData) {
  await requireSettingsAccess();
  const userId = z.string().min(1).parse(formData.get("userId"));
  await db.user.update({ where: { id: userId }, data: { isActive: false } });
  revalidatePath("/sozlamalar");
}

export async function getAccessForUser(userId: string, role: string) {
  return readUserAccess(userId, role);
}

export async function runFaptekaSync(
  _previousState: FaptekaSyncActionState,
  formData: FormData,
): Promise<FaptekaSyncActionState> {
  try {
    await requireSettingsAccess();
    const mode = faptekaSyncModeSchema.parse(formData.get("mode")) as FaptekaSyncMode;
    const dateFrom = String(formData.get("dateFrom") || startOfMonthString());
    const dateTo = String(formData.get("dateTo") || todayString());
    const summary = await syncFapteka({ mode, dateFrom, dateTo });

    revalidatePath("/sozlamalar");
    revalidatePath("/ombor");
    revalidatePath("/moliya");
    revalidatePath("/harajatlar");
    revalidatePath("/hisobotlar");
    revalidatePath("/pos");

    return {
      ok: summary.ok,
      message: summary.ok
        ? "F-Apteka sync yakunlandi"
        : `F-Apteka sync qisman yakunlandi: ${summary.errors.join("; ")}`,
      summary,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "F-Apteka sync xatosi",
    };
  }
}
