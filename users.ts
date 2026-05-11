// users.ts
import { page, escapeHtml } from "./templates";
import { db } from "./db";

export type User = {
  id: number;
  email: string;
  password_hash: string;
  created_at: number;
  updated_at: number;
};

const insertUser = db.prepare(
  "INSERT INTO users (email, password_hash) VALUES (?, ?)",
);

function renderSignupForm(
  values: { email: string } = { email: "" },
  errors: string[] = [],
): string {
  const errorList =
    errors.length === 0
      ? ""
      : `<ul class="errors">${errors.map((e) => `<li>${escapeHtml(e)}</li>`).join("")}</ul>`;

  return `<h1>Sign Up</h1>
${errorList}
<form method="POST" action="/signup">
  <label for="email">Email</label>
  <input id="email" name="email" type="email" value="${escapeHtml(values.email)}" required />

  <label for="password">Password</label>
  <input id="password" name="password" type="password" required />

  <label for="password_confirm">Confirm Password</label>
  <input id="password_confirm" name="password_confirm" type="password" required />

  <button type="submit">Create Account</button>
</form>`;
}

export const signup = () => page("Sign Up", renderSignupForm());

function validateSignup(
  email: string,
  password: string,
  passwordConfirm: string,
): string[] {
  const errors: string[] = [];
  if (email.trim() === "") errors.push("Email is required.");
  else if (!email.includes("@")) errors.push("Email must contain an @.");
  if (password.length < 8)
    errors.push("Password must be at least 8 characters.");
  if (password !== passwordConfirm) errors.push("Passwords do not match.");
  return errors;
}

export const createUser = async (req: Request) => {
  const form = await req.formData();
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");
  const passwordConfirm = String(form.get("password_confirm") ?? "");

  const errors = validateSignup(email, password, passwordConfirm);
  if (errors.length > 0) {
    return page("Sign Up", renderSignupForm({ email }, errors), {
      status: 422,
    });
  }

  const passwordHash = await Bun.password.hash(password);

  try {
    insertUser.run(email, passwordHash);
  } catch (err) {
    if (err instanceof Error && err.message.includes("UNIQUE")) {
      return page(
        "Sign Up",
        renderSignupForm({ email }, ["Email already registered."]),
        { status: 422 },
      );
    }
    throw err;
  }

  return Response.redirect("/success", 303);
};
