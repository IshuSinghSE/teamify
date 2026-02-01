import TeamPageClient from "./TeamPageClient";

export async function generateStaticParams() {
  return [{ teamId: "index" }];
}

export default function TeamPage() {
  return <TeamPageClient />;
}
