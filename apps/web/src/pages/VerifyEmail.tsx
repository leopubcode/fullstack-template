import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import {
  AuthForm,
  errorMessage,
  Field,
  FormMessage,
  SubmitButton,
} from "../components/AuthForm";

// The second step of signing up: following the link emailed to the new
// account. The link lands on the sign-in page once the email is verified.
export function VerifyEmail() {
  const { resendVerification } = useAuth();
  const [params] = useSearchParams();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();

  const resend = async () => {
    setPending(true);
    setError(undefined);
    try {
      await resendVerification({ email });
      setNotice(`If ${email} still needs verifying, we sent it a new link.`);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPending(false);
    }
  };

  return (
    <AuthForm title="Verify your email" onSubmit={resend}>
      <FormMessage tone="info">
        {notice ??
          "We emailed you a link. Follow it to verify your email, then sign in."}
      </FormMessage>
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        required
      />
      <FormMessage tone="error">{error}</FormMessage>
      <SubmitButton pending={pending}>Send a new link</SubmitButton>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Already verified?{" "}
        <Link
          to={`/signin?email=${encodeURIComponent(email)}`}
          className="underline"
        >
          Sign in
        </Link>
      </p>
    </AuthForm>
  );
}
