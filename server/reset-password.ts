import { eq } from "drizzle-orm";
import db from "./src/db";
import { usersTable } from "./src/db/schema";
import { hashPassword } from "./src/lib/auth";

/**
 * Generate a random password
 */
function generatePassword(length: number = 12): string {
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";
  const symbols = "!@#$%^&*";

  const allChars = uppercase + lowercase + numbers + symbols;
  let password = "";

  for (let i = 0; i < length; i++) {
    password += allChars.charAt(Math.floor(Math.random() * allChars.length));
  }

  return password;
}

async function resetPassword(emailOrId: string) {
  try {
    // Find user by email or ID
    let user;
    const isNumber = /^\d+$/.test(emailOrId);

    if (isNumber) {
      user = await db.query.usersTable.findFirst({
        where: eq(usersTable.id, parseInt(emailOrId)),
      });
    } else {
      user = await db.query.usersTable.findFirst({
        where: eq(usersTable.email, emailOrId),
      });
    }

    if (!user) {
      console.error(`❌ User not found: ${emailOrId}`);
      process.exit(1);
    }

    // Generate new password
    const newPassword = generatePassword();
    const passwordHash = await hashPassword(newPassword);

    // Update user
    await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, user.id));

    console.log(`✅ Password reset for user: ${user.username} (${user.email})`);
    console.log(`🔐 New password: ${newPassword}`);
  } catch (error) {
    console.error("❌ Error resetting password:", error);
    process.exit(1);
  }
}

const emailOrId = process.argv[2];

if (!emailOrId) {
  console.error("Usage: bun reset-password.ts <email or user-id>");
  console.error("Examples:");
  console.error("  bun reset-password.ts user@example.com");
  console.error("  bun reset-password.ts 5");
  process.exit(1);
}

await resetPassword(emailOrId);
