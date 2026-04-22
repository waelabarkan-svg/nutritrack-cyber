
'use client';
// This file is deprecated in favor of src/firebase/auth/use-user.tsx
// Keeping it empty or as a simple wrapper to avoid breaking imports during migration
export { useUser as useAuth, useUser } from '@/firebase';
export const AuthProvider = ({ children }: { children: React.ReactNode }) => <>{children}</>;
