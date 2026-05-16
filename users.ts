// users.ts
import { pageFor, escapeHtml } from "./templates";
import { db } from "./db";
import { createSession, endSession, findSessionById } from "./sessions";

export type User = {
  id: number;
  email: string;
  password_hash: string;
  created_at: number;
  updated_at: number;
};

const isProduction = process.env.NODE_ENV === "production";

const insertUser = db.prepare(
  "INSERT INTO users (email, password_hash) VALUES (?, ?)",
);
const findUserByEmail = db.query("SELECT * FROM users WHERE email = ?");
const findUserById = db.query("SELECT * FROM users WHERE id = ?");

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

function renderLoginForm(
  values: { email: string } = { email: "" },
  errors: string[] = [],
): string {
  const errorList =
    errors.length === 0
      ? ""
      : `<ul class="errors">${errors.map((e) => `<li>${escapeHtml(e)}</li>`).join("")}</ul>`;

  return `<h1>Log In</h1>
${errorList}
<form method="POST" action="/login">
  <label for="email">Email</label>
  <input id="email" name="email" type="email" value="${escapeHtml(values.email)}" required />

  <label for="password">Password</label>
  <input id="password" name="password" type="password" required />

  <button type="submit">Log In</button>
</form>`;
}

export function validateSignup(
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

export const signup = (req: Request) =>
  pageFor(currentUser(req), "Sign Up", renderSignupForm());

export const createUser = async (req: Request) => {
  const form = await req.formData();
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");
  const passwordConfirm = String(form.get("password_confirm") ?? "");

  const errors = validateSignup(email, password, passwordConfirm);
  if (errors.length > 0) {
    return pageFor(
      currentUser(req),
      "Sign Up",
      renderSignupForm({ email }, errors),
      { status: 422 },
    );
  }

  try {
    const hash = await Bun.password.hash(password);
    insertUser.run(email, hash);
  } catch (err) {
    if (err instanceof Error && err.message.includes("UNIQUE")) {
      return pageFor(
        currentUser(req),
        "Sign Up",
        renderSignupForm({ email }, ["Email already registered."]),
        { status: 422 },
      );
    }
    throw err;
  }

  return Response.redirect("/success", 303);
};

export const login = (req: Request) =>
  pageFor(currentUser(req), "Log In", renderLoginForm());

export const createLogin = async (req: Request) => {
  const form = await req.formData();
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");

  const invalid = () =>
    pageFor(
      null,
      "Log In",
      renderLoginForm({ email }, ["Email or password is incorrect."]),
      { status: 422 },
    );

  if (email.trim() === "" || password === "") return invalid();

  const user = findUserByEmail.get(email) as User | null;
  if (!user) return invalid();

  const ok = await Bun.password.verify(password, user.password_hash);
  if (!ok) return invalid();

  const session = createSession(user.id);
  req.cookies.set("session_id", session.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    path: "/",
    maxAge: session.expires_at - Math.floor(Date.now() / 1000),
  });

  return Response.redirect("/", 303);
};

export function currentUser(req: Request): User | null {
  const sessionId = req.cookies.get("session_id");
  if (!sessionId) return null;

  const session = findSessionById(sessionId);
  if (!session) return null;

  return findUserById.get(session.user_id) as User | null;
}

export const logout = (req: Request) => {
  const sessionId = req.cookies.get("session_id");
  if (sessionId) {
    endSession(sessionId);
    req.cookies.delete("session_id");
  }
  return Response.redirect("/", 303);
};
