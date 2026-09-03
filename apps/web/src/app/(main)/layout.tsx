import "@/app/globals.css";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // A column that fills the viewport and lets the page take the slack. Without it every page had
  // to carry its own min-h-screen, and a short one then left a screen-tall gap above the footer.
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <div className="flex-1">{children}</div>
      <Footer />
    </div>
  );
}
