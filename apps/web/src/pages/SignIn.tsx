import { useState } from "react";
import {
  Link,
  type Location,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import {
  AuthForm,
  errorCode,
  errorMessage,
  Field,
  FormMessage,
  SubmitButton,
} from "../components/AuthForm";

export function SignIn() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  // Back to the page RequireAuth sent us from, or home.
  const from =
    (location.state as { from?: Location } | null)?.from?.pathname ?? "/";

  const submit = async (form: FormData) => {
    const email = String(form.get("email"));
    setPending(true);
    setError(undefined);
    try {
      await signIn({ email, password: String(form.get("password")) });
      navigate(from, { replace: true });
    } catch (caught) {
      if (errorCode(caught) === "PRECONDITION_FAILED") {
        navigate(`/confirm?email=${encodeURIComponent(email)}`);
        return;
      }
      setError(errorMessage(caught));
    } finally {
      setPending(false);
    }
  };

  return (
    <AuthForm title="Sign in" onSubmit={submit}>
      <FormMessage tone="info">
        {params.get("confirmed") && "Your email is confirmed. Sign in below."}
      </FormMessage>
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        defaultValue={params.get("email") ?? ""}
        required
      />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
      />
      <FormMessage tone="error">{error}</FormMessage>
      <SubmitButton pending={pending}>Sign in</SubmitButton>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        No account?{" "}
        <Link to="/signup" className="underline">
          Sign up
        </Link>
      </p>
    </AuthForm>
  );
}
