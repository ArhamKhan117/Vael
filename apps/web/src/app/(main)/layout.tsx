import "@/app/globals.css";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";
import { ProfileGuard } from "@/components/profile-guard";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div>
      <ProfileGuard />
      <Navbar />
      {children}
      <Footer />
    </div>
  );
}
