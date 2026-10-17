"use client";

import { useState } from "react";

type PasswordFieldProps = {
  signup?: boolean;
  placeholder?: string;
  name?: string;
  required?: boolean;
};

export default function PasswordField({
  signup = false,
  placeholder,
  name = "password",
  required = true,
}: PasswordFieldProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <label className="tg-field">
      Password
      <div style={{ position: "relative", marginTop: 6 }}>
        <input
          name={name}
          type={showPassword ? "text" : "password"}
          required={required}
          minLength={signup ? 8 : undefined}
          autoComplete={signup ? "new-password" : "current-password"}
          className="tg-input"
          style={{ paddingRight: 46, marginTop: 0 }}
          placeholder={placeholder ?? (signup ? "Minimal 8 karakter" : "Password")}
        />
        <button
          type="button"
          onClick={() => setShowPassword((prev) => !prev)}
          aria-label={showPassword ? "Sembunyikan password" : "Lihat password"}
          title={showPassword ? "Sembunyikan password" : "Lihat password"}
          className="tg-password-toggle"
        >
          {showPassword ? (
            <svg
              width="19"
              height="19"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
          ) : (
            <svg
              width="19"
              height="19"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>
    </label>
  );
}
