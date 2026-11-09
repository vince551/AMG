import { useEffect, useRef, useState } from "react";
import { useAuth } from "../store/AuthProvider";
import { avatarSeedUrl, EDUCATION_LEVELS, GENDERS, RELATIONSHIPS } from "../lib/format";

const AVATAR_LABELS = {
  scholar: "Scholar",
  reader: "Book lover",
  explorer: "Explorer",
  creative: "Creative learner",
  classic: "Classic portrait"
};

function LockIcon() {
  return (
    <svg className="password-lock-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <rect x="5" y="10" width="14" height="11" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function PasswordField({ id, name, label, autoComplete, minLength }) {
  const [visible, setVisible] = useState(false);
  return (
    <label>
      {label}
      <span className="password-field">
        <LockIcon />
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          minLength={minLength}
          required
        />
        <button
          className="password-toggle"
          type="button"
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          onClick={() => setVisible(show => !show)}
        >
          <EyeIcon />
        </button>
      </span>
    </label>
  );
}

function validateFields(container) {
  if (!container) return true;
  for (const field of container.querySelectorAll("input,select")) {
    if (field.required && !field.disabled && !field.checkValidity()) {
      field.reportValidity();
      field.focus();
      return false;
    }
  }
  return true;
}

export function AuthModal({ open, mode, onClose, onModeChange }) {
  const { login, register, resetPassword } = useAuth();
  const [step, setStep] = useState(1);
  const [avatarChoice, setAvatarChoice] = useState("scholar");
  const [busy, setBusy] = useState(false);

  const loginFormRef = useRef(null);
  const registerFormRef = useRef(null);
  const stepOneRef = useRef(null);
  const stepTwoRef = useRef(null);
  const photoInputRef = useRef(null);

  const registerMode = mode === "register";

  useEffect(() => {
    if (open) setStep(1);
  }, [open, mode]);

  // Only the visible registration step keeps its original `required` flags, so
  // the browser can validate each step without blocking the other one.
  useEffect(() => {
    if (!open) return;
    [stepOneRef.current, stepTwoRef.current].forEach((container, index) => {
      if (!container) return;
      container.querySelectorAll("input,select").forEach(field => {
        if (!("stepRequired" in field.dataset)) {
          field.dataset.stepRequired = field.required ? "true" : "false";
        }
        field.required = (index === 0) === (step === 1) && field.dataset.stepRequired === "true";
      });
    });
  }, [step, open]);

  useEffect(() => {
    // Choosing an avatar explicitly replaces any camera photo selected earlier.
    if (photoInputRef.current) photoInputRef.current.value = "";
  }, [avatarChoice]);

  if (!open) return null;

  const submitLogin = async (event) => {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    const ok = await login(String(form.get("loginName") || ""), String(form.get("password") || ""));
    setBusy(false);
    if (ok) {
      loginFormRef.current?.reset();
      onClose();
    }
  };

  const submitRegister = async (event) => {
    event.preventDefault();
    if (busy || !validateFields(stepTwoRef.current)) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    const ok = await register(form);
    setBusy(false);
    if (ok) {
      registerFormRef.current?.reset();
      setStep(1);
      onClose();
    }
  };

  const nextStep = () => {
    if (!validateFields(stepOneRef.current)) return;
    setStep(2);
    window.requestAnimationFrame(() => {
      stepTwoRef.current?.querySelector("input,select")?.focus();
    });
  };

  const forgotPassword = () => {
    const value = loginFormRef.current?.elements.loginName?.value || "";
    void resetPassword(value);
  };

  return (
    <div
      id="authModal"
      className="modal show"
      role="dialog"
      aria-modal="true"
      aria-labelledby="authTitle"
      onClick={event => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div className="modal-content auth-modal">
        <button className="close-btn" type="button" onClick={onClose} aria-label="Close">×</button>

        <aside className="auth-art">
          <img className="auth-logo" src="AMG.images/logo.jpg" alt="AMG Library logo" />
          <p className="auth-kicker">YOUR LEARNING PARTNER</p>
          <h2>Welcome to AMG Library</h2>
          <p>Find books, explore learning resources and manage your membership in one place.</p>
          <img className="auth-photo" src="AMG.images/learn.jpg" alt="Learners reading together" loading="lazy" />
          <div className="auth-art-footer"><span></span> Learn. Discover. Grow.</div>
        </aside>

        <div className="auth-form-panel">
          <div className="auth-tabs">
            <button
              id="loginModeBtn"
              className={"pill" + (registerMode ? "" : " active")}
              type="button"
              onClick={() => onModeChange("login")}
            >
              Log In
            </button>
            <button
              id="registerModeBtn"
              className={"pill" + (registerMode ? " active" : "")}
              type="button"
              onClick={() => onModeChange("register")}
            >
              Register
            </button>
          </div>

          <h2 id="authTitle">{registerMode ? "Register as an AMG Library Member" : "Member Log In"}</h2>

          {registerMode ? null : (
            <p className="muted auth-help">
              Librarian: enter the librarian email address and password.
              Members: enter the email address linked to your account.
            </p>
          )}

          <form
            id="loginForm"
            ref={loginFormRef}
            className={"form-stack" + (registerMode ? " hidden" : "")}
            onSubmit={submitLogin}
          >
            <label>
              Email address
              <input name="loginName" type="email" autoComplete="username" required placeholder="your@email.com" />
            </label>
            <PasswordField id="loginPasswordInput" name="password" label="Password" autoComplete="current-password" />
            <button className="btn btn-primary" type="submit" disabled={busy}>Log In</button>
            <button className="text-button" type="button" onClick={forgotPassword}>Forgot password?</button>
          </form>

          <form
            id="registerForm"
            ref={registerFormRef}
            className={"form-stack" + (registerMode ? "" : " hidden")}
            onSubmit={submitRegister}
          >
            <div id="registrationStepOne" ref={stepOneRef} className={"registration-step" + (step === 1 ? "" : " hidden")}>
              <div className="step-progress">
                <span className="step-dot active">1</span>
                <span className="step-line"></span>
                <span className="step-dot">2</span>
                <span className="step-caption">Learner details · Step 1 of 2</span>
              </div>
              <h3>Step 1 — Learner details</h3>
              <label>Full name<input name="fullName" required minLength="2" maxLength="120" autoComplete="name" /></label>
              <label>Email address<input name="email" type="email" required autoComplete="email" /></label>
              <label>
                Gender
                <select name="gender" defaultValue="Male">
                  {GENDERS.map(value => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>
              <label>School<input name="school" required maxLength="160" /></label>
              <label>Level of study (e.g. Form 3, Grade 5, Year 1)<input name="studyLevel" required maxLength="80" /></label>
              <label>
                Education level
                <select name="eduLevel" defaultValue={EDUCATION_LEVELS[0]}>
                  {EDUCATION_LEVELS.map(value => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>
              <PasswordField
                id="registerPasswordInput"
                name="password"
                label="Password (at least 8 characters)"
                autoComplete="new-password"
                minLength={8}
              />
              <button className="btn btn-primary" type="button" id="registrationNextBtn" onClick={nextStep}>
                Continue to parent / guardian details →
              </button>
            </div>

            <div
              id="registrationStepTwo"
              ref={stepTwoRef}
              className={"registration-step" + (step === 2 ? "" : " hidden")}
              aria-hidden={step !== 2}
            >
              <div className="step-progress">
                <span className="step-dot complete">✓</span>
                <span className="step-line complete"></span>
                <span className="step-dot active">2</span>
                <span className="step-caption">Parent / guardian · Step 2 of 2</span>
              </div>
              <h3>Step 2 — Parent or guardian</h3>
              <label>Parent / guardian full name<input name="guardianName" required maxLength="120" /></label>
              <label>
                Relationship
                <select name="guardianRelation" defaultValue="Mother">
                  {RELATIONSHIPS.map(value => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>
              <label>
                Parent / guardian phone number
                <input name="guardianPhone" type="tel" required maxLength="30" placeholder="+254 7XX XXX XXX" />
              </label>

              <fieldset className="avatar-fieldset">
                <legend>Choose a profile picture (optional)</legend>
                <p className="muted">Take a photo with your camera, or choose an avatar instead.</p>
                <label className="camera-picker">
                  Take a photo
                  <input ref={photoInputRef} name="photo" type="file" accept="image/*" capture="user" />
                </label>
                <label>
                  Or choose an avatar
                  <select
                    id="avatarChoice"
                    name="avatarChoice"
                    value={avatarChoice}
                    onChange={event => setAvatarChoice(event.target.value)}
                  >
                    {Object.entries(AVATAR_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </label>
                <div className="avatar-preview-row">
                  <img id="avatarPreview" src={avatarSeedUrl(avatarChoice)} alt="Selected avatar preview" />
                  <span className="muted">You can use this avatar without uploading a photo.</span>
                </div>
              </fieldset>

              <div className="registration-actions">
                <button className="btn btn-outline" type="button" onClick={() => setStep(1)}>← Back</button>
                <button className="btn btn-primary" type="submit" disabled={busy}>Submit registration for approval</button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
