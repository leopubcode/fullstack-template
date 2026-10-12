import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import {
  AuthForm,
  errorMessage,
  Field,
  FormMessage,
  SubmitButton,
} from "../components/AuthForm";

export function SignUp() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  const submit = async (form: FormData) => {
    setPending(true);
    setError(undefined);
    try {
      const { email } = await signUp({
        email: String(form.get("email")),
        password: String(form.get("password")),
        displayName: String(form.get("displayName")),
      });
      navigate(`/verify-email?email=${encodeURIComponent(email)}`);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPending(false);
    }
  };

  return (
    <AuthForm title="Sign up" onSubmit={submit}>
      <Field label="Name" name="displayName" autoComplete="name" required />
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
      />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={8}
        required
      />
      <FormMessage tone="error">{error}</FormMessage>
      <SubmitButton pending={pending}>Sign up</SubmitButton>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Already have an account?{" "}
        <Link to="/signin" className="underline">
          Sign in
        </Link>
      </p>
    </AuthForm>
  );
}
