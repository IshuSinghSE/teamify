import Link from "next/link";

export default function Home() {
  return (
    <div style={{ minHeight: "100vh" }}>
      <header style={{
        padding: "20px 40px",
        borderBottom: "1px solid #eaeaea",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center"
      }}>
        <h1 style={{ fontSize: "24px", fontWeight: "bold" }}>Teamify</h1>
        <Link href="/auth">
          <button style={{
            padding: "10px 20px",
            backgroundColor: "#0070f3",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "16px"
          }}>
            Sign In / Sign Up
          </button>
        </Link>
      </header>

      <main style={{
        maxWidth: "800px",
        margin: "100px auto",
        padding: "0 40px",
        textAlign: "center"
      }}>
        <h2 style={{ fontSize: "48px", marginBottom: "20px" }}>
          Team Task Manager
        </h2>
        <p style={{ fontSize: "20px", color: "#666", marginBottom: "40px" }}>
          Collaborate with your team, manage tasks, and invite members with ease.
        </p>
        <Link href="/auth">
          <button style={{
            padding: "15px 30px",
            backgroundColor: "#0070f3",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "18px"
          }}>
            Get Started
          </button>
        </Link>
      </main>
    </div>
  );
}
