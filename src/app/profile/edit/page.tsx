"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";

type FormErrors = Partial<Record<keyof typeof INITIAL_FORM, string>>;

const INITIAL_FORM = {
  username: "",
  email: "",
  first_name: "",
  last_name: "",
  dob: "",
  nationality: "",
  gender: "",
  contact_no: "",
};

const inputBase =
  "w-full rounded-xl border border-slate-200 text-sm placeholder:text-slate-400 " +
  "focus:ring-2 focus:ring-[#163422]/70 px-3 py-2";

export default function EditProfilePage() {
  const router = useRouter();
  const { status } = useSession();

  const [form, setForm] = useState({ ...INITIAL_FORM });
  const [originalForm, setOriginalForm] = useState({ ...INITIAL_FORM });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const hasUnsaved = JSON.stringify(form) !== JSON.stringify(originalForm);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
      return;
    }
    if (status !== "authenticated") return;

    const fetchProfile = async () => {
      try {
        const res = await fetch("/api/user/profile");
        if (!res.ok) throw new Error("Failed to load profile");
        const data = await res.json();
        const u = data.user;
        const loaded = {
          username: u.username || "",
          email: u.email || "",
          first_name: u.first_name || "",
          last_name: u.last_name || "",
          dob: u.dob || "",
          nationality: u.nationality || "",
          gender: u.gender || "",
          contact_no: u.contact_no || "",
        };
        setForm(loaded);
        setOriginalForm(loaded);
      } catch (err) {
        setErrors({ username: err instanceof Error ? err.message : "Failed to load profile" });
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [status, router]);

  useEffect(() => {
    if (!hasUnsaved) return;

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasUnsaved]);

  const handleBack = useCallback(() => {
    if (hasUnsaved) {
      const leave = window.confirm("You have unsaved changes. Leave anyway?");
      if (!leave) return;
    }
    router.push("/home");
  }, [hasUnsaved, router]);

  const validate = useCallback((): FormErrors => {
    const errs: FormErrors = {};

    if (!form.username.trim()) {
      errs.username = "Username is required";
    } else if (form.username.trim().length < 3) {
      errs.username = "Must be at least 3 characters";
    } else if (!/^[a-zA-Z0-9_]+$/.test(form.username)) {
      errs.username = "Letters, numbers and underscores only";
    }

    if (form.first_name && /\d/.test(form.first_name)) {
      errs.first_name = "No numbers allowed";
    }

    if (form.last_name && /\d/.test(form.last_name)) {
      errs.last_name = "No numbers allowed";
    }

    if (form.dob) {
      const birth = new Date(form.dob);
      const today = new Date();
      const age = today.getFullYear() - birth.getFullYear();
      const monthDiff = today.getMonth() - birth.getMonth();
      const actualAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate()) ? age - 1 : age;
      if (birth > today) {
        errs.dob = "Date of birth can't be in the future";
      } else if (actualAge < 13) {
        errs.dob = "You must be at least 13 years old";
      }
    }

    if (form.contact_no && !/^[\d\s\-+()]{7,20}$/.test(form.contact_no)) {
      errs.contact_no = "Enter a valid phone number (7–20 digits)";
    }

    return errs;
  }, [form]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setTouched((prev) => ({ ...prev, [name]: true }));
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    const name = e.target.name as keyof FormErrors;
    setTouched((prev) => ({ ...prev, [name]: true }));
    const fieldErrors = validate();
    setErrors((prev) => ({ ...prev, [name]: fieldErrors[name] }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    const fieldErrors = validate();
    setErrors(fieldErrors);
    setTouched(Object.keys(form).reduce((acc, k) => ({ ...acc, [k]: true }), {}));

    if (Object.values(fieldErrors).some(Boolean)) return;

    setSaving(true);

    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: form.username,
          first_name: form.first_name,
          last_name: form.last_name,
          dob: form.dob,
          nationality: form.nationality,
          gender: form.gender,
          contact_no: form.contact_no,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update profile");

      setOriginalForm({ ...form });
      toast.success("Profile updated successfully!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
          <div className="animate-spin h-8 w-8 border-2 border-[#163422] border-t-transparent rounded-full" />
          <p className="text-slate-500 text-sm">Loading profile...</p>
        </div>
      </div>
    );
  }

  const fieldClass = (name: keyof FormErrors, disabled = false) =>
    `${inputBase} ${
      disabled
        ? "bg-slate-100 text-slate-400 cursor-not-allowed"
        : errors[name] && touched[name]
          ? "border-red-400 focus:ring-red-400/70 bg-red-50"
          : ""
    }`;

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <button
        onClick={handleBack}
        className="text-sm text-slate-500 hover:text-slate-700 mb-6 transition-colors"
      >
        ← Back
      </button>

      <h1 className="text-3xl font-bold mb-8 text-[#0f172a]">Edit Profile</h1>

      <div className="rounded-3xl overflow-hidden shadow-sm bg-white border border-slate-200">
        <form onSubmit={handleSave} className="p-6 space-y-6">
          <div>
            <label className="block text-xs text-slate-600 mb-1">Username</label>
            <input
              type="text"
              name="username"
              className={fieldClass("username")}
              placeholder="your_username"
              value={form.username}
              onChange={handleChange}
              onBlur={handleBlur}
              required
            />
            {errors.username && touched.username && (
              <p className="text-red-500 text-xs mt-1">{errors.username}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-600 mb-1">First Name</label>
              <input
                type="text"
                name="first_name"
                className={fieldClass("first_name")}
                placeholder="First"
                value={form.first_name}
                onChange={handleChange}
                onBlur={handleBlur}
              />
              {errors.first_name && touched.first_name && (
                <p className="text-red-500 text-xs mt-1">{errors.first_name}</p>
              )}
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Last Name</label>
              <input
                type="text"
                name="last_name"
                className={fieldClass("last_name")}
                placeholder="Last"
                value={form.last_name}
                onChange={handleChange}
                onBlur={handleBlur}
              />
              {errors.last_name && touched.last_name && (
                <p className="text-red-500 text-xs mt-1">{errors.last_name}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-600 mb-1">Email</label>
            <input
              type="email"
              className={`${inputBase} bg-slate-100 text-slate-400 cursor-not-allowed`}
              value={form.email}
              disabled
            />
            <p className="text-xs text-slate-400 mt-1">Email cannot be changed</p>
          </div>

          <hr className="border-slate-200" />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Date of Birth</label>
              <input
                type="date"
                name="dob"
                className={fieldClass("dob")}
                value={form.dob}
                onChange={handleChange}
                onBlur={handleBlur}
              />
              {errors.dob && touched.dob && (
                <p className="text-red-500 text-xs mt-1">{errors.dob}</p>
              )}
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Gender</label>
              <select
                name="gender"
                className={fieldClass("gender")}
                value={form.gender}
                onChange={handleChange}
                onBlur={handleBlur}
              >
                <option value="">Select</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-600 mb-1">Nationality</label>
            <input
              type="text"
              name="nationality"
              className={fieldClass("nationality")}
              placeholder="e.g. Malaysian"
              value={form.nationality}
              onChange={handleChange}
              onBlur={handleBlur}
            />
          </div>

          <div>
            <label className="block text-xs text-slate-600 mb-1">Contact Number</label>
            <input
              type="tel"
              name="contact_no"
              className={fieldClass("contact_no")}
              placeholder="e.g. +60 12 345 6789"
              value={form.contact_no}
              onChange={handleChange}
              onBlur={handleBlur}
            />
            {errors.contact_no && touched.contact_no && (
              <p className="text-red-500 text-xs mt-1">{errors.contact_no}</p>
            )}
          </div>

          <div className="pt-4 flex flex-col sm:flex-row gap-3 justify-end">
            <button
              type="button"
              onClick={handleBack}
              className="px-6 py-3 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !hasUnsaved}
              className="px-6 py-3 rounded-lg bg-black text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
            >
              {saving ? (
                <>
                  <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
