import "@/app/globals.css";
import Footer from "@/components/footer";
import NavbarDashboard from "@/components/navbar-dashboard";

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    // The same footer as everywhere else. The Studio had its own, which was a giant "VAEL | Studio"
    // wordmark and a copyright line: no way out of the Studio except the browser's back button.
    return (
        <div className="flex min-h-screen flex-col">
            <NavbarDashboard />
            <div className="flex-1">{children}</div>
            <Footer />
        </div>
    );
}
