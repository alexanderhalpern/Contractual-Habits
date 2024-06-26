"use client";

import { useState, useEffect } from "react";
import { User } from "firebase/auth";
import {
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
} from "firebase/auth";
import TodoContract from "../components/TodoContract";
import { usePathname } from "next/navigation";
import { auth, database } from "@/lib/firebase";
import { Button } from "@/components/ui/button";

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const isBaseUrl = pathname === "/";

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Error signing in with Google", error);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h1 className="text-3xl font-bold mb-4 mx-8">
          Welcome to Contractual Habits
        </h1>
        <b className="my-4 mx-12">
          Invite your friends to keep you accountable for reaching your goals,
          or else...
        </b>
        <Button onClick={signInWithGoogle}>Sign in with Google</Button>

        <p className="my-4 text-xs mx-8">
          To begin on your journey toward self-improvement, sign up above
        </p>
      </div>
    );
  }

  return <TodoContract user={user} database={database} isBaseUrl={isBaseUrl} />;
}
