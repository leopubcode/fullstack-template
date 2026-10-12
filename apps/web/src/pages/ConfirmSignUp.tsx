import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import {
  AuthForm,
  errorMessage,
  Field,
  FormMessage,
  SubmitButton,
} from "../components/AuthForm";

// The second step of signing up: the code emailed to the new account.
export function ConfirmSignUp() {
  const { confirmSignUp, resendConfirmationCode } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();

  const submit = async (form: FormData) => {
    setPending(true);
    setError(undefined);
    try {
      await confirmSignUp({ email, code: String(form.get("code")) });
      navigate(`/signin?confirmed=1&email=${encodeURIComponent(email)}`);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPending(false);
    }
  };

  const resend = async () => {
    setError(undefined);
    try {
      await resendConfirmationCode({ email });
      setNotice(`We sent a new code to ${email}.`);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  };

  return (
    <AuthForm title="Confirm your email" onSubmit={submit}>
      <FormMessage tone="info">
        {notice ?? "Enter the code we emailed you."}
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
      <Field
        label="Code"
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        required
      />
      <FormMessage tone="error">{error}</FormMessage>
      <SubmitButton pending={pending}>Confirm</SubmitButton>
      <button
        type="button"
        onClick={resend}
        disabled={!email}
        className="text-sm text-slate-600 dark:text-slate-400 underline disabled:opacity-50"
      >
        Send a new code
      </button>
    </AuthForm>
  );
}
