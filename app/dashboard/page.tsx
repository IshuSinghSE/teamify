"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db, signOut } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { User } from "@/lib/types";

export default function DashboardPage() {
  const [user, setUser] = useState<Pick<User, "name" | "email"> | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      if (authUser) {
        // Fetch user data from Firestore
        const userDoc = await getDoc(doc(db, "users", authUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data() as User;
          setUser({
            name: userData.name,
            email: userData.email,
          });
        }
        setLoading(false);
      } else {
        router.push("/auth");
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleLogout = async () => {
    await signOut();
    router.push("/");
  };

  if (loading) {
    return <div style={{ padding: "40px" }}>Loading...</div>;
  }

  return (
    <div>
      <header style={{
        padding: "20px 40px",
        borderBottom: "1px solid #eaeaea",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center"
      }}>
        <h1 style={{ fontSize: "24px", fontWeight: "bold" }}>Teamify</h1>
        <button
          onClick={handleLogout}
          style={{
            padding: "10px 20px",
            backgroundColor: "#dc2626",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "16px"
          }}
        >
          Logout
        </button>
      </header>

      <main style={{ padding: "40px" }}>
        <h2 style={{ fontSize: "32px", marginBottom: "20px" }}>Dashboard</h2>
        
        {user && (
          <div style={{
            padding: "20px",
            borderRadius: "8px",
            marginBottom: "30px"
          }}>
            <h3 style={{ fontSize: "20px", marginBottom: "10px" }}>User Profile</h3>
            <p style={{ fontSize: "16px", marginBottom: "5px" }}>
              <strong>Name:</strong> {user.name}
            </p>
            <p style={{ fontSize: "16px" }}>
              <strong>Email:</strong> {user.email}
            </p>
          </div>
        )}

        <p style={{ fontSize: "18px", color: "#666" }}>
          Welcome to your dashboard. Team management features coming soon.
        </p>
      </main>
    </div>
  );
}
